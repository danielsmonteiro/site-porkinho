#!/usr/bin/env bash
#
# Feijoada Porkinho — publicacao em producao.
#
# Sobe public/ para o servidor, ajusta permissoes, valida e recarrega o
# nginx, opcionalmente limpa o cache da Cloudflare e so termina bem se
# /health responder "ok".
#
# NENHUM segredo mora neste repositorio. Host, usuario e tokens vem do
# ambiente (ou de deploy/.env, que esta no .gitignore).
#
#   DEPLOY_HOST     obrigatorio   ex.: 203.0.113.10
#   DEPLOY_USER     obrigatorio   ex.: daniel
#   DEPLOY_PORT     opcional      padrao 22
#   DEPLOY_DESTINO  opcional      padrao /var/www/feijoadaporkinho/public
#   DEPLOY_BRANCH   opcional      padrao main
#   SAUDE_URL       opcional      padrao https://feijoadaporkinho.com.br/health
#   SAUDE_RESOLVE   opcional      ex.: feijoadaporkinho.com.br:443:203.0.113.10
#   SAUDE_INSEGURO  opcional      1 = aceita certificado provisorio na origem
#   CF_ZONE_ID      opcional      liga a limpeza de cache da Cloudflare
#   CF_API_TOKEN    opcional      idem (permissao: Zone > Cache Purge)
#
# Uso:
#   ./deploy.sh                 # so o site
#   ./deploy.sh --configs       # tambem instala os arquivos do nginx
#   ./deploy.sh --scripts       # SO os scripts de manutencao, sem tocar no nginx
#   ./deploy.sh --seco          # mostra o que faria, sem escrever nada
#   ./deploy.sh --forcar        # publica mesmo com a arvore suja
#
# O --scripts existe para o bootstrap: numa maquina nova, emitir-certificado.sh
# precisa estar la ANTES de o --configs rodar, porque a config do nginx aponta
# para /etc/letsencrypt/live/... e o `nginx -t` reprova enquanto o certificado
# nao existir.
#
set -euo pipefail

cd "$(dirname "$0")/../.."
RAIZ="$PWD"

# O ambiente ganha do arquivo: `SAUDE_URL=... ./deploy.sh` tem que valer
# mesmo com um SAUDE_URL definido no deploy/.env. Um `set -a; . .env` faria
# o contrario, atropelando em silencio o que veio da linha de comando.
if [[ -f deploy/.env ]]; then
  while IFS= read -r _linha || [[ -n "$_linha" ]]; do
    [[ "$_linha" =~ ^[[:space:]]*(#|$) ]] && continue
    _chave="${_linha%%=*}"; _chave="${_chave//[[:space:]]/}"
    [[ "$_chave" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ -n "${!_chave+ja_definida}" ]] && continue
    _valor="${_linha#*=}"
    _valor="${_valor#"${_valor%%[![:space:]]*}"}"      # tira espaco a esquerda
    [[ "$_valor" == \"*\" || "$_valor" == \'*\' ]] && _valor="${_valor:1:${#_valor}-2}"
    export "$_chave=$_valor"
  done < deploy/.env
  unset _linha _chave _valor
fi

SECO=0; FORCAR=0; CONFIGS=0; SO_SCRIPTS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seco|--dry-run) SECO=1; shift ;;
    --forcar|--force) FORCAR=1; shift ;;
    --configs)        CONFIGS=1; shift ;;
    --scripts)        SO_SCRIPTS=1; shift ;;
    -h|--help)        sed -n '2,34p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_DESTINO="${DEPLOY_DESTINO:-/var/www/feijoadaporkinho/public}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SAUDE_URL="${SAUDE_URL:-https://feijoadaporkinho.com.br/health}"

falhar() { echo "ERRO: $*" >&2; exit 1; }
passo()  { echo; echo "==> $*"; }

# Todos os scripts que rodam NO servidor. Mantidos a mao, saem de sincronia
# com o repositorio na primeira mudanca de caminho de log ou de certificado.
SCRIPTS_DO_SERVIDOR=(relatorio-cliques.sh update-cloudflare-ips.sh
                     emitir-certificado.sh gerar-csr-origem.sh)

enviar_scripts() {
  tar -C deploy/scripts -cf - "${SCRIPTS_DO_SERVIDOR[@]}" \
    | "${SSH[@]}" 'sudo tar -C /tmp -xf - --one-top-level=porkinho-scripts'
  "${SSH[@]}" "
    set -e
    sudo install -d -m 755 /opt/porkinho-scripts
    for f in ${SCRIPTS_DO_SERVIDOR[*]}; do
      sudo install -m 755 \"/tmp/porkinho-scripts/\$f\" /opt/porkinho-scripts/
    done
    sudo rm -rf /tmp/porkinho-scripts
  "
  echo "    ${#SCRIPTS_DO_SERVIDOR[@]} scripts em /opt/porkinho-scripts"
}

: "${DEPLOY_HOST:?defina DEPLOY_HOST (ex.: export DEPLOY_HOST=203.0.113.10)}"
: "${DEPLOY_USER:?defina DEPLOY_USER (ex.: export DEPLOY_USER=daniel)}"

REMOTO="$DEPLOY_USER@$DEPLOY_HOST"
SSH=(ssh -p "$DEPLOY_PORT" -o BatchMode=yes -o ConnectTimeout=15 "$REMOTO")

# ------------------------------------------------------------- 1. checagens
passo "Conferindo o repositório"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || falhar "isto não é um repositório git"

ATUAL="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$ATUAL" != "$DEPLOY_BRANCH" ]]; then
  falhar "você está em '$ATUAL' e o deploy é da '$DEPLOY_BRANCH'. Troque de branch ou ajuste DEPLOY_BRANCH."
