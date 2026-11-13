const { test, expect } = require("@playwright/test");
const { iniciar } = require("./servidor");

const CHAVE = "chave-de-teste-web3forms";
const ID_PIXEL = "111222333444555";
const ENDPOINT = "https://api.web3forms.com/submit";
const OK = { success: true, message: "Email sent successfully!" };

// Sobe a landing aberta (chave de teste) e intercepta o serviço: nenhuma chamada sai para a rede real.
// `resposta` pode ser trocada no meio do teste; { rede: true } derruba a conexão.
async function abrir(
  page,
  { busca = "", pixel = false, resposta = { status: 200, corpo: OK } } = {},
) {
  const alvo = await iniciar({ chave: CHAVE, pixelId: pixel ? ID_PIXEL : "" });
  const estado = { pedidos: [], resposta };
  await page.route(ENDPOINT, async (rota) => {
    estado.pedidos.push({
      metodo: rota.request().method(),
      corpo: rota.request().postDataJSON(),
    });
    if (estado.esperar) await estado.esperar;
    if (estado.resposta.rede) return rota.abort("failed");
    return rota.fulfill({
      status: estado.resposta.status,
      contentType: "application/json",
      body: JSON.stringify(estado.resposta.corpo),
    });
  });
  if (pixel) {
    // fbevents.js falso: o snippet padrão enfileira as chamadas em fbq.queue; nada chega ao Pixel real
    await page.route("**/connect.facebook.net/**", (rota) =>
      rota.fulfill({
        contentType: "application/javascript",
        body: "window.__fbeventsCarregado = true;",
      }),
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(alvo.url + busca, { waitUntil: "networkidle" });
  return { alvo, estado };
}

const gmail = (page) => page.getByLabel("Seu Gmail");
const android = (page) => page.getByLabel("Uso um celular Android");
const aceite = (page) => page.getByLabel(/^Aceito participar do teste fechado/);
const aviso = (page) => page.getByLabel(/^Opcional: quero ser avisado/);
const entrar = (page) => page.getByRole("button", { name: "Entrar na lista" });
const chamadas = (page) =>
  page.evaluate(() =>
    window.fbq ? window.fbq.queue.map((a) => Array.from(a)) : null,
  );
const leads = async (page) =>
  ((await chamadas(page)) || []).filter(
    (c) => c[0] === "track" && c[1] === "Lead",
  );

async function preencher(page, email = "pessoa@gmail.com") {
  await gmail(page).fill(email);
  await android(page).check();
  await aceite(page).check();
}

test("envia cadastro valido com utm", async ({ page }) => {
  const { alvo, estado } = await abrir(page, {
    busca:
      "?utm_source=meta&utm_medium=paid&utm_campaign=leads&utm_content=a1&utm_term=t1&outro=x",
  });
  try {
    await preencher(page, "  Pessoa@Gmail.com  ");
    await aviso(page).check();
    const [pedido] = await Promise.all([
      page.waitForRequest(ENDPOINT),
      entrar(page).click(),
    ]);
    expect(pedido.method()).toBe("POST");
    expect(estado.pedidos).toHaveLength(1);
    expect(estado.pedidos[0].corpo).toMatchObject({
      access_key: CHAVE,
      email: "Pessoa@Gmail.com",
      android: "sim",
      aceite: "sim",
      aviso: "sim",
      utm_source: "meta",
      utm_medium: "paid",
      utm_campaign: "leads",
      utm_content: "a1",
      utm_term: "t1",
    });
    expect(estado.pedidos[0].corpo).not.toHaveProperty("outro");
  } finally {
    alvo.fechar();
  }
});

test("subject fixo", async ({ page }) => {
  const { alvo, estado } = await abrir(page);
  try {
    await preencher(page);
    await Promise.all([page.waitForRequest(ENDPOINT), entrar(page).click()]);
    expect(estado.pedidos[0].corpo.subject).toBe("Aurora cadastro");
  } finally {
    alvo.fechar();
  }
});

test("bloqueia gmail invalido", async ({ page }) => {
  const { alvo, estado } = await abrir(page);
  try {
    for (const [valor, mensagem] of [
      ["", "Informe o seu Gmail."],
      [
        "pessoa@outlook.com",
        "Use um endereço do Gmail, que termina em @gmail.com.",
      ],
      [
        "pessoa@gmail.com.br",
        "Use um endereço do Gmail, que termina em @gmail.com.",
      ],
      ["pessoa", "Use um endereço do Gmail, que termina em @gmail.com."],
    ]) {
      await android(page).check();
      await aceite(page).check();
      await gmail(page).fill(valor);
      await entrar(page).click();
      const erro = page.locator("#erro-email");
      await expect(erro, valor).toHaveText(mensagem);
      await expect(gmail(page), valor).toHaveAttribute(
        "aria-describedby",
        "erro-email",
      );
      await expect(gmail(page), valor).toHaveAttribute("aria-invalid", "true");
      await expect(erro, valor).toHaveAttribute("aria-live", "polite");
      // ao lado do campo: a mensagem vem logo depois do input
      const [c, e] = [
        await gmail(page).boundingBox(),
        await erro.boundingBox(),
      ];
      expect(e.y, valor).toBeGreaterThanOrEqual(c.y + c.height - 1);
      expect(e.y - (c.y + c.height), valor).toBeLessThan(32);
    }
    expect(estado.pedidos, "nenhuma chamada à rede").toHaveLength(0);

    // googlemail.com passa, em qualquer caixa
    await gmail(page).fill("Pessoa@GoogleMail.com");
    await Promise.all([page.waitForRequest(ENDPOINT), entrar(page).click()]);
    expect(estado.pedidos).toHaveLength(1);
    expect(estado.pedidos[0].corpo.email).toBe("Pessoa@GoogleMail.com");
  } finally {
    alvo.fechar();
  }
});

test("bloqueia sem android ou aceite", async ({ page }) => {
  const { alvo, estado } = await abrir(page);
  try {
    await gmail(page).fill("pessoa@gmail.com");
    await aceite(page).check();
    await entrar(page).click();
    await expect(page.locator("#erro-android")).toHaveText(
      "Marque que você usa um celular Android.",
    );
    await expect(page.locator("#erro-aceite")).toHaveText("");
    await expect(android(page)).toHaveAttribute(
      "aria-describedby",
      "erro-android",
    );

    await android(page).check();
    await aceite(page).uncheck();
    await entrar(page).click();
    await expect(page.locator("#erro-aceite")).toHaveText(
      "Marque o aceite para entrar na lista.",
    );
    await expect(page.locator("#erro-android")).toHaveText("");
    await expect(aceite(page)).toHaveAttribute(
      "aria-describedby",
      "erro-aceite",
    );

    expect(estado.pedidos, "nenhuma chamada à rede").toHaveLength(0);
  } finally {
    alvo.fechar();
  }
});

test("aviso opcional desmarcado", async ({ page }) => {
  const { alvo, estado } = await abrir(page);
  try {
    await expect(aviso(page)).not.toBeChecked();
    await preencher(page);
    await Promise.all([page.waitForRequest(ENDPOINT), entrar(page).click()]);
    expect(estado.pedidos).toHaveLength(1);
    expect(estado.pedidos[0].corpo.aviso).toBe("nao");
  } finally {
    alvo.fechar();
  }
});

test("estado enviando desabilita o botao e a confirmacao fica na pagina", async ({
  page,
}) => {
  const { alvo, estado } = await abrir(page);
  try {
    let liberar;
    estado.esperar = new Promise((r) => {
      liberar = r;
    });
    await preencher(page);
    await entrar(page).click();
    const botao = page.locator("#entrar");
    await expect(botao).toHaveAttribute("aria-disabled", "true");
    await expect(botao).toBeFocused();
    await expect(botao).toHaveText("Enviando…");
    liberar();
    await expect(page.locator("#cadastro-ok")).toBeVisible();
    await expect(page.locator("#cadastro-ok")).toContainText(
      "Você está na lista.",
    );
    await expect(page.locator("#form-cadastro")).toBeHidden();
    expect(page.url().startsWith(alvo.url)).toBe(true);
  } finally {
    alvo.fechar();
  }
});

test("sucesso confirma e dispara Lead", async ({ page }) => {
  const { alvo, estado } = await abrir(page, { pixel: true });
  try {
    await page
      .locator("#medicao")
      .getByRole("button", { name: "Entendi" })
      .click();
    expect(await leads(page)).toHaveLength(0);
    await preencher(page);
    await entrar(page).click();
    await expect(page.locator("#cadastro-ok")).toBeVisible();
    expect(estado.pedidos).toHaveLength(1);
    expect(await leads(page)).toEqual([["track", "Lead"]]);
  } finally {
    alvo.fechar();
  }
});

test("sem resposta em 15 s o envio falha, mantém dados e não dispara Lead", async ({
  page,
}) => {
  await page.clock.install();
  const { alvo, estado } = await abrir(page, { pixel: true });
  try {
    estado.esperar = new Promise(() => {});
    await preencher(page);
    await entrar(page).click();
    await expect(page.locator("#entrar")).toHaveAttribute("aria-disabled", "true");
    await page.clock.fastForward(15500);
    await expect(page.locator("#erro-envio")).toContainText("Não foi possível enviar");
    await expect(page.locator("#entrar")).not.toHaveAttribute("aria-disabled", "true");
    await expect(gmail(page)).toHaveValue("pessoa@gmail.com");
    await expect(page.locator("#cadastro-ok")).toBeHidden();
    expect(await leads(page)).toHaveLength(0);
  } finally {
    alvo.fechar();
  }
});

test("sem Lead apos Recusar mesmo com localStorage bloqueado", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("bloqueado");
    };
    Storage.prototype.getItem = () => {
      throw new Error("bloqueado");
    };
  });
  const { alvo } = await abrir(page, { pixel: true });
  try {
    await page
      .locator("#medicao")
      .getByRole("button", { name: "Recusar", exact: true })
      .click();
    await preencher(page);
    await entrar(page).click();
    await expect(page.locator("#cadastro-ok")).toBeVisible();
    expect(await leads(page)).toHaveLength(0);
  } finally {
    alvo.fechar();
  }
});

