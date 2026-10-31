#!/usr/bin/env bash
# Prova o Portão da landing: `publicado` (padrão), `fechado` ou `aberto`.
# publicado: confere que o index.html commitado está aberto, com a URL pública do Forms.
# fechado e aberto: servem a landing com o valor do Portão trocado em memória (vazio ou URL de teste) e conferem a página.
set -euo pipefail
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
estado="${1:-publicado}"

case "$estado" in
  publicado)
    grep -qE 'var FORMS_URL = "https://docs\.google\.com/forms/d/e/[A-Za-z0-9_-]+/viewform";' "$raiz/index.html"
    ;;
  fechado)
    cd "$raiz"
    npx --prefix . playwright test tests/landing.spec.js -g "mundo fechado"
    ;;
  aberto)
    cd "$raiz"
    npx --prefix . playwright test tests/landing.spec.js -g "abrir o Portão"
    ;;
  *)
    echo "uso: landing.sh [publicado|fechado|aberto]" >&2
    exit 2
    ;;
esac
