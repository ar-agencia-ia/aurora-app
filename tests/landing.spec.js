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
const EMAIL = 'contato@auroramanha.com.br';

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

test('copy do canvas: selo, práticas, passos e banda "Pronto para ajudar?"', async ({ page }) => {
  const frases = [
    'Abra um espaço de calma antes da correria.',
    'Imagine com clareza como você quer viver o seu dia.',
    'Crie o hábito de ler todos os dias.',
    'Comece o dia com frases que reforçam o que você quer cultivar.',
    'Mova o corpo e mantenha a constância.',
    'Coloque pensamentos e gratidão no papel.',
  ];
  const textosPassos = [
    'Você entra com a sua conta Google e confirma que usa Android.',
    'Mandamos por e-mail o link para instalar o app pela Google Play.',
    'Use a rotina no seu dia a dia e envie o seu retorno durante todo o período do teste.',
  ];
  for (const estado of ['fechado', 'aberto']) {
    const alvo = await iniciar(estado === 'aberto' ? { formsUrl: FORMS_TESTE } : {});
    try {
      await page.goto(alvo.url, { waitUntil: 'networkidle' });
      await expect(page.locator('header .selo'), estado).toHaveText('Teste fechado no Android');
      // ordem do DOM: Silêncio, Visualização, Leitura, Afirmações, Exercício, Diário
      expect(await page.locator('#praticas .tile span').allTextContents(), estado).toEqual(frases);
      expect(await page.locator('#passos ol > li p').allTextContents(), estado).toEqual(textosPassos);
      // textos soltos do canvas VersaoC3.dc.html, literais (não derivados do index.html)
      await expect(page.locator('header .marca'), estado).toHaveText('Aurora');
      await expect(page.locator('#promessa p.lead'), estado).toHaveText(
        'O Aurora é um app de organização da rotina matinal. Ele reúne seis práticas em um só lugar e mostra no Painel do dia o que você já fez e a sua sequência de dias.',
      );
      await expect(page.locator('#promessa p.lead + p.suave'), estado).toHaveText(
        'Estamos formando o grupo do teste fechado: antes de chegar à loja, o Google exige que o app seja testado por pessoas de verdade. Você pode ajudar.',
      );
      await expect(page.locator('#praticas h2.sr'), estado).toHaveText('As seis práticas');
      await expect(page.locator('.nota-mosaico'), estado).toHaveText(
        'Você escolhe quais fazem parte da sua manhã, a ordem e quanto tempo dedicar a cada uma.',
      );
      await expect(page.locator('#titulo-passos'), estado).toHaveText('Como funciona o teste');
      expect(await page.locator('#passos .n').allTextContents(), estado).toEqual(['1', '2', '3']);
      const rodape = page.locator('footer p');
      await expect(rodape.nth(0), estado).toHaveText(
        'O Aurora não é o app oficial do Método Milagre da Manhã nem tem vínculo com o autor ou a editora.',
      );
      await expect(rodape.nth(1), estado).toHaveText('O Aurora não substitui orientação médica ou psicológica.');
      // divergência de propósito: o canvas diz "serviços de terceiros" e o index cita scripts de terceiros e o GitHub Pages
      await expect(rodape.nth(2), estado).toHaveText(
        'Esta página não usa cookies, rastreadores nem scripts de terceiros. Ela é hospedada no GitHub Pages e o formulário de inscrição é do Google Forms.',
      );
      // divergência de propósito: o canvas traz o Gmail do autor e o index traz contato@auroramanha.com.br (AC 30)
      await expect(rodape.nth(3), estado).toHaveText(`Dúvidas ou pedido de exclusão: ${EMAIL}.`);
      const fechado = page.locator('#portao-fechado');
      const bloco = page.locator('#portao-aberto');
      const banda = page.locator('#cadastro-fim');
      if (estado === 'aberto') {
        await expect(bloco.locator('p').nth(0)).toHaveText(
          'Ao entrar você deixa o seu Gmail, confirma que usa Android e aceita participar do teste. Se quiser, marque a opção de aviso de lançamento.',
        );
        await expect(bloco.locator('p').nth(1)).toHaveText(
          'Só para Android. O formulário abre no Google Forms; a política de privacidade, no rodapé, diz por quanto tempo guardamos os dados e como pedir a exclusão.',
        );
        await expect(fechado).toBeHidden();
        await expect(bloco).toBeVisible();
      } else {
        await expect(fechado).toHaveText('As inscrições ainda não abriram. Volte em breve.');
        await expect(fechado).toBeVisible();
        await expect(page.locator('#cadastro p').nth(1)).toHaveText(`Dúvidas? Escreva para ${EMAIL}.`);
        await expect(bloco).toBeHidden();
      }
      if (estado === 'aberto') {
        await expect(banda).toBeVisible();
        await expect(banda.getByRole('heading', { level: 2, name: 'Pronto para ajudar?', exact: true })).toBeVisible();
      } else {
        await expect(banda).toBeHidden();
        await expect(page.getByText('Pronto para ajudar?')).toBeHidden();
      }
    } finally {
      alvo.fechar();
    }
  }
});

