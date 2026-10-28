#!/usr/bin/env bash
# Barra termos proibidos nos textos do kit.
# Uso: check.sh [diretório-do-kit]   (padrão: a pasta deste script)
# Exit 0: nenhum termo. Exit 1: lista "arquivo: termo" por ocorrência.
set -uo pipefail
kit="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
termos="$kit/termos-proibidos.txt"
[ -f "$termos" ] || { echo "falta $termos" >&2; exit 2; }

achou=0
while IFS= read -r termo; do
  [ -z "$termo" ] && continue
  while IFS= read -r arquivo; do
    echo "$(basename "$arquivo"): $termo"
    achou=1
  done < <(grep -l -i -w -F -- "$termo" "$kit"/*.md 2>/dev/null)
done < "$termos"
exit "$achou"
