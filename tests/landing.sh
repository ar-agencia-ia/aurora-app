#!/usr/bin/env bash
# Prova o Portão da landing: `publicado` (padrão), `fechado` ou `aberto`.
# publicado: confere que o index.html commitado tem o Portão no formato certo: WEB3FORMS_KEY vazio (landing fechada,
#   estado commitado até o gestor inserir a chave pública do Web3Forms) ou com uma chave UUID (landing aberta), e que
#   nenhum link para o Google Forms sobrou.
# fechado e aberto: servem a landing com o valor do Portão trocado em memória (vazio ou chave de teste) e conferem a página.
set -euo pipefail
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
estado="${1:-publicado}"

# Portão no formato certo; com chave preenchida a política publicada tem de citar o Web3Forms (política antes da chave).
publicado() {
  local d="$1"
  grep -qE 'var WEB3FORMS_KEY = "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?";' "$d/index.html" || return 1
  ! grep -q 'docs\.google\.com/forms' "$d/index.html" || return 1
  grep -q 'var WEB3FORMS_KEY = "";' "$d/index.html" || grep -q 'Web3Forms' "$d/privacidade/index.html"
}

case "$estado" in
  publicado)
    publicado "$raiz"
    ;;
  publicado-prova)
    # prova a regra "política antes da chave": chave preenchida + política sem Web3Forms deve falhar
    tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    mkdir "$tmp/privacidade"
    sed 's/var WEB3FORMS_KEY = "";/var WEB3FORMS_KEY = "00000000-0000-0000-0000-000000000000";/' "$raiz/index.html" > "$tmp/index.html"
    echo "politica antiga" > "$tmp/privacidade/index.html"
    if (publicado "$tmp") 2>/dev/null; then echo "FALHA: chave preenchida passou sem Web3Forms na política" >&2; exit 1; fi
    echo "politica com Web3Forms" > "$tmp/privacidade/index.html"
    publicado "$tmp"
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
    echo "uso: landing.sh [publicado|publicado-prova|fechado|aberto]" >&2
    exit 2
    ;;
esac
