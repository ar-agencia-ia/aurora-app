const { test } = require("@playwright/test");
const path = require("path");
const { iniciar } = require("./servidor");

// Capturas de tela inteira da landing: Portão fechado e aberto, 360 px e desktop.
// Pasta de saída: CAPTURAS_DIR (padrão test-results/capturas).
const saida = path.resolve(process.env.CAPTURAS_DIR || "test-results/capturas");
const telas = [
  { nome: "360px", largura: 360, altura: 800 },
  { nome: "desktop", largura: 1280, altura: 800 },
];
const portoes = [
  { nome: "fechado", opcoes: {} },
  {
    nome: "aberto",
    opcoes: { formsUrl: "https://forms.example.test/aurora-teste" },
  },
];

for (const portao of portoes) {
  for (const tela of telas) {
    test(`captura ${portao.nome} ${tela.nome}`, async ({ page }) => {
      const site = await iniciar(portao.opcoes);
      try {
        await page.setViewportSize({
          width: tela.largura,
          height: tela.altura,
        });
        await page.goto(site.url, { waitUntil: "networkidle" });
        await page.screenshot({
          path: path.join(saida, `landing-${portao.nome}-${tela.nome}.png`),
          fullPage: true,
        });
      } finally {
        site.fechar();
      }
    });
  }
}
