const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { iniciar, RAIZ } = require("./servidor");

const ID = "111222333444555";
const CHAVE_TESTE = "chave-de-teste-web3forms";
const META = "**/connect.facebook.net/**";

// fbevents.js falso: o snippet padrão enfileira as chamadas em fbq.queue; nada chega ao Pixel real da campanha.
const FBEVENTS_FALSO = "window.__fbeventsCarregado = true;";

async function abrir(
  page,
  { pixelId = ID, chave = CHAVE_TESTE, antes } = {},
) {
  const alvo = await iniciar({ pixelId, chave });
  const pedidosMeta = [];
  await page.route(META, (rota) => {
    pedidosMeta.push(rota.request().url());
    return rota.fulfill({
      contentType: "application/javascript",
      body: FBEVENTS_FALSO,
    });
  });
  if (antes) await page.addInitScript(antes);
  await page.goto(alvo.url, { waitUntil: "networkidle" });
  return { alvo, pedidosMeta };
}

const chamadas = (page) =>
  page.evaluate(() =>
    window.fbq ? window.fbq.queue.map((a) => Array.from(a)) : null,
  );

test("ID vazio: sem terceiros, sem cookie, sem aviso", async ({
  page,
  context,
}) => {
  const alvo = await iniciar({ pixelId: "", chave: CHAVE_TESTE });
  try {
    const origens = new Set();
    page.on("request", (r) => origens.add(new URL(r.url()).origin));
    await page.goto(alvo.url, { waitUntil: "networkidle" });
    expect([...origens]).toEqual([new URL(alvo.url).origin]);
    expect(await context.cookies()).toEqual([]);
    await expect(page.locator("#medicao")).toBeHidden();
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
  } finally {
    alvo.fechar();
  }
});

test("Pixel: init e PageView com o ID, sem recusa", async ({ page }) => {
  const { alvo, pedidosMeta } = await abrir(page);
  try {
    expect(pedidosMeta).toEqual([
      "https://connect.facebook.net/en_US/fbevents.js",
    ]);
    expect(await chamadas(page)).toEqual([
      ["init", ID],
      ["track", "PageView"],
    ]);
  } finally {
    alvo.fechar();
  }
});

test("Pixel: clique em Entrar na lista registra ClicouEntrar", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { alvo } = await abrir(page);
  try {
    const botoes = page.locator("[data-entrar]");
    await expect(botoes).toHaveCount(1);
    // sem force: o clique só vale se o botão estiver livre (o aviso fixo não pode cobrir o CTA)
    await botoes.first().click();
    expect(await chamadas(page)).toContainEqual(["trackCustom", "ClicouEntrar"]);
  } finally {
    alvo.fechar();
  }
});

test("Pixel: sem Lead nem noscript ao abrir a página", async ({ page }) => {
  const { alvo } = await abrir(page);
  try {
    const fila = await chamadas(page);
    expect(fila.filter((c) => c.includes("Lead"))).toEqual([]);
    const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
    expect(html).not.toMatch(/facebook\.com\/tr/);
    expect(await page.locator("noscript img").count()).toBe(0);
  } finally {
    alvo.fechar();
  }
});

test("aviso com Entendi e Recusar e o link da política", async ({ page }) => {
  const { alvo } = await abrir(page);
  try {
    const aviso = page.locator("#medicao");
    await expect(aviso).toBeVisible();
    await expect(
      aviso.getByRole("button", { name: "Entendi", exact: true }),
    ).toBeVisible();
    await expect(
      aviso.getByRole("button", { name: "Recusar", exact: true }),
    ).toBeVisible();
    await expect(
      aviso.getByRole("link", { name: "Saiba mais" }),
    ).toHaveAttribute("href", "/privacidade/");
    for (const b of await aviso.getByRole("button").all()) {
      const caixa = await b.boundingBox();
      expect(caixa.height).toBeGreaterThanOrEqual(48);
      expect(caixa.width).toBeGreaterThanOrEqual(48);
    }
  } finally {
    alvo.fechar();
  }
});

for (const via of ["aviso", "rodapé"]) {
  test(`Recusar revoga o consentimento, apaga _fbp e grava recusada (${via})`, async ({
    page,
  }) => {
    const { alvo } = await abrir(page, {
      antes: () => {
        document.cookie = "_fbp=fb.1.1.1; path=/";
      },
    });
    try {
      expect(await page.evaluate(() => document.cookie)).toContain("_fbp=");
      const botao =
        via === "aviso"
          ? page
              .locator("#medicao")
              .getByRole("button", { name: "Recusar", exact: true })
          : page
              .locator("footer")
              .getByRole("button", { name: "Recusar medição" });
      await botao.click();
      expect(await chamadas(page)).toContainEqual(["consent", "revoke"]);
      expect(await page.evaluate(() => document.cookie)).not.toContain("_fbp");
      expect(
        await page.evaluate(() => localStorage.getItem("aurora-medicao")),
      ).toBe("recusada");
      await expect(page.locator("#medicao")).toBeHidden();
    } finally {
      alvo.fechar();
    }
  });
}

