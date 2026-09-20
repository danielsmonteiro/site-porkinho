#!/usr/bin/env bash
#
# Feijoada Porkinho — restaura o IP real do visitante no nginx.
#
# Baixa as faixas publicadas pela Cloudflare e gera o arquivo
# cloudflare-realip.conf com as diretivas set_real_ip_from. Sem isso,
# $remote_addr no log seria sempre o IP da borda da Cloudflare e a contagem
# de cliques nao serviria para nada.
#
# As faixas mudam de tempos em tempos — por isso elas sao geradas por este
# script e nunca escritas a mao. Ha um cron mensal sugerido no README.
#
# Uso:
#   sudo ./update-cloudflare-ips.sh                 # gera, testa e recarrega
#   ./update-cloudflare-ips.sh --destino ./saida.conf --sem-reload
#
set -euo pipefail

DESTINO="/etc/nginx/conf.d/cloudflare-realip.conf"
RECARREGAR=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --destino)    DESTINO="$2"; shift 2 ;;
    --sem-reload) RECARREGAR=0; shift ;;
    -h|--help)    sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

URL_V4="https://www.cloudflare.com/ips-v4"
URL_V6="https://www.cloudflare.com/ips-v6"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "==> Baixando as faixas da Cloudflare"
curl -fsS --max-time 20 "$URL_V4" -o "$tmp/v4" || { echo "ERRO: falhou baixar $URL_V4" >&2; exit 1; }
curl -fsS --max-time 20 "$URL_V6" -o "$tmp/v6" || { echo "ERRO: falhou baixar $URL_V6" >&2; exit 1; }

# Sanidade: se o download vier vazio ou com lixo, aborta antes de estragar
# um arquivo que estava bom.
validar() {
  local arq="$1" tipo="$2" padrao
  if [[ "$tipo" == v4 ]]; then
    padrao='^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$'
  else
    padrao='^[0-9a-fA-F:]+/[0-9]+$'
  fi
  local n
  n=$(grep -cE "$padrao" "$arq" || true)
  if [[ "$n" -lt 1 ]]; then
    echo "ERRO: nenhuma faixa $tipo valida no download" >&2
    exit 1
  fi
  if [[ "$n" -ne "$(grep -cve '^[[:space:]]*$' "$arq")" ]]; then
    echo "ERRO: o download de $tipo tem linha fora do formato esperado" >&2
    exit 1
  fi
  echo "    $n faixas $tipo"
}
validar "$tmp/v4" v4
validar "$tmp/v6" v6
ESPERADAS=$(( $(grep -cve '^[[:space:]]*$' "$tmp/v4") + $(grep -cve '^[[:space:]]*$' "$tmp/v6") ))

echo "==> Montando $DESTINO"
{
  echo "# ------------------------------------------------------------------------"
  echo "# ARQUIVO GERADO — nao edite a mao."
  echo "# Gerado por deploy/scripts/update-cloudflare-ips.sh em $(date -Is)"
  echo "# Fonte: $URL_V4"
  echo "#        $URL_V6"
  echo "# Instalar em: /etc/nginx/conf.d/cloudflare-realip.conf"
  echo "# ------------------------------------------------------------------------"
  echo
  echo "# IPv4"
  # O `|| [[ -n "$faixa" ]]` nao e enfeite: a Cloudflare serve a lista SEM
  # quebra de linha no final, e um `while read` simples engole a ultima faixa.
  while read -r faixa || [[ -n "$faixa" ]]; do
    [[ -n "$faixa" ]] && echo "set_real_ip_from $faixa;"
  done < "$tmp/v4"
  echo
  echo "# IPv6"
  while read -r faixa || [[ -n "$faixa" ]]; do
    [[ -n "$faixa" ]] && echo "set_real_ip_from $faixa;"
  done < "$tmp/v6"
  echo
  echo "# A Cloudflare envia o IP do visitante neste cabecalho."
  echo "real_ip_header    CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} > "$tmp/saida.conf"

mkdir -p "$(dirname "$DESTINO")"
if [[ -f "$DESTINO" ]] && cmp -s "$tmp/saida.conf" "$DESTINO"; then
  echo "==> Nada mudou; $DESTINO ja esta atualizado."
  exit 0
fi

if [[ -f "$DESTINO" ]]; then
  cp -a "$DESTINO" "$DESTINO.bak"
  echo "    backup em $DESTINO.bak"
fi
cp "$tmp/saida.conf" "$DESTINO"
chmod 644 "$DESTINO"
GRAVADAS=$(grep -c '^set_real_ip_from' "$DESTINO")
echo "    $GRAVADAS faixas gravadas (esperadas: $ESPERADAS)"
if [[ "$GRAVADAS" -ne "$ESPERADAS" ]]; then
  echo "ERRO: gravamos $GRAVADAS de $ESPERADAS faixas. Uma faixa perdida vira" >&2
  echo "      visitante logado com o IP da Cloudflare. Restaurando o anterior." >&2
  [[ -f "$DESTINO.bak" ]] && cp -a "$DESTINO.bak" "$DESTINO"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "==> nginx nao encontrado nesta maquina; arquivo gerado e nada mais."
  exit 0
fi

echo "==> nginx -t"
if ! nginx -t; then
  echo "ERRO: configuracao invalida. Restaurando o arquivo anterior." >&2
  [[ -f "$DESTINO.bak" ]] && cp -a "$DESTINO.bak" "$DESTINO"
  exit 1
fi

if [[ "$RECARREGAR" -eq 1 ]]; then
  echo "==> systemctl reload nginx"
  systemctl reload nginx
  echo "==> Pronto."
else
  echo "==> Recarga pulada (--sem-reload). Rode: sudo systemctl reload nginx"
fi