fi
echo "    branch: $ATUAL"

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "$FORCAR" -eq 1 ]]; then
    echo "    AVISO: árvore suja, publicando assim mesmo (--forcar)"
  else
    git status --short
    falhar "árvore de trabalho suja. Faça commit, ou use --forcar se for proposital."
  fi
else
  echo "    árvore limpa em $(git rev-parse --short HEAD)"
fi

[[ -f public/index.html ]] || falhar "public/index.html não existe — diretório errado?"
command -v rsync >/dev/null || falhar "rsync não encontrado nesta máquina"

passo "Conferindo o acesso a $REMOTO"
"${SSH[@]}" true || falhar "não consegui abrir SSH para $REMOTO"

if [[ "$SO_SCRIPTS" -eq 1 ]]; then
  passo "Instalando só os scripts de manutenção"
  if [[ "$SECO" -eq 1 ]]; then
    echo "    [seco] enviaria ${SCRIPTS_DO_SERVIDOR[*]}"
  else
    enviar_scripts
  fi
  echo; echo "Pronto. Nada no nginx e nada em /var/www foi tocado."
  exit 0
fi

# ---------------------------------------------- 2. arquivos de configuracao
if [[ "$CONFIGS" -eq 1 ]]; then
  passo "Instalando os arquivos do nginx"
  if [[ "$SECO" -eq 1 ]]; then
    echo "    [seco] enviaria deploy/nginx/* e deploy/scripts/* e instalaria no servidor"
  else
    tar -C deploy/nginx -cf - . | "${SSH[@]}" 'sudo tar -C /tmp -xf - --one-top-level=porkinho-nginx'
    # Os scripts que rodam NO servidor vao junto. Mantidos a mao, eles saem de
    # sincronia com o repositorio na primeira mudanca de caminho de log.
    enviar_scripts
    "${SSH[@]}" 'bash -s' <<'REMOTO_FIM'
set -euo pipefail
O=/tmp/porkinho-nginx
sudo install -d -m 755 /etc/nginx/snippets /etc/nginx/conf.d /etc/nginx/sites-available
# Diretorio proprio de log: fora de /var/log/nginx de proposito, senao colide
# com o /etc/logrotate.d/nginx do pacote do Ubuntu.
sudo install -d -m 755 -o root -g adm /var/log/feijoadaporkinho
sudo install -m 644 "$O/log-cliques.conf"              /etc/nginx/conf.d/log-cliques.conf
sudo install -m 644 "$O/cliques.conf"                  /etc/nginx/snippets/cliques.conf
sudo install -m 644 "$O/seguranca.conf"                /etc/nginx/snippets/porkinho-seguranca.conf
sudo install -m 644 "$O/feijoadaporkinho.com.br.conf"  /etc/nginx/sites-available/feijoadaporkinho.com.br.conf
sudo install -m 644 "$O/logrotate-feijoadaporkinho"    /etc/logrotate.d/feijoadaporkinho

sudo ln -sfn /etc/nginx/sites-available/feijoadaporkinho.com.br.conf \
             /etc/nginx/sites-enabled/feijoadaporkinho.com.br.conf
# cloudflare-realip.conf e GERADO; so instala o placeholder se nao houver nada la.
if [ ! -s /etc/nginx/conf.d/cloudflare-realip.conf ]; then
  sudo install -m 644 "$O/cloudflare-realip.conf" /etc/nginx/conf.d/cloudflare-realip.conf
  echo "    AVISO: rode update-cloudflare-ips.sh para preencher as faixas reais"
fi
sudo rm -rf "$O"
REMOTO_FIM
    echo "    configs instalados"
  fi
fi

