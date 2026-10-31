const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const PORTAO = /var FORMS_URL = "[^"]*";/;

// Serve a landing do disco. Troca o único valor do Portão em memória: `formsUrl` abre, sem ele fecha.
// Assim os testes dos dois estados valem seja qual for o valor commitado em index.html.
function iniciar({ formsUrl } = {}) {
  const servidor = http.createServer((req, res) => {
    const rota = req.url.split('?')[0];
    const arquivo = path.join(RAIZ, rota.endsWith('/') ? rota + 'index.html' : rota);
    if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    let corpo = fs.readFileSync(arquivo);
    if (arquivo === path.join(RAIZ, 'index.html')) {
      const html = corpo.toString('utf8');
      if (!PORTAO.test(html)) throw new Error('valor do Portão não encontrado em index.html');
      corpo = Buffer.from(html.replace(PORTAO, () => `var FORMS_URL = ${JSON.stringify(formsUrl || '')};`));
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    res.end(corpo);
  });
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => {
      resolve({ url: `http://127.0.0.1:${servidor.address().port}/`, fechar: () => servidor.close() });
    });
  });
}

module.exports = { iniciar, RAIZ };
