const { test, expect } = require('@playwright/test');
const { iniciar } = require('./servidor');

let site;
test.beforeAll(async () => { site = await iniciar(); });
test.afterAll(() => site.fechar());

test('sem terceiros nem cookie', async ({ page, context }) => {
  const origens = new Set();
  page.on('request', (r) => origens.add(new URL(r.url()).origin));
  await page.goto(site.url, { waitUntil: 'networkidle' });
  expect([...origens]).toEqual([new URL(site.url).origin]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test('sem rolagem horizontal a 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(site.url, { waitUntil: 'networkidle' });
  const { scroll, cliente } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    cliente: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(cliente);
});

test('alvos de toque de 48 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(site.url, { waitUntil: 'networkidle' });
  const alvos = await page.evaluate(() =>
    [...document.querySelectorAll('a, button')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { texto: el.textContent.trim(), largura: r.width, altura: r.height };
      }),
  );
  expect(alvos.length).toBeGreaterThan(0);
  for (const a of alvos) {
    expect(a.altura, `${a.texto} altura`).toBeGreaterThanOrEqual(48);
    expect(a.largura, `${a.texto} largura`).toBeGreaterThanOrEqual(48);
  }
});

test('abrir o Portão mostra Entrar na lista com a URL do Forms', async ({ page }) => {
  const aberto = await iniciar({ formsUrl: 'https://forms.example.test/aurora-teste' });
  try {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(aberto.url, { waitUntil: 'networkidle' });
    const botao = page.getByRole('link', { name: 'Entrar na lista' });
    await expect(botao).toBeVisible();
    await expect(botao).toHaveAttribute('href', 'https://forms.example.test/aurora-teste');
    await expect(page.getByText('As inscrições ainda não abriram.')).toBeHidden();
    const alvo = await botao.boundingBox();
    expect(alvo.height).toBeGreaterThanOrEqual(48);
  } finally {
    aberto.fechar();
  }
});
