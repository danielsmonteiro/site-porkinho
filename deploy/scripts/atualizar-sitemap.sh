#!/usr/bin/env bash
#
# Feijoada Porkinho — poe no sitemap.xml a data real da ultima mudanca de
# cada pagina, tirada do git (data do ultimo commit que mexeu no arquivo).
#
# Roda no GitHub Actions antes de cada publicacao (o checkout precisa do
# historico completo: fetch-depth 0). Tambem pode rodar na sua maquina.
#
#   /                         -> public/index.html
#   /politica-de-privacidade.html -> public/politica-de-privacidade.html
#
set -euo pipefail
cd "$(dirname "$0")/../.."

SITEMAP=public/sitemap.xml
BASE='https://feijoadaporkinho.com.br/'
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

arquivo_da_url() {
  local caminho="${1#"$BASE"}"
  [[ -z "$caminho" || "$caminho" == */ ]] && caminho="${caminho}index.html"
  printf 'public/%s' "$caminho"
}

# Padroes em variavel: escritos direto no [[ =~ ]], os < > quebram o parser.
re_loc='<loc>([^<]+)</loc>'
re_lastmod='^([[:space:]]*)<lastmod>[^<]*</lastmod>'

loc=''
while IFS= read -r linha || [[ -n "$linha" ]]; do
  if [[ "$linha" =~ $re_loc ]]; then
    loc="${BASH_REMATCH[1]}"
  elif [[ -n "$loc" && "$linha" =~ $re_lastmod ]]; then
    arq="$(arquivo_da_url "$loc")"
    [[ -f "$arq" ]] || { echo "ERRO: $loc aponta para $arq, que nao existe" >&2; exit 1; }
    data="$(git log -1 --format=%cs -- "$arq")"
    [[ -n "$data" ]] || { echo "ERRO: $arq sem historico no git (fetch-depth 0?)" >&2; exit 1; }
    linha="${BASH_REMATCH[1]}<lastmod>$data</lastmod>"
    echo "    $loc -> $data" >&2
    loc=''
  fi
  printf '%s\n' "$linha"
done < "$SITEMAP" > "$tmp"

cat "$tmp" > "$SITEMAP"
