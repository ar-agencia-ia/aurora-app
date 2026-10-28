#!/usr/bin/env bash
# Prova que kit/check.sh barra termo proibido: copia o kit, planta "cura" e espera exit 1 com arquivo e termo.
set -uo pipefail
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp "$raiz"/kit/* "$tmp"/
echo "Esta rotina é a cura para a sua manhã." > "$tmp/plantado.md"

saida="$(bash "$tmp/check.sh" "$tmp")"
codigo=$?
[ "$codigo" -eq 1 ] || { echo "esperava exit 1, veio $codigo"; exit 1; }
echo "$saida" | grep -q "plantado.md: cura" || { echo "saída não lista arquivo e termo: $saida"; exit 1; }
echo "ok: kit/check.sh barrou plantado.md: cura"
