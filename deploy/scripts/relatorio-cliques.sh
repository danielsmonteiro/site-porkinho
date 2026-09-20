#!/usr/bin/env bash
#
# Feijoada Porkinho — relatorio de cliques.
#
# Le /var/log/nginx/cliques.log (mais os rotacionados) e imprime, para hoje,
# 7 dias e 30 dias: total por rota, proporcao entre os canais, ranking dos
# pontos de retirada e distribuicao por dia da semana e por hora.
#
# So awk/sort/uniq. Nenhuma dependencia.
#
# Uso:
#   ./relatorio-cliques.sh                      # /var/log/feijoadaporkinho/cliques.log
#   ./relatorio-cliques.sh /caminho/do/log      # outro arquivo
#   LARGURA=60 ./relatorio-cliques.sh           # barras mais largas
#
# O mesmo arquivo pode ser lido pelo GoAccess — ver README.
#
# Formato do log (TAB entre os campos), definido em deploy/nginx/log-cliques.conf:
#   1 horario ISO | 2 request_uri | 3 status | 4 ip_real | 5 ip_cf
#   6 pais | 7 referer | 8 user-agent | 9 cf-ray
#
set -uo pipefail

LOG="${1:-/var/log/feijoadaporkinho/cliques.log}"
LARGURA="${LARGURA:-34}"

# Precisamos de um locale UTF-8 para que ${#texto} conte caracteres, e nao
# bytes: sem isso "terça" e "Eusébio" saem desalinhados nas colunas.
if [[ -z "${LC_ALL:-}" ]]; then
  for _l in C.UTF-8 C.utf8 pt_BR.UTF-8 en_US.UTF-8; do
    if locale -a 2>/dev/null | grep -qix -- "$_l"; then export LC_ALL="$_l"; break; fi
  done
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# ------------------------------------------------------------------ fonte
# Junta o log corrente com os rotacionados (texto e .gz).
reunir() {
  local base="$1"
  [[ -r "$base" ]] && cat -- "$base"
  local f
  # `cliques.log.1` e o padrao; `cliques.log-20260919` aparece se alguem
  # ligar `dateext` no logrotate.conf. Sem a segunda forma, o relatorio
  # cobriria so o dia corrente e ainda assim imprimiria "ULTIMOS 30 DIAS".
  for f in "$base".[0-9]* "$base"-[0-9]*; do
    [[ -e "$f" ]] || continue
    case "$f" in
      *.gz) zcat -- "$f" 2>/dev/null ;;
      *)    cat  -- "$f" 2>/dev/null ;;
    esac
  done
  return 0
}

if [[ ! -r "$LOG" ]] && ! compgen -G "$LOG.[0-9]*" >/dev/null && ! compgen -G "$LOG-[0-9]*" >/dev/null; then
  echo "Não consegui ler $LOG."
  echo "Confira o caminho, ou rode com sudo se o arquivo for do root."
  exit 1
fi

reunir "$LOG" | awk -F'\t' 'NF>=2 && $2 ~ /^\/go\//' > "$tmp/todos" || true

TOTAL_LINHAS=$(wc -l < "$tmp/todos" | tr -d ' ')

FUSO=$( (timedatectl show -p Timezone --value 2>/dev/null) || cat /etc/timezone 2>/dev/null || echo "?" )
FUSO=${FUSO:-?}
HOJE=$(date +%F)
INI7=$(date -d '6 days ago' +%F 2>/dev/null || date -v-6d +%F)
INI30=$(date -d '29 days ago' +%F 2>/dev/null || date -v-29d +%F)

linha() { printf '%s\n' "------------------------------------------------------------"; }

barra() { # $1 = valor  $2 = maximo
  local v="$1" m="$2" n=0 i
  [[ "$m" -gt 0 ]] && n=$(( v * LARGURA / m ))
  [[ "$n" -lt 1 && "$v" -gt 0 ]] && n=1
  for ((i=0;i<n;i++)); do printf '#'; done
}