test("sem Lead se medicao recusada", async ({ page }) => {
  // recusa durante a visita
  const { alvo, estado } = await abrir(page, { pixel: true });
  try {
    await page
      .locator("#medicao")
      .getByRole("button", { name: "Recusar", exact: true })
      .click();
    await preencher(page);
    await entrar(page).click();
    await expect(page.locator("#cadastro-ok")).toBeVisible();
    expect(estado.pedidos).toHaveLength(1);
    expect(await leads(page)).toHaveLength(0);
  } finally {
    alvo.fechar();
  }
  // recusa guardada de uma visita anterior: o Pixel nem carrega
  const outro = await abrir(page, { pixel: true });
  try {
    await page.evaluate(() =>
      localStorage.setItem("aurora-medicao", "recusada"),
    );
    await page.reload({ waitUntil: "networkidle" });
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
    await preencher(page);
    await entrar(page).click();
    await expect(page.locator("#cadastro-ok")).toBeVisible();
    expect(await leads(page)).toHaveLength(0);
  } finally {
    outro.alvo.fechar();
  }
});

test("falha do servico mantem dados", async ({ page }) => {
  const casos = [
    {
      nome: "400",
      resposta: {
        status: 400,
        corpo: { success: false, message: "Invalid key" },
      },
    },
    {
      nome: "429",
      resposta: {
        status: 429,
        corpo: { success: false, message: "Too many requests" },
      },
    },
    {
      nome: "500",
      resposta: {
        status: 500,
        corpo: { success: false, message: "Server error" },
      },
    },
    { nome: "rede", resposta: { rede: true } },
  ];
  for (const caso of casos) {
    const { alvo, estado } = await abrir(page, {
      pixel: true,
      resposta: caso.resposta,
    });
    try {
      await page
        .locator("#medicao")
        .getByRole("button", { name: "Entendi" })
        .click();
      await preencher(page, "pessoa@gmail.com");
      await aviso(page).check();
      await entrar(page).click();
      await expect(page.locator("#erro-envio"), caso.nome).toContainText(
        "Não foi possível enviar agora",
      );
      // dados mantidos, formulário ainda à vista, botão liberado e sem Lead
      await expect(gmail(page), caso.nome).toHaveValue("pessoa@gmail.com");
      await expect(android(page), caso.nome).toBeChecked();
      await expect(aceite(page), caso.nome).toBeChecked();
      await expect(aviso(page), caso.nome).toBeChecked();
      await expect(page.locator("#entrar"), caso.nome).not.toHaveAttribute("aria-disabled", "true");
      await expect(page.locator("#erro-envio"), caso.nome).toContainText("contato@auroramanha.com.br");
      await expect(page.locator("#entrar"), caso.nome).toHaveText(
        "Entrar na lista",
      );
      await expect(page.locator("#cadastro-ok"), caso.nome).toBeHidden();
      expect(await leads(page), caso.nome).toHaveLength(0);
      // tentar de novo funciona
      estado.resposta = { status: 200, corpo: OK };
      await entrar(page).click();
      await expect(page.locator("#cadastro-ok"), caso.nome).toBeVisible();
      expect(estado.pedidos, caso.nome).toHaveLength(2);
      expect(await leads(page), caso.nome).toHaveLength(1);
    } finally {
      alvo.fechar();
    }
  }
});