test('atributos e estrutura do canvas e e-mail de contato nos dois estados', async ({ page }) => {
  const tiles = {
    Silêncio: 'silencio', Visualização: 'visualizacao', Leitura: 'leitura',
    Afirmações: 'afirmacoes', Exercício: 'exercicio', Diário: 'diario',
  };
  for (const estado of ['fechado', 'aberto']) {
    const alvo = await iniciar(estado === 'aberto' ? { formsUrl: FORMS_TESTE } : {});
    try {
      await page.goto(alvo.url, { waitUntil: 'networkidle' });
      // e-mail de contato: texto e href literais no bloco fechado e no rodapé (AC 30)
      for (const email of [page.locator('#cadastro a[href^="mailto:"]'), page.locator('footer a[href^="mailto:"]')]) {
        await expect(email, estado).toHaveCount(1);
        await expect(email, estado).toHaveText(EMAIL);
        await expect(email, estado).toHaveAttribute('href', `mailto:${EMAIL}`);
      }
      // o canvas fixa alt="" (decorativas) nas 7 imagens, lang pt-BR e aria-hidden nos numerais
      await expect(page.locator('img'), estado).toHaveCount(7);
      for (const img of await page.locator('img').all()) await expect(img, estado).toHaveAttribute('alt', '');
      await expect(page.locator('html'), estado).toHaveAttribute('lang', 'pt-BR');
      await expect(page.locator('#passos .n'), estado).toHaveCount(3);
      for (const n of await page.locator('#passos .n').all()) await expect(n, estado).toHaveAttribute('aria-hidden', 'true');
      // h2 dos passos e <strong> do teste fechado
      await expect(page.getByRole('heading', { level: 2, name: 'Como funciona o teste', exact: true }), estado).toHaveCount(1);
      await expect(page.locator('#promessa p.suave strong'), estado).toHaveText('teste fechado');
      // a imagem certa em cada tile
      for (const [nome, arquivo] of Object.entries(tiles)) {
        const tile = page.locator('#praticas .tile').filter({ has: page.locator('b', { hasText: new RegExp(`^${nome}$`) }) });
        await expect(tile.locator('img'), `${estado} ${nome}`).toHaveAttribute('src', `assets/${arquivo}.webp`);
      }
      // o link da política é o primeiro filho do rodapé e tem nome acessível exato
      const primeiro = page.locator('footer > :first-child');
      await expect(primeiro, estado).toHaveText('Política de privacidade');
      expect(await primeiro.evaluate((el) => el.tagName), estado).toBe('A');
      await expect(page.getByRole('link', { name: 'Política de privacidade', exact: true }), estado).toHaveCount(1);
      // só do index.html (O6): aria-labelledby das regiões e o <noscript> do bloco fechado
      await expect(page.locator('#promessa'), estado).toHaveAttribute('aria-labelledby', 'titulo');
      await expect(page.locator('#passos'), estado).toHaveAttribute('aria-labelledby', 'titulo-passos');
      // com JavaScript ativo o navegador trata o <noscript> como texto cru, então lê-se o textContent
      expect(await page.locator('#cadastro noscript').evaluate((el) => el.textContent), estado).toContain(
        'Se as inscrições já tiverem aberto, o botão de entrada só aparece com o JavaScript ativo.',
      );
    } finally {
      alvo.fechar();
    }
  }
});