# ------------------------------------------------------------- 3. rsync
passo "Enviando public/ para $REMOTO:$DEPLOY_DESTINO"

# --rsync-path="sudo rsync" e o que faz o segundo deploy funcionar: depois do
# primeiro, tudo la dentro pertence a www-data e o usuario do deploy nao
# consegue mais escrever nos subdiretorios. Rodando o rsync remoto como root,
# a permissao deixa de importar. Exige sudo sem senha para DEPLOY_USER.
RSYNC=(rsync -avz --delete --human-readable
       --exclude '.DS_Store' --exclude 'Thumbs.db' --exclude '*.swp'
       --rsync-path="sudo rsync"
       -e "ssh -p $DEPLOY_PORT -o BatchMode=yes")
[[ "$SECO" -eq 1 ]] && RSYNC+=(--dry-run)

# Criar o destino e escrita: fica de fora do ensaio. O rsync com --dry-run
# nao reclama de diretorio inexistente.
[[ "$SECO" -eq 0 ]] && "${SSH[@]}" "sudo install -d -m 755 '$DEPLOY_DESTINO'"
"${RSYNC[@]}" "$RAIZ/public/" "$REMOTO:$DEPLOY_DESTINO/"

# --------------------------------------------------- 4. dono e permissoes
passo "Ajustando dono e permissões"
if [[ "$SECO" -eq 1 ]]; then
  echo "    [seco] www-data:www-data, 755 em diretórios, 644 em arquivos"
else
  "${SSH[@]}" "
    set -e
    sudo chown -R www-data:www-data '$DEPLOY_DESTINO'
    sudo find '$DEPLOY_DESTINO' -type d -exec chmod 755 {} +
    sudo find '$DEPLOY_DESTINO' -type f -exec chmod 644 {} +
  "
  echo "    ok"
fi

# ------------------------------------------------------------- 5. nginx
passo "Validando e recarregando o nginx"
if [[ "$SECO" -eq 1 ]]; then
  echo "    [seco] sudo nginx -t && sudo systemctl reload nginx"
else
  "${SSH[@]}" 'sudo nginx -t' || falhar "nginx -t reprovou; nada foi recarregado"
  "${SSH[@]}" 'sudo systemctl reload nginx'
  echo "    recarregado"
fi

# ------------------------------------------------- 6. cache da Cloudflare
passo "Cache da Cloudflare"
if [[ -n "${CF_ZONE_ID:-}" && -n "${CF_API_TOKEN:-}" ]]; then
  if [[ "$SECO" -eq 1 ]]; then
    echo "    [seco] purge_everything na zona ${CF_ZONE_ID:0:6}…"
  else
    RESP="$(curl -sS -X POST \
      "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}')" || falhar "falha ao chamar a API da Cloudflare"
    if printf '%s' "$RESP" | grep -q '"success":true'; then
      echo "    cache limpo"
    else
      echo "    AVISO: a Cloudflare recusou a limpeza:" >&2
      printf '    %s\n' "$RESP" >&2
    fi
  fi
else
  echo "    pulado (defina CF_ZONE_ID e CF_API_TOKEN para limpar o cache)"
fi

# ------------------------------------------------------------- 7. saude
passo "Checando $SAUDE_URL"
if [[ "$SECO" -eq 1 ]]; then
  echo "    [seco] curl -sf $SAUDE_URL"
  echo; echo "Ensaio concluído. Nada foi alterado."
  exit 0
fi

CURL=(curl -sf --max-time 15)
# Durante a virada de DNS, da para apontar a checagem direto para a origem:
#   SAUDE_URL=https://feijoadaporkinho.com.br/health
#   SAUDE_RESOLVE=feijoadaporkinho.com.br:443:203.0.113.10
#   SAUDE_INSEGURO=1   (enquanto o certificado ainda for o provisorio)
[[ -n "${SAUDE_RESOLVE:-}" ]] && CURL+=(--resolve "$SAUDE_RESOLVE")
[[ "${SAUDE_INSEGURO:-0}" == "1" ]] && CURL+=(--insecure)

for tentativa in 1 2 3; do
  CORPO="$("${CURL[@]}" "$SAUDE_URL" || true)"
  if [[ "$CORPO" == "ok" ]]; then
    echo "    /health respondeu ok"
    echo
    echo "Publicado: $(git rev-parse --short HEAD) em $DEPLOY_HOST:$DEPLOY_DESTINO"
    exit 0
  fi
  echo "    tentativa $tentativa: resposta inesperada ('${CORPO:-vazio}')"
  sleep 3
done

falhar "/health não respondeu 'ok' em $SAUDE_URL. Os arquivos subiram, mas confira o nginx e o DNS antes de considerar publicado."
