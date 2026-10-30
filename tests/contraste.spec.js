const { test, expect } = require("@playwright/test");
const { iniciar } = require("./servidor");

const FORMS_TESTE = "https://forms.example.test/aurora-teste";

// Contraste WCAG medido no navegador (AC 14): para todo texto visível do <main> e do <footer>, a cor vem de
// getComputedStyle (com a opacidade dos ancestrais e o alfa da cor) e o fundo efetivo vem da cadeia de ancestrais:
// camadas de fundo translúcidas são compostas até a primeira opaca; se a cadeia chega a um fundo com imagem
// (o degradê do hero), o fundo são TODOS os pixels renderizados desse elemento com os filhos ocultos, ou seja,
// o ponto mais claro e o mais escuro do degradê. Mínimo 4,5:1; 3:1 para texto grande (>= 24 px, ou >= 18,66 px em negrito).

function medir() {
  const analisar = async ({ itens, fundos }) => {
    const lum = ([r, g, b]) => {
      const [R, G, B] = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const razao = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const sobre = (frente, a, fundo) =>
      frente.map((v, i) => v * a + fundo[i] * (1 - a));
    // pixels renderizados de cada fundo com imagem (filhos ocultos), sem repetir cor
    const pixels = {};
    for (const [id, base64] of Object.entries(fundos)) {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const cores = new Map();
      for (let i = 0; i < d.length; i += 4)
        cores.set((d[i] << 16) | (d[i + 1] << 8) | d[i + 2], [
          d[i],
          d[i + 1],
          d[i + 2],
        ]);
      pixels[id] = [...cores.values()];
    }
    return itens.map((it) => {
      let candidatos = it.grad === null ? [[255, 255, 255]] : pixels[it.grad];
      if (it.grad === null && it.solido) candidatos = [it.solido];
      // camadas translúcidas acima do fundo-base, da mais próxima do texto para a mais distante
      for (const [r, g, b, a] of it.camadas.slice().reverse())
        candidatos = candidatos.map((f) => sobre([r, g, b], a, f));
      const texto = it.cor;
      let pior = Infinity;
      for (const f of candidatos)
        pior = Math.min(
          pior,
          razao(sobre(texto.slice(0, 3), texto[3] * it.opacidade, f), f),
        );
      return {
        texto: it.texto,
        razao: pior,
        minimo: it.grande ? 3 : 4.5,
        grande: it.grande,
      };
    });
  };
  return analisar;
}

async function medirPagina(page) {
  // 1. coleta: texto visível, cor, opacidade, cadeia de fundos
  const itens = await page.evaluate(() => {
    const cor = (s) => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      const p = m[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const itens = [];
    let proximoGrad = 0;
    const donos = new Map();
    const raizes = [
      document.querySelector("main"),
      document.querySelector("footer"),
    ];
    for (const raiz of raizes) {
      const caminhador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      for (let no = caminhador.nextNode(); no; no = caminhador.nextNode()) {
        const texto = no.textContent.trim();
        if (!texto) continue;
        const el = no.parentElement;
        const caixa = el.getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(no);
        if (r.getClientRects().length === 0) continue; // display:none, hidden, noscript
        if (caixa.width <= 1 || caixa.height <= 1) continue; // .sr: 1 x 1 px, invisível na tela
        const cs = getComputedStyle(el);
        let opacidade = 1;
        for (let a = el; a; a = a.parentElement)
          opacidade *= Number(getComputedStyle(a).opacity);
        const camadas = [];
        let grad = null;
        let solido = null;
        for (let a = el; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.backgroundImage !== "none") {
            if (!donos.has(a)) donos.set(a, proximoGrad++);
            grad = donos.get(a);
            break;
          }
          const bg = cor(s.backgroundColor);
          if (bg[3] === 1) {
            solido = bg.slice(0, 3);
            break;
          }
          if (bg[3] > 0) camadas.push(bg);
        }
        const tam = parseFloat(cs.fontSize);
        const negrito = Number(cs.fontWeight) >= 700;
        itens.push({
          texto: texto.slice(0, 50),
          cor: cor(cs.color),
          opacidade,
          camadas,
          grad,
          solido,
          grande: tam >= 24 || (tam >= 18.66 && negrito),
        });
      }
    }
    for (const [el, id] of donos)
      el.setAttribute("data-medir-fundo", String(id));
    return itens;
  });
  // 2. fundos com imagem: renderiza só o fundo (filhos ocultos) e captura os pixels
  await page.addStyleTag({
    content: "[data-medir-fundo] *{visibility:hidden!important}",
  });
  const fundos = {};
  for (const el of await page.locator("[data-medir-fundo]").all()) {
    const id = await el.getAttribute("data-medir-fundo");
    fundos[id] = (await el.screenshot()).toString("base64");
  }
  return page.evaluate(medir(), { itens, fundos });
}

for (const estado of ["fechado", "aberto"]) {
  for (const largura of [360, 1280]) {
    test(`contraste de todo texto visível medido no navegador (${estado}, ${largura} px)`, async ({
      page,
    }) => {
      const alvo = await iniciar(
        estado === "aberto" ? { formsUrl: FORMS_TESTE } : {},
      );
      try {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto(alvo.url, { waitUntil: "networkidle" });
        const medidas = await medirPagina(page);
        // cobertura: a medição alcança os textos do hero, do mosaico, dos passos, do Portão e do rodapé
        const textos = medidas.map((m) => m.texto);
        for (const esperado of [
          "Aurora",
          "Teste fechado no Android",
          "Cuide de você",
          "Silêncio",
          "Diário",
          "Entre na lista.",
          "Política de privacidade",
          "Dúvidas ou pedido de exclusão:",
        ]) {
          expect(
            textos.some((t) => t.startsWith(esperado)),
            `${estado} ${largura} mede "${esperado}"`,
          ).toBe(true);
        }
        if (estado === "aberto")
          expect(
            textos.filter((t) => t === "Entrar na lista"),
            "os dois CTAs",
          ).toHaveLength(2);
        expect(medidas.length, "textos medidos").toBeGreaterThanOrEqual(
          estado === "aberto" ? 30 : 27,
        );
        const falhas = medidas
          .filter((m) => m.razao < m.minimo)
          .map((m) => `${m.texto}: ${m.razao.toFixed(2)}:1 < ${m.minimo}`);
        expect(falhas, `${estado} ${largura}`).toEqual([]);
      } finally {
        alvo.fechar();
      }
    });
  }
}
