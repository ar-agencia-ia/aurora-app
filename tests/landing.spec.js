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

const FORMS_TESTE = 'https://forms.example.test/aurora-teste';

// Mede a landing nos dois estados do Portão: o CTA principal só existe no aberto.
for (const estado of ['fechado', 'aberto']) {
  const servir = () => iniciar(estado === 'aberto' ? { formsUrl: FORMS_TESTE } : {});

  test(`sem rolagem horizontal a 360 px (${estado})`, async ({ page }) => {
    const alvo = await servir();
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(alvo.url, { waitUntil: 'networkidle' });
      const { scroll, cliente } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        cliente: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(cliente);
    } finally {
      alvo.fechar();
    }
  });

  test(`alvos de toque de 48 px (${estado})`, async ({ page }) => {
    const alvo = await servir();
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(alvo.url, { waitUntil: 'networkidle' });
      const alvos = await page.evaluate(() =>
        [...document.querySelectorAll('a, button')]
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { texto: el.textContent.trim(), largura: r.width, altura: r.height };
          }),
      );
      expect(alvos.length).toBeGreaterThan(0);
      if (estado === 'aberto') {
        expect(alvos.filter((a) => a.texto === 'Entrar na lista')).toHaveLength(2);
      }
      for (const a of alvos) {
        expect(a.altura, `${a.texto} altura`).toBeGreaterThanOrEqual(48);
        expect(a.largura, `${a.texto} largura`).toBeGreaterThanOrEqual(48);
      }
    } finally {
      alvo.fechar();
    }
  });
}

test('composição da landing', async ({ page }) => {
  const aberto = await iniciar({ formsUrl: FORMS_TESTE });
  try {
    await page.goto(aberto.url, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cuide de você antes que o dia comece.');
    const praticas = await page.locator('#praticas .tile b').allTextContents();
    expect(praticas).toEqual(['Silêncio', 'Visualização', 'Leitura', 'Afirmações', 'Exercício', 'Diário']);
    const passos = await page.locator('#passos ol > li strong').allTextContents();
    expect(passos).toEqual([
      'Entre na lista.',
      'Receba o convite.',
      'Use o app e dê feedback por no mínimo 14 dias.',
    ]);
    // ordem das regiões: promessa com o mosaico, passos, cadastro, rodapé
    const ordem = await page.evaluate(() => {
      const seguinte = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const [promessa, praticasEl, passosEl, cadastro, rodape] = ['#promessa', '#praticas', '#passos', '#cadastro-fim', 'footer']
        .map((q) => document.querySelector(q));
      return [seguinte(promessa, passosEl), seguinte(praticasEl, passosEl), seguinte(passosEl, cadastro), seguinte(cadastro, rodape)];
    });
    expect(ordem).toEqual([true, true, true, true]);
  } finally {
    aberto.fechar();
  }
});

test('disposição a 1280 px: hero em duas colunas, mosaico 3x2 na ordem do canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(site.url, { waitUntil: 'networkidle' });
  const caixa = async (seletor) => {
    const b = await page.locator(seletor).first().boundingBox();
    expect(b, seletor).not.toBeNull();
    return b;
  };
  // hero: o texto fica à esquerda do mosaico, lado a lado
  const titulo = await caixa('#promessa h1');
  const mosaico = await caixa('.mosaico');
  expect(titulo.x + titulo.width, 'texto à esquerda do mosaico').toBeLessThanOrEqual(mosaico.x);
  expect(Math.abs(titulo.y - mosaico.y), 'texto e mosaico começam na mesma faixa').toBeLessThan(mosaico.height);
  // mosaico: 3 colunas e 2 linhas
  const tiles = [];
  for (const el of await page.locator('.mosaico .tile').all()) {
    tiles.push({ nome: await el.locator('b').textContent(), ...(await el.boundingBox()) });
  }
  expect(tiles).toHaveLength(6);
  const arred = (n) => Math.round(n);
  const colunas = [...new Set(tiles.map((t) => arred(t.x)))];
  expect(colunas, 'colunas').toHaveLength(3);
  // ordem visual por (y, x) igual à do canvas C3: S-A-V-E-L-D
  const visual = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const primeiraLinha = visual.slice(0, 3);
  const segundaLinha = visual.slice(3);
  // duas linhas: nenhum tile da 2ª começa antes do fim do menor da 1ª
  const fimPrimeira = Math.min(...primeiraLinha.map((t) => t.y + t.height));
  for (const t of segundaLinha) expect(t.y, `${t.nome} na 2ª linha`).toBeGreaterThanOrEqual(fimPrimeira);
  const porColuna = (grupo) => [...grupo].sort((a, b) => a.x - b.x).map((t) => t.nome);
  expect([...porColuna(primeiraLinha), ...porColuna(segundaLinha)]).toEqual([
    'Silêncio', 'Afirmações', 'Visualização', 'Exercício', 'Leitura', 'Diário',
  ]);
  // tiles 2 e 5 (Afirmações, Leitura) deslocados para baixo em relação aos vizinhos de linha
  const por = Object.fromEntries(tiles.map((t) => [t.nome, t]));
  expect(por['Afirmações'].y - por['Silêncio'].y, 'Afirmações deslocado').toBeGreaterThanOrEqual(20);
  expect(por['Afirmações'].y - por['Visualização'].y, 'Afirmações deslocado').toBeGreaterThanOrEqual(20);
  expect(por['Leitura'].y - por['Exercício'].y, 'Leitura deslocado').toBeGreaterThanOrEqual(20);
  expect(por['Leitura'].y - por['Diário'].y, 'Leitura deslocado').toBeGreaterThanOrEqual(20);
  expect(Math.abs(por['Silêncio'].y - por['Visualização'].y), 'Silêncio e Visualização alinhados').toBeLessThan(2);
  expect(Math.abs(por['Exercício'].y - por['Diário'].y), 'Exercício e Diário alinhados').toBeLessThan(2);
});

test('abrir o Portão mostra Entrar na lista com a URL do Forms', async ({ page }) => {
  const aberto = await iniciar({ formsUrl: FORMS_TESTE });
  try {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(aberto.url, { waitUntil: 'networkidle' });
    const botoes = page.getByRole('link', { name: 'Entrar na lista' });
    await expect(botoes).toHaveCount(2);
    for (const botao of await botoes.all()) {
      await expect(botao).toBeVisible();
      await expect(botao).toHaveAttribute('href', FORMS_TESTE);
    }
    await expect(page.getByText('As inscrições ainda não abriram.')).toBeHidden();
    for (const botao of await botoes.all()) {
      const alvo = await botao.boundingBox();
      expect(alvo.height).toBeGreaterThanOrEqual(48);
    }
  } finally {
    aberto.fechar();
  }
});
