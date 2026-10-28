#!/usr/bin/env bash
# Prova o Portão da landing: `fechado` (padrão) ou `aberto`.
# aberto: serve a landing com uma URL de Forms de teste no lugar do valor do Portão e confere o botão.
set -euo pipefail
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
estado="${1:-fechado}"

case "$estado" in
  fechado)
    grep -q "As inscrições ainda não abriram. Volte em breve." "$raiz/index.html"
    ! grep -q "docs.google.com/forms" "$raiz/index.html"
    ;;
  aberto)
    cd "$raiz"
    npx --prefix . playwright test tests/landing.spec.js -g "abrir o Portão"
    ;;
  *)
    echo "uso: landing.sh [fechado|aberto]" >&2
    exit 2
    ;;
esac
