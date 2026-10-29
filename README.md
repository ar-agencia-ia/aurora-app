# Aurora: landing do teste fechado

Repo público só da página: HTML e CSS estáticos, sem build e sem script de terceiros, publicados pelo GitHub Pages a partir de `main`, no domínio `auroramanha.com.br` (DNS na Cloudflare, e-mail `contato@auroramanha.com.br` por Email Routing). Tudo o que é marketing (kit de textos, runbook do piloto, orçamento) fica no repo privado `aurora-marketing`.

- `index.html`: a landing. O Portão do teste fechado é o valor `FORMS_URL` no script final (vazio = fechada).
- `fonts/`: Roboto hospedada aqui (licença Apache 2.0).
- `assets/`: ilustrações em aquarela (uma por prática, mais `painel.webp`, a fonte do `og.png`), geradas com Codex CLI e exportadas em WebP. O fundo do hero é um degradê em CSS. `icon.png` é o ícone do app; `og.png` (1200×630) é a imagem de pré-visualização do link.
- `tests/`: provas da landing (`npm install` aqui e `npx playwright test`; `bash tests/landing.sh aberto`; `node tests/contraste.js`; capturas com `CAPTURAS_DIR=<pasta> npx playwright test tests/capturas.spec.js`).

Nunca versione respostas do formulário: `.gitignore` barra `*.csv`, `*.xlsx` e `exports/`.