test("botcheck", async ({ page }) => {
  const { alvo, estado } = await abrir(page, { pixel: true });
  try {
    // campo oculto para pessoas: fora do foco por teclado e escondido dos leitores de tela
    const campo = page.locator('#form-cadastro input[name="botcheck"]');
    await expect(campo).toHaveCount(1);
    await expect(campo).toHaveAttribute("tabindex", "-1");
    await expect(campo).toHaveAttribute("autocomplete", "off");
    expect(
      await campo.evaluate((el) => el.closest('[aria-hidden="true"]') !== null),
    ).toBe(true);
    const caixa = await campo.locator("xpath=..").boundingBox();
    expect(caixa.width).toBeLessThanOrEqual(1);

    await preencher(page);
    await campo.evaluate((el) => {
      el.checked = true;
    });
    await entrar(page).click();
    // confirmação falsa: o robô (ou o gerenciador de senhas) vê sucesso, mas nada vai à rede
    await expect(page.locator("#cadastro-ok")).toBeVisible();
    expect(estado.pedidos, "envio ignorado sem chamar a rede").toHaveLength(0);
    expect(await leads(page), "sem Lead").toHaveLength(0);
  } finally {
    alvo.fechar();
  }
});

// O aviso fixo #medicao não pode cobrir os campos: depois de rolar até cada um do jeito mais curto
// (focus(), o que o navegador faz ao navegar com Tab), o centro do campo é o próprio campo.
for (const [largura, altura] of [
  [1280, 720],
  [360, 800],
]) {
  test(`aviso de medicao nao cobre os campos do formulario (${largura}x${altura})`, async ({
    page,
  }) => {
    const { alvo } = await abrir(page, { pixel: true });
    try {
      await page.setViewportSize({ width: largura, height: altura });
      await expect(page.locator("#medicao")).toBeVisible();
      const campos = [
        "#gmail",
        'input[name="android"]',
        'input[name="aceite"]',
        'input[name="aviso"]',
        "#entrar",
      ];
      for (const seletor of campos) {
        const resultado = await page.evaluate((s) => {
          const el = document.querySelector(s);
          el.focus();
          const r = el.getBoundingClientRect();
          const topo = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
          );
          const aviso = document.getElementById("medicao").getBoundingClientRect();
          return {
            ok: topo === el || el.contains(topo),
            fimDoCampo: r.bottom,
            inicioDoAviso: aviso.top,
          };
        }, seletor);
        expect(
          resultado.ok,
          `${seletor} a ${largura}x${altura}: coberto pelo aviso (campo termina em ${resultado.fimDoCampo}, aviso começa em ${resultado.inicioDoAviso})`,
        ).toBe(true);
      }
    } finally {
      alvo.fechar();
    }
  });
}

