// Contraste WCAG dos pares texto/fundo da landing, calculado dos tokens de index.html.
// Uso: node aurora-app/tests/contraste.js  (exit 1 se algum par ficar abaixo de 4,5:1)
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const tokens = {};
for (const [, nome, valor] of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g))
  tokens[nome] = valor;

// par = [texto, fundo]; todo par usado no CSS entra aqui
const pares = [
  ["ink", "bg"],
  ["mut", "bg"],
  ["mut", "card"],
  ["ink", "chip"],
  ["primary", "chip"],
  ["primary-press", "bg"],
  ["primary-press", "chip"],
  ["mut", "chip"],
  ["ink", "card"],
  ["on-primary", "primary"],
  ["primary", "bg"],
  ["ink-soft", "bg"],
  ["ink-soft", "chip"],
  ["ink", "band"],
  ["ink-band", "band"],
  ["primary-press", "band"],
];

// pares literais (texto/fundo dos blocos de cada prática, que não passam por token)
const literais = [
  ["#3C3B41", "#E5E1E9"],
  ["#41393E", "#ECDFE5"],
  ["#363D3C", "#DDE4E3"],
  ["#393D36", "#E1E4DA"],
  ["#3D3C32", "#E7E2D5"],
  ["#413A32", "#EDE0D4"],
  // degradê do hero (topo e meio): texto de --ink e --ink-soft
  ["#191C20", "#BED0F1"],
  ["#2A2F37", "#BED0F1"],
  ["#191C20", "#D9E4F8"],
  ["#2A2F37", "#D9E4F8"],
];

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

// todo token usado como `color:` precisa estar em algum par
const usados = new Set(
  [...css.matchAll(/(?:^|[;{\s])color:\s*var\(--([a-z-]+)\)/g)].map(
    (m) => m[1],
  ),
);
const cobertos = new Set(pares.map(([texto]) => texto));
let falhou = false;
for (const t of usados) {
  if (!cobertos.has(t)) {
    console.error(`token de texto sem par declarado: --${t}`);
    falhou = true;
  }
}
for (const [texto, fundo] of pares) {
  if (!tokens[texto] || !tokens[fundo]) {
    console.error(`token ausente: ${texto} ou ${fundo}`);
    falhou = true;
    continue;
  }
  const razao = contraste(tokens[texto], tokens[fundo]);
  const ok = razao >= 4.5;
  console.log(
    `${ok ? "ok  " : "FALHA"} --${texto} sobre --${fundo}: ${razao.toFixed(2)}:1`,
  );
  if (!ok) falhou = true;
}
for (const [texto, fundo] of literais) {
  const razao = contraste(texto, fundo);
  const ok = razao >= 4.5;
  console.log(
    `${ok ? "ok  " : "FALHA"} ${texto} sobre ${fundo}: ${razao.toFixed(2)}:1`,
  );
  if (!ok) falhou = true;
}
process.exit(falhou ? 1 : 0);
