# shellcheck shell=bash
#
# Feijoada Porkinho — le deploy/.env para o ambiente. Usado com `source` pelo
# deploy.sh e pelo relatorio-cliques.sh; chame a partir da raiz do repositorio.
#
# O ambiente ganha do arquivo: `SAUDE_URL=... ./deploy.sh` tem que valer
# mesmo com um SAUDE_URL definido no deploy/.env. Um `set -a; . .env` faria
# o contrario, atropelando em silencio o que veio da linha de comando.
#
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