pad() { # $1 = texto  $2 = largura em colunas (conta acento como 1)
  local s="$1" w="$2" n
  n=$(( w - ${#s} )); (( n < 0 )) && n=0
  printf '%s%*s' "$s" "$n" ''
}

pct() { # $1 = parte  $2 = total
  [[ "${2:-0}" -eq 0 ]] && { printf '  0,0'; return; }
  awk -v a="$1" -v b="$2" 'BEGIN{printf "%5.1f", a*100/b}' | tr '.' ','
}

# ---------------------------------------------------------- contagem
# Conta linhas de uma rota exata, ignorando query string. Um clique que
# chegue como /go/ifood?fbclid=... e o mesmo clique: o `grep` por
# $'\t/go/ifood\t' deixava esses de fora e as duas metades do relatorio
# (total por rota x proporcao entre canais) discordavam entre si.
conta_rota() {   # $1 = arquivo  $2 = rota exata
  awk -F'\t' -v r="$2" '{split($2, a, "?"); if (a[1] == r) n++} END {print n+0}' "$1"
}

# ------------------------------------------------------- nome dos pontos
nome_ponto() {
  case "$1" in
    guararapes)     echo "Guararapes" ;;
    eusebio)        echo "Eusébio" ;;
    parque-del-sol) echo "Parque del Sol" ;;
    sapiranga)      echo "Sapiranga" ;;
    *)              echo "$1" ;;
  esac
}

# =========================================================== um periodo
periodo() {
  local rotulo="$1" inicio="$2" arq="$tmp/p"

  awk -F'\t' -v ini="$inicio" 'substr($1,1,10) >= ini' "$tmp/todos" > "$arq"
  local n; n=$(wc -l < "$arq" | tr -d ' ')

  echo
  linha
  printf '%s   (a partir de %s)\n' "$rotulo" "$inicio"
  linha
  printf 'Cliques no período: %s\n' "$n"

  if [[ "$n" -eq 0 ]]; then
    echo "  (nenhum clique registrado neste período)"
    return 0
  fi

  # ---------------------------------------------------- total por rota
  echo
  echo "TOTAL POR ROTA"
  awk -F'\t' '{split($2,a,"?"); print a[1]}' "$arq" \
    | sort | uniq -c | sort -rn \
    | while read -r c rota; do
        printf '  %-28s %6s  %s%%  %s\n' "$rota" "$c" "$(pct "$c" "$n")" "$(barra "$c" "$n")"
      done

  # ------------------------------------------- proporcao entre canais
  local ifood food99 zap insta canais
  ifood=$(conta_rota  "$arq" /go/ifood)
  food99=$(conta_rota "$arq" /go/99food)
  zap=$(conta_rota    "$arq" /go/whatsapp)
  insta=$(conta_rota  "$arq" /go/instagram)
  canais=$(( ifood + food99 + zap ))

  echo
  echo "iFOOD x 99 FOOD x WHATSAPP"
  if [[ "$canais" -eq 0 ]]; then
    echo "  (nenhum clique em canal de venda neste período)"
  else
    local maior="$ifood"
    [[ "$food99" -gt "$maior" ]] && maior="$food99"
    [[ "$zap"    -gt "$maior" ]] && maior="$zap"
    printf '  %-10s %6s  %s%%  %s\n' "iFood"    "$ifood"  "$(pct "$ifood"  "$canais")" "$(barra "$ifood"  "$maior")"
    printf '  %-10s %6s  %s%%  %s\n' "99 Food"  "$food99" "$(pct "$food99" "$canais")" "$(barra "$food99" "$maior")"
    printf '  %-10s %6s  %s%%  %s\n' "WhatsApp" "$zap"    "$(pct "$zap"    "$canais")" "$(barra "$zap"    "$maior")"
    printf '  %-10s %6s         (fora do cálculo de proporção)\n' "Instagram" "$insta"
  fi

  # --------------------------------------- ranking dos pontos (sempre 4)
  echo
  echo "PONTOS DE RETIRADA"
  {
    for p in guararapes eusebio parque-del-sol sapiranga; do
      printf '%s\t%s\n' "$(conta_rota "$arq" "/go/ponto/$p")" "$p"
    done
  } | sort -rn > "$tmp/pontos"

  local tot_p max_p pos=1
  tot_p=$(awk -F'\t' '{s+=$1} END{print s+0}' "$tmp/pontos")
  max_p=$(head -1 "$tmp/pontos" | cut -f1)
  while IFS=$'\t' read -r c p; do
    printf '  %d. %s %6s  %s%%  %s\n' "$pos" "$(pad "$(nome_ponto "$p")" 16)" "$c" "$(pct "$c" "$tot_p")" "$(barra "$c" "$max_p")"
    pos=$((pos+1))
  done < "$tmp/pontos"
  printf '  %-19s %6s\n' "total" "$tot_p"

  # ------------------------------------------------- eventos internos
  if awk -F'\t' '$2 ~ /^\/go\/evento\//{found=1; exit} END{exit !found}' "$arq"; then
    echo
    echo "EVENTOS INTERNOS (não saem da página)"
    awk -F'\t' '$2 ~ /^\/go\/evento\// {
        split($2, a, "?");
        sub(/^\/go\/evento\//, "", a[1]);
        r = "-";
        if (a[2] ~ /(^|&)r=/) { split(a[2], q, "r="); split(q[2], w, "&"); r = w[1] }
        print a[1] " " r
      }' "$arq" | sort | uniq -c | sort -rn \
      | while read -r c ev; do printf '  %-30s %6s\n' "$ev" "$c"; done
  fi

  # ------------------------------------------------ por dia da semana
  # Zeller: pura aritmetica, sem chamar `date` por linha.
  echo
  echo "POR DIA DA SEMANA"
  awk -F'\t' '
    function zeller(y, m, dd,   K, J, h) {
      if (m < 3) { m += 12; y -= 1 }
      K = y % 100; J = int(y / 100)
      h = (dd + int(13*(m+1)/5) + K + int(K/4) + int(J/4) + 5*J) % 7
      return h           # 0=sab 1=dom 2=seg 3=ter 4=qua 5=qui 6=sex
    }
    {
      d = substr($1,1,10)
      y = substr(d,1,4)+0; m = substr(d,6,2)+0; dd = substr(d,9,2)+0
      c[zeller(y,m,dd)]++
    }
    END {
      nome[1]="domingo"; nome[2]="segunda"; nome[3]="terça"; nome[4]="quarta"
      nome[5]="quinta";  nome[6]="sexta";   nome[0]="sábado"
      ordem[0]=1; ordem[1]=2; ordem[2]=3; ordem[3]=4; ordem[4]=5; ordem[5]=6; ordem[6]=0
      for (i=0;i<7;i++) { k=ordem[i]; printf "%s\t%d\n", nome[k], c[k]+0 }
    }' "$arq" > "$tmp/dias"

  local max_d; max_d=$(cut -f2 "$tmp/dias" | sort -rn | head -1)
  while IFS=$'\t' read -r dia c; do
    printf '  %s %6s  %s\n' "$(pad "$dia" 10)" "$c" "$(barra "$c" "$max_d")"
  done < "$tmp/dias"

  # ------------------------------------------------------- por hora
  echo
  echo "POR HORA (fuso do servidor: $FUSO)"
  awk -F'\t' '{h[substr($1,12,2)]++} END {for (i=0;i<24;i++) {k=sprintf("%02d",i); printf "%s\t%d\n", k, h[k]+0}}' "$arq" > "$tmp/horas"
  local max_h; max_h=$(cut -f2 "$tmp/horas" | sort -rn | head -1)
  while IFS=$'\t' read -r h c; do
    [[ "$c" -eq 0 ]] && continue
    printf '  %sh        %6s  %s\n' "$h" "$c" "$(barra "$c" "$max_h")"
  done < "$tmp/horas"
}