test("recusa persiste: nova visita não pede fbevents.js nem mostra o aviso", async ({
  page,
}) => {
  const { alvo, pedidosMeta } = await abrir(page, {
    antes: () => localStorage.setItem("aurora-medicao", "recusada"),
  });
  try {
    expect(pedidosMeta).toEqual([]);
    await expect(page.locator("#medicao")).toBeHidden();
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
    await expect(page.locator("footer button[data-com-pixel]")).toBeHidden();
  } finally {
    alvo.fechar();
  }
});

for (const [largura, altura] of [
  [1280, 720],
  [360, 800],
]) {
  test(`aviso visível não cobre o CTA do topo sem rolar (${largura}x${altura})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largura, height: altura });
    const { alvo } = await abrir(page);
    try {
      await expect(page.locator("#medicao")).toBeVisible();
      const cobertos = await page.evaluate(() =>
        [...document.querySelectorAll("input[type=email]")]
          .map((a) => {
            const r = a.getBoundingClientRect();
            if (r.bottom <= 0 || r.top >= innerHeight) return null;
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const topo = document.elementFromPoint(x, y);
            return a.contains(topo) ? null : topo && topo.tagName;
          })
          .filter(Boolean),
      );
      expect(cobertos).toEqual([]);
      const emViewport = await page
        .locator("input[type=email]")
        .first()
        .evaluate((a) => a.getBoundingClientRect().top < innerHeight);
      expect(emViewport).toBe(true);
    } finally {
      alvo.fechar();
    }
  });
}

test("Recusar antes de o fbevents.js carregar não deixa PageView na fila", async ({
  page,
}) => {
  const alvo = await iniciar({ pixelId: ID, chave: CHAVE_TESTE });
  let liberar;
  const portao = new Promise((r) => (liberar = r));
  await page.route(META, async (rota) => {
    await portao;
    return rota.fulfill({
      contentType: "application/javascript",
      body: FBEVENTS_FALSO,
    });
  });
  try {
    await page.goto(alvo.url, { waitUntil: "domcontentloaded" });
    await page
      .locator("#medicao")
      .getByRole("button", { name: "Recusar", exact: true })
      .click();
    const fila = await chamadas(page);
    expect(fila.filter((c) => c[0] === "track")).toEqual([]);
    expect(fila).toContainEqual(["consent", "revoke"]);
    liberar();
  } finally {
    liberar();
    alvo.fechar();
  }
});

test("depois de Recusar, o clique em Entrar não registra ClicouEntrar", async ({
  page,
}) => {
  const { alvo } = await abrir(page);
  try {
    await page.locator("footer").getByRole("button", { name: "Recusar medição" }).click();
    await page.locator("[data-entrar]").first().click();
    expect(await chamadas(page)).not.toContainEqual([
      "trackCustom",
      "ClicouEntrar",
    ]);
  } finally {
    alvo.fechar();
  }
});

test("Entendi esconde o aviso e grava ciente", async ({ page }) => {
  const { alvo } = await abrir(page);
  try {
    await page
      .locator("#medicao")
      .getByRole("button", { name: "Entendi", exact: true })
      .click();
    await expect(page.locator("#medicao")).toBeHidden();
    expect(
      await page.evaluate(() => localStorage.getItem("aurora-medicao")),
    ).toBe("ciente");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#medicao")).toBeHidden();
    expect((await chamadas(page)).slice(0, 2)).toEqual([
      ["init", ID],
      ["track", "PageView"],
    ]);
  } finally {
    alvo.fechar();
  }
});

test("rodapé declara o Pixel com ID e mantém o texto antigo sem ID", async ({
  page,
}) => {
  const com = await abrir(page);
  try {
    const rodape = page.locator("footer");
    await expect(rodape).toContainText(
      "Esta página usa o Pixel da Meta, que grava o cookie _fbp",
    );
    await expect(rodape).not.toContainText(
      "não usa cookies, rastreadores nem scripts de terceiros",
    );
  } finally {
    com.alvo.fechar();
  }
  const sem = await iniciar({ pixelId: "", chave: CHAVE_TESTE });
  try {
    await page.goto(sem.url, { waitUntil: "networkidle" });
    await expect(page.locator("footer")).toContainText(
      "Esta página não usa cookies, rastreadores nem scripts de terceiros.",
    );
    await expect(page.locator("footer button[data-com-pixel]")).toBeHidden();
  } finally {
    sem.fechar();
  }
});

test("política declara o Pixel e o servidor devolve 404 para caminho inexistente", async ({
  page,
}) => {
  const alvo = await iniciar({ pixelId: "" });
  try {
    const resp = await page.goto(alvo.url + "privacidade/");
    expect(resp.status()).toBe(200);
    const texto = await page.locator("main").innerText();
    for (const trecho of [
      "Pixel da Meta",
      "_fbp",
      "PageView",
      "ClicouEntrar",
      "Finalidade e base legal",
      "legítimo interesse",
      "Como recusar",
      "Recusar medição",
      "aba privativa",
    ]) {
      expect(texto).toContain(trecho);
    }
    expect(texto).not.toMatch(/não usa Pixel/);
    expect((await page.request.get(alvo.url + "nao-existe")).status()).toBe(
      404,
    );
  } finally {
    alvo.fechar();
  }
});

test("o ID commitado em index.html tem a forma de um ID de Pixel", async () => {
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  expect(html).toMatch(/var PIXEL_ID = "\d{15,16}";/);
});
