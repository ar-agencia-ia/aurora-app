// Contraste WCAG dos pares texto/fundo da landing, calculado dos tokens de index.html.
// Uso: node aurora-app/tests/contraste.js  (exit 1 se algum par ficar abaixo de 4,5:1)
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const tokens = {};
for (const [, nome, valor] of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[nome] = valor;

// par = [texto, fundo]; todo par usado no CSS entra aqui
const pares = [
  ['ink', 'bg'],
  ['mut', 'bg'],
  ['mut', 'card'],
  ['mut', 'chip'],
  ['ink', 'card'],
  ['on-primary', 'primary'],
  ['primary', 'bg'],
];

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

// todo token usado como `color:` precisa estar em algum par
const usados = new Set([...css.matchAll(/(?:^|[;{\s])color:\s*var\(--([a-z-]+)\)/g)].map((m) => m[1]));
const cobertos = new Set(pares.map(([texto]) => texto));
let falhou = false;
for (const t of usados) {
  if (!cobertos.has(t)) { console.error(`token de texto sem par declarado: --${t}`); falhou = true; }
}
for (const [texto, fundo] of pares) {
  if (!tokens[texto] || !tokens[fundo]) { console.error(`token ausente: ${texto} ou ${fundo}`); falhou = true; continue; }
  const razao = contraste(tokens[texto], tokens[fundo]);
  const ok = razao >= 4.5;
  console.log(`${ok ? 'ok  ' : 'FALHA'} --${texto} sobre --${fundo}: ${razao.toFixed(2)}:1`);
  if (!ok) falhou = true;
}
process.exit(falhou ? 1 : 0);