# ================================================================ saida
echo "============================================================"
echo " Feijoada Porkinho — relatório de cliques"
echo "============================================================"
echo "Arquivo .....: $LOG (+ rotacionados)"
echo "Gerado em ...: $(date '+%d/%m/%Y %H:%M:%S')"
echo "Linhas /go/ .: $TOTAL_LINHAS"
if [[ "$TOTAL_LINHAS" -gt 0 ]]; then
  # min/max de verdade: `reunir` emite o log corrente e depois os
  # rotacionados em ordem de glob (.1, .10, .2, ...), entao head/tail
  # devolviam um intervalo invertido e arbitrario.
  echo "Período .....: $(awk -F'\t' '{d=substr($1,1,10); if (min=="" || d<min) min=d; if (d>max) max=d} END{print min" a "max}' "$tmp/todos")"
else
  echo
  echo "Log vazio: nenhum clique registrado ainda."
  echo "Confira se a Cache Rule da Cloudflare está com Bypass cache em /go/*."
  exit 0
fi

periodo "HOJE"            "$HOJE"
periodo "ÚLTIMOS 7 DIAS"  "$INI7"
periodo "ÚLTIMOS 30 DIAS" "$INI30"

echo
linha
echo "Os logs são apagados automaticamente após 30 dias (logrotate)."