test('estrutura semântica, arranjo do hero e head nos dois estados', async ({ page }) => {
  const metas = {
    'meta[name="viewport"]': 'width=device-width, initial-scale=1',
    'meta[name="description"]': 'Cuide de você antes que o dia comece. Ajude a testar o Aurora, um app Android de rotina matinal com seis práticas. Teste fechado de 14 dias.',
    'meta[name="theme-color"]': '#F8F9FF',
    'meta[property="og:type"]': 'website',
    'meta[property="og:locale"]': 'pt_BR',
    'meta[property="og:title"]': 'Aurora — teste fechado no Android',
    'meta[property="og:description"]': 'Cuide de você antes que o dia comece. Ajude a testar o Aurora, um app Android de rotina matinal com seis práticas.',
    'meta[property="og:image"]': 'https://auroramanha.com.br/og.png',
    'meta[property="og:image:width"]': '1200',
    'meta[property="og:image:height"]': '630',
  };
  for (const estado of ['fechado', 'aberto']) {
    const alvo = await iniciar(estado === 'aberto' ? { formsUrl: FORMS_TESTE } : {});
    try {
      await page.goto(alvo.url, { waitUntil: 'networkidle' });
      // head: viewport (sem ele o celular do anúncio renderiza a 980 px), título e pré-visualização do anúncio
      await expect(page, estado).toHaveTitle('Aurora — teste fechado no Android');
      for (const [seletor, valor] of Object.entries(metas)) {
        await expect(page.locator(seletor), `${estado} ${seletor}`).toHaveCount(1);
        await expect(page.locator(seletor), `${estado} ${seletor}`).toHaveAttribute('content', valor);
      }
      await expect(page.locator('link[rel="icon"]'), estado).toHaveAttribute('href', 'icon.png');
      await expect(page.locator('link[rel="apple-touch-icon"]'), estado).toHaveAttribute('href', 'icon.png');
      const css = await page.locator('style').first().textContent();
      for (const fonte of ['Roboto-Regular', 'Roboto-Medium']) {
        expect(css, `${estado} ${fonte}`).toContain(`url(fonts/${fonte}.woff2)`);
        expect((await page.request.get(`${alvo.url}fonts/${fonte}.woff2`)).status(), `${estado} ${fonte}`).toBe(200);
      }

      // <main> com hero, mosaico, passos e banda; <footer> fora dele
      const main = page.getByRole('main');
      await expect(main, estado).toHaveCount(1);
      for (const q of ['.hero', '#promessa', '#praticas', '#passos', '#cadastro-fim']) {
        await expect(main.locator(q), `${estado} ${q} dentro do main`).toHaveCount(1);
      }
      await expect(page.getByRole('contentinfo'), estado).toHaveCount(1);
      await expect(main.locator('footer'), estado).toHaveCount(0);
      expect(await page.locator('footer').evaluate((f) => f.parentElement.tagName), estado).toBe('BODY');
      // passos: <section> com nome acessível, <ol> de 3 itens
      expect(await page.locator('#passos').evaluate((e) => e.tagName), estado).toBe('SECTION');
      await expect(page.getByRole('region', { name: 'Como funciona o teste', exact: true }), estado).toHaveCount(1);
      await expect(page.locator('#passos').getByRole('list'), estado).toHaveCount(1);
      await expect(page.locator('#passos').getByRole('listitem'), estado).toHaveCount(3);
      // mosaico: 2 listas e 6 <li class="tile">
      const tiles = page.locator('#praticas .tile');
      await expect(tiles, estado).toHaveCount(6);
      expect(await tiles.evaluateAll((els) => els.map((e) => e.tagName)), estado).toEqual(Array(6).fill('LI'));
      await expect(page.locator('#praticas').getByRole('list'), estado).toHaveCount(2);
      await expect(page.locator('#praticas').getByRole('listitem'), estado).toHaveCount(6);

      // coluna do hero: h1, lead, suave, depois o Portão (fechado e aberto)
      const ordem = await page.evaluate(() => {
        const els = ['#promessa h1', '#promessa p.lead', '#promessa p.suave', '#cadastro', '#portao-aberto'].map((q) => document.querySelector(q));
        return els.slice(1).map((el, i) => Boolean(els[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      });
      expect(ordem, estado).toEqual([true, true, true, true]);
      const lead = await page.locator('#promessa p.lead').boundingBox();
      const portao = await page.locator(estado === 'aberto' ? '#portao-aberto' : '#cadastro').boundingBox();
      expect(portao.y, `${estado} Portão abaixo do lead`).toBeGreaterThanOrEqual(lead.y + lead.height);

      // nota do mosaico dentro de #praticas, depois do mosaico
      await expect(page.locator('.nota-mosaico'), estado).toHaveCount(1);
      await expect(page.locator('#praticas > .nota-mosaico'), estado).toHaveCount(1);
      expect(await page.evaluate(() => Boolean(document.querySelector('.mosaico').compareDocumentPosition(document.querySelector('.nota-mosaico')) & Node.DOCUMENT_POSITION_FOLLOWING)), estado).toBe(true);

      // h2 "As seis práticas": no leitor de tela, invisível na tela (1 x 1 px)
      await expect(page.getByRole('heading', { level: 2, name: 'As seis práticas', exact: true }), estado).toHaveCount(1);
      const sr = await page.locator('#praticas h2.sr').boundingBox();
      expect(sr.width, estado).toBeLessThanOrEqual(1);
      expect(sr.height, estado).toBeLessThanOrEqual(1);

      // cabeçalho: logo, nome e selo nessa ordem, no DOM e na tela
      const logo = page.locator('header > img');
      await expect(logo, estado).toHaveAttribute('src', 'icon.png');
      const dom = await page.locator('header > *').evaluateAll((els) => els.map((e) => e.tagName + (e.className ? '.' + e.className : '')));
      expect(dom, estado).toEqual(['IMG', 'SPAN.marca', 'SPAN.selo']);
      const [l, m, s] = [await logo.boundingBox(), await page.locator('header .marca').boundingBox(), await page.locator('header .selo').boundingBox()];
      expect(l.x + l.width, `${estado} logo antes do nome`).toBeLessThanOrEqual(m.x);
      expect(m.x + m.width, `${estado} nome antes do selo`).toBeLessThanOrEqual(s.x);
    } finally {
      alvo.fechar();
    }
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
  // passos: 3 colunas na mesma linha
  const passos = [];
  for (const el of await page.locator('#passos ol > li').all()) passos.push(await el.boundingBox());
  expect(passos, 'passos').toHaveLength(3);
  expect(new Set(passos.map((b) => arred(b.x))).size, 'passos em 3 colunas').toBe(3);
  expect(Math.max(...passos.map((b) => b.y)) - Math.min(...passos.map((b) => b.y)), 'passos na mesma linha').toBeLessThan(2);
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

test('rodapé aponta para a política no próprio domínio, igual à fonte e sem terceiros', async ({ page }) => {
  await page.goto(site.url, { waitUntil: 'networkidle' });
  const link = page.locator('footer').getByRole('link', { name: 'Política de privacidade', exact: true });
  await expect(link).toHaveAttribute('href', '/privacidade/');

  const origens = new Set();
  page.on('request', (r) => origens.add(new URL(r.url()).origin));
  await Promise.all([page.waitForURL('**/privacidade/'), link.click()]);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Recrutamento de testadores/ })).toBeVisible();
  expect([...origens]).toEqual([new URL(site.url).origin]);
});
// AC 13 (sem depoimento, estrelas nem contagem de usuários) por mundo fechado: todo o texto visível da página
// é exatamente a lista do canvas VersaoC3.dc.html (sha256 0e6b8221...) mais as divergências de propósito do C33
// (e-mail contato@auroramanha.com.br no lugar do Gmail, frase de terceiros e GitHub Pages, <noscript> fora da tela).
// Texto acrescentado em qualquer ponto (antes de </main>, nos passos, na banda, no rodapé) muda a lista e falha.
test("mundo fechado: o texto visível é só o do canvas e não há depoimento, citação nem figura", async ({
  page,
}) => {
  const marca = [
    "Aurora",
    "Teste fechado no Android",
    "Cuide de você antes que o dia comece.",
  ];
  const hero = [
    "O Aurora é um app de organização da rotina matinal. Ele reúne seis práticas em um só lugar e mostra no Painel do dia o que você já fez e a sua sequência de dias.",
    "Estamos formando o grupo do teste fechado: antes de chegar à loja, o Google exige que o app seja testado por pessoas de verdade. Você pode ajudar.",
  ];
  const meio = [
    "As seis práticas",
    "Silêncio",
    "Abra um espaço de calma antes da correria.",
    "Visualização",
    "Imagine com clareza como você quer viver o seu dia.",
    "Leitura",
    "Crie o hábito de ler todos os dias.",
    "Afirmações",
    "Comece o dia com frases que reforçam o que você quer cultivar.",
    "Exercício",
    "Mova o corpo e mantenha a constância.",
    "Diário",
    "Coloque pensamentos e gratidão no papel.",
    "Você escolhe quais fazem parte da sua manhã, a ordem e quanto tempo dedicar a cada uma.",
    "Como funciona o teste",
    "1",
    "Entre na lista.",
    "Você entra com a sua conta Google e confirma que usa Android.",
    "2",
    "Receba o convite.",
    "Mandamos por e-mail o link para instalar o app pela Google Play.",
    "3",
    "Use o app e dê feedback por no mínimo 14 dias.",
    "Use a rotina no seu dia a dia e envie o seu retorno durante todo o período do teste.",
  ];
  const rodape = [
    "Política de privacidade",
    "O Aurora não é o app oficial do Método Milagre da Manhã nem tem vínculo com o autor ou a editora.",
    "O Aurora não substitui orientação médica ou psicológica.",
    "Esta página não usa cookies, rastreadores nem scripts de terceiros. Ela é hospedada no GitHub Pages e o formulário de inscrição é do Google Forms.",
    `Dúvidas ou pedido de exclusão: ${EMAIL}.`,
  ];
  const esperado = {
    fechado: [
      ...marca,
      ...hero,
      "As inscrições ainda não abriram. Volte em breve.",
      `Dúvidas? Escreva para ${EMAIL}.`,
      ...meio,
      ...rodape,
    ],
    aberto: [
      ...marca,
      ...hero,
      "Ao entrar você deixa o seu Gmail, confirma que usa Android e aceita participar do teste. Se quiser, marque a opção de aviso de lançamento.",
      "Entrar na lista",
      "Só para Android. O formulário abre no Google Forms; a política de privacidade, no rodapé, diz por quanto tempo guardamos os dados e como pedir a exclusão.",
      ...meio,
      "Pronto para ajudar?",
      "Entrar na lista",
      ...rodape,
    ],
  };
  for (const estado of ["fechado", "aberto"]) {
    const alvo = await iniciar(
      estado === "aberto" ? { formsUrl: FORMS_TESTE } : {},
    );
    try {
      for (const largura of [360, 1280]) {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto(alvo.url, { waitUntil: "networkidle" });
        const linhas = await page.evaluate(() =>
          document.body.innerText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        );
        expect(linhas, `${estado} ${largura} px`).toEqual(esperado[estado]);
        // marcação de depoimento, citação, figura ou avaliação estruturada: contagem 0
        await expect(
          page.locator(
            'blockquote, q, cite, figure, figcaption, [itemprop], [itemscope], script[type="application/ld+json"]',
          ),
          `${estado} ${largura} px`,
        ).toHaveCount(0);
      }
    } finally {
      alvo.fechar();
    }
  }
});

// O13/O11: foco, hover, sublinhado, tag das seções, charset, forma e tipografia que o canvas desenha
test("interação, forma e tipografia do canvas nos dois estados", async ({
  page,
}) => {
  for (const estado of ["fechado", "aberto"]) {
    const alvo = await iniciar(
      estado === "aberto" ? { formsUrl: FORMS_TESTE } : {},
    );
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(alvo.url, { waitUntil: "networkidle" });
      // <meta charset> e tag das seções
      await expect(page.locator("meta[charset]"), estado).toHaveCount(1);
      await expect(page.locator("meta[charset]"), estado).toHaveAttribute(
        "charset",
        /^utf-8$/i,
      );
      for (const id of ["#promessa", "#passos", "#cadastro-fim"]) {
        expect(
          await page.locator(id).evaluate((e) => e.tagName),
          `${estado} ${id}`,
        ).toBe("SECTION");
      }
      // foco visível por teclado em todo link, contorno de 3 px; sublinhado nos links do texto
      const total = await page.locator("a:visible").count();
      expect(total, estado).toBeGreaterThan(0);
      await page.evaluate(
        () => document.activeElement && document.activeElement.blur(),
      );
      for (let i = 0; i < total; i++) {
        await page.keyboard.press("Tab");
        const foco = await page.evaluate(() => {
          const s = getComputedStyle(document.activeElement);
          return {
            tag: document.activeElement.tagName,
            estilo: s.outlineStyle,
            largura: parseFloat(s.outlineWidth),
          };
        });
        expect(foco.tag, `${estado} foco ${i}`).toBe("A");
        expect(foco.estilo, `${estado} foco ${i}`).toBe("solid");
        expect(foco.largura, `${estado} foco ${i}`).toBeGreaterThanOrEqual(3);
      }
      for (const link of await page.locator("a.link:visible").all()) {
        expect(
          await link.evaluate((e) => getComputedStyle(e).textDecorationLine),
          estado,
        ).toContain("underline");
      }
      // CTA: mesma aba (sem target), rel noopener, hover muda o fundo
      if (estado === "aberto") {
        for (const cta of await page.locator("a.cta").all()) {
          await expect(cta, estado).not.toHaveAttribute("target", /.*/);
          await expect(cta, estado).toHaveAttribute("rel", "noopener");
        }
        const cta = page.locator("a.cta").first();
        const antes = await cta.evaluate(
          (e) => getComputedStyle(e).backgroundColor,
        );
        await cta.hover();
        expect(
          await cta.evaluate((e) => getComputedStyle(e).backgroundColor),
          `${estado} hover do CTA`,
        ).not.toBe(antes);
      }
      // tipografia: Roboto sem serifa; tamanhos mínimos de h1, h2, corpo, rodapé e numerais dos passos
      const tipo = await page.evaluate(() => {
        const px = (q) =>
          parseFloat(getComputedStyle(document.querySelector(q)).fontSize);
        return {
          familia: getComputedStyle(document.body).fontFamily,
          h1: px("h1"),
          h2: px("#titulo-passos"),
          corpo: px("p.lead"),
          apoio: px("footer p"),
          numeral: px("#passos .n"),
        };
      });
      expect(tipo.familia, estado).toMatch(/^Roboto/);
      expect(tipo.h1, `${estado} h1`).toBeGreaterThanOrEqual(36);
      expect(tipo.h2, `${estado} h2`).toBeGreaterThanOrEqual(24);
      expect(tipo.corpo, `${estado} corpo`).toBeGreaterThanOrEqual(16);
      expect(tipo.apoio, `${estado} rodapé`).toBeGreaterThanOrEqual(14);
      expect(tipo.numeral, `${estado} numerais`).toBeGreaterThanOrEqual(48);
      // forma: faixa dos passos e banda com fundo; tiles com raio, imagem 1:1; mosaico em 2 colunas a 360 px (O11)
      for (const id of ["#passos", "#cadastro-fim"]) {
        expect(
          await page
            .locator(id)
            .evaluate((e) => getComputedStyle(e).backgroundColor),
          `${estado} fundo ${id}`,
        ).not.toBe("rgba(0, 0, 0, 0)");
      }
      for (const tile of await page.locator(".tile").all()) {
        expect(
          await tile.evaluate((e) =>
            parseFloat(getComputedStyle(e).borderTopLeftRadius),
          ),
          estado,
        ).toBeGreaterThanOrEqual(16);
        const img = await tile.locator("img").boundingBox();
        expect(
          Math.abs(img.width - img.height),
          `${estado} imagem 1:1`,
        ).toBeLessThan(1);
      }
      const xs = await page
        .locator(".tile")
        .evaluateAll((els) =>
          els.map((e) => Math.round(e.getBoundingClientRect().x)),
        );
      expect(new Set(xs).size, `${estado} mosaico em 2 colunas a 360 px`).toBe(
        2,
      );
    } finally {
      alvo.fechar();
    }
  }
});

test("a 1600 px: mosaico deslocado 28 px, hero alinhado ao topo e .miolo com largura máxima", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(site.url, { waitUntil: "networkidle" });
  const y = async (q) => (await page.locator(q).first().boundingBox()).y;
  expect(
    Math.round((await y(".t-afirmacoes")) - (await y(".t-silencio"))),
    "Afirmações deslocada",
  ).toBe(28);
  expect(
    Math.round((await y(".t-leitura")) - (await y(".t-exercicio"))),
    "Leitura deslocada",
  ).toBe(28);
  // alinhado ao topo: o h1 (margem de 24 px) e o mosaico começam a menos de 48 px um do outro
  expect(
    Math.abs((await y("#promessa h1")) - (await y(".mosaico"))),
    "hero alinhado ao topo",
  ).toBeLessThan(48);
  for (const q of ["#promessa", "#passos .miolo", "footer"]) {
    expect(
      (await page.locator(q).first().boundingBox()).width,
      `${q} limitado`,
    ).toBeLessThanOrEqual(1160);
  }
});
