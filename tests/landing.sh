#!/usr/bin/env bash
# Prova o Portão da landing: `publicado` (padrão), `fechado` ou `aberto`.
# publicado: confere que o index.html commitado tem o Portão no formato certo: WEB3FORMS_KEY vazio (landing fechada,
#   estado commitado até o gestor inserir a chave pública do Web3Forms) ou com uma chave UUID (landing aberta), e que
#   nenhum link para o Google Forms sobrou.
# fechado e aberto: servem a landing com o valor do Portão trocado em memória (vazio ou chave de teste) e conferem a página.
set -euo pipefail
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
estado="${1:-publicado}"

case "$estado" in
  publicado)
    grep -qE 'var WEB3FORMS_KEY = "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?";' "$raiz/index.html"
    ! grep -q 'docs\.google\.com/forms' "$raiz/index.html"
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