test("erro marca os três campos com aria-invalid e alinha o erro ao item", async ({
  page,
}) => {
  const { alvo } = await abrir(page);
  try {
    await entrar(page).click();
    for (const campo of [gmail(page), android(page), aceite(page)]) {
      await expect(campo).toHaveAttribute("aria-invalid", "true");
    }
    // o erro do checkbox começa no texto do item, não na margem do cartão
    const [texto, erro] = [
      await page.locator("label.opcao span").first().boundingBox(),
      await page.locator("#erro-android").boundingBox(),
    ];
    expect(Math.abs(erro.x + 36 - texto.x)).toBeLessThan(2);
    // corrigir limpa a marca
    await gmail(page).fill("pessoa@gmail.com");
    await android(page).check();
    await aceite(page).check();
    await Promise.all([page.waitForRequest(ENDPOINT), entrar(page).click()]);
    for (const campo of [gmail(page), android(page), aceite(page)]) {
      await expect(campo).toHaveAttribute("aria-invalid", "false");
    }
  } finally {
    alvo.fechar();
  }
});

test("segundo clique durante o envio não repete o pedido", async ({ page }) => {
  const { alvo, estado } = await abrir(page);
  try {
    let liberar;
    estado.esperar = new Promise((r) => {
      liberar = r;
    });
    await preencher(page);
    await entrar(page).click();
    await expect(page.locator("#entrar")).toHaveAttribute("aria-disabled", "true");
    await page.locator("#entrar").click({ force: true });
    liberar();
    await expect(page.locator("#cadastro-ok")).toBeVisible();
    expect(estado.pedidos).toHaveLength(1);
  } finally {
    alvo.fechar();
  }
});

