# Aurora: landing do teste fechado

Página estática (HTML e CSS, sem build, sem script de terceiros) que convida testadores Android para o teste fechado do Aurora, publicada pelo GitHub Pages a partir de `main`.

- `index.html`: a landing. O Portão do teste fechado é o valor `FORMS_URL` no script final (vazio = fechada).
- `kit/`: convite, lembretes dos dias 0, 3, 7 e 12 e criativos; `kit/check.sh` barra termos de `kit/termos-proibidos.txt`.
- `runbook-piloto.md`: pré-voo, abertura do Portão, decisão aos 7 dias, apagamento e contingência.
- `tests/`: provas da landing (`npm install` aqui e `npx playwright test`; `bash tests/landing.sh aberto`; `node tests/contraste.js`).

Nunca versione respostas do formulário: `.gitignore` barra `*.csv`, `*.xlsx` e `exports/`.
