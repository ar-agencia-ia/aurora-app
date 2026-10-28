# Aurora: landing do teste fechado

Repo público só da página: HTML e CSS estáticos, sem build e sem script de terceiros, publicados pelo GitHub Pages a partir de `main`. Tudo o que é marketing (kit de textos, runbook do piloto, orçamento) fica no repo privado `aurora-marketing`.

- `index.html`: a landing. O Portão do teste fechado é o valor `FORMS_URL` no script final (vazio = fechada).
- `fonts/`: Roboto hospedada aqui (licença Apache 2.0).
- `tests/`: provas da landing (`npm install` aqui e `npx playwright test`; `bash tests/landing.sh aberto`; `node tests/contraste.js`; capturas com `CAPTURAS_DIR=<pasta> npx playwright test tests/capturas.spec.js`).

Nunca versione respostas do formulário: `.gitignore` barra `*.csv`, `*.xlsx` e `exports/`.