test("sucesso mostra o Gmail, lembra do spam e permite corrigir", async ({
  page,
}) => {
  const { alvo, estado } = await abrir(page);
  try {
    await preencher(page, "pessoa@gmail.com");
    await entrar(page).click();
    const ok = page.locator("#cadastro-ok");
    await expect(ok).toContainText("Vamos mandar o convite para pessoa@gmail.com.");
    await expect(ok).toContainText("Se não chegar, olhe a caixa de spam.");
    await expect(ok).not.toContainText(/gratuito|minutos|horas|prazo/i);
    await page.getByRole("button", { name: "Corrigir o Gmail" }).click();
    await expect(page.locator("#form-cadastro")).toBeVisible();
    await expect(ok).toBeHidden();
    await expect(gmail(page)).toBeFocused();
    await expect(gmail(page)).toHaveValue("pessoa@gmail.com");
    expect(estado.pedidos).toHaveLength(1);
  } finally {
    alvo.fechar();
  }
});

test("sem rolagem horizontal a 200% de zoom em 390 px, com formulário e erros", async ({
  page,
}) => {
  const { alvo } = await abrir(page);
  try {
    await page.setViewportSize({ width: 195, height: 600 });
    await entrar(page).click();
    const { scroll, cliente } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(cliente);
  } finally {
    alvo.fechar();
  }
});

for (const [largura, altura] of [
  [390, 844],
  [1280, 720],
]) {
  test(`CTA dentro da primeira tela (${largura}x${altura})`, async ({ page }) => {
    const { alvo } = await abrir(page);
    try {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto(alvo.url, { waitUntil: "networkidle" });
      const caixa = await entrar(page).boundingBox();
      expect(caixa.y + caixa.height).toBeLessThanOrEqual(altura);
      if (largura >= 960) {
        const h1 = await page.evaluate(() =>
          parseFloat(getComputedStyle(document.querySelector("h1")).fontSize),
        );
        expect(h1).toBeLessThanOrEqual(48);
      }
    } finally {
      alvo.fechar();
    }
  });
}
