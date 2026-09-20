#!/usr/bin/env bash
#
# Feijoada Porkinho — emite e instala o certificado do Let's Encrypt.
#
# Usa o desafio DNS-01 (plugin dns-cloudflare), nao o HTTP-01. Motivo: com a
# nuvem laranja ligada, o HTTP-01 exige que a borda da Cloudflare consiga
# falar com a origem — exatamente o que deixa de funcionar quando o
# certificado da origem esta com problema. Seria uma dependencia circular: o
# conserto do certificado dependeria do certificado estar bom. O DNS-01
# valida por registro TXT e nao passa pela porta 80 nem pela origem.
#
# Precisa de um token da Cloudflare com permissao:
#     Zone > DNS > Edit    (na zona feijoadaporkinho.com.br)
#
# Uso, NO SERVIDOR:
#     sudo CF_DNS_TOKEN=xxxxx ./emitir-certificado.sh contato@feijoadaporkinho.com.br
#     sudo CF_DNS_TOKEN=xxxxx ./emitir-certificado.sh --ensaio contato@...   # staging
#
# O token e gravado em /etc/letsencrypt/cloudflare.ini com chmod 600 e e
# usado tambem nas renovacoes automaticas. Ele nunca entra no repositorio.
#
set -euo pipefail

DOMINIO="feijoadaporkinho.com.br"
INI="/etc/letsencrypt/cloudflare.ini"
ENSAIO=0

[[ "${1:-}" == "--ensaio" ]] && { ENSAIO=1; shift; }
EMAIL="${1:-}"

[[ $EUID -eq 0 ]] || { echo "Rode com sudo." >&2; exit 1; }
[[ -n "$EMAIL" ]] || { echo "Informe o e-mail de contato como argumento." >&2; exit 2; }
: "${CF_DNS_TOKEN:?defina CF_DNS_TOKEN (token com Zone > DNS > Edit)}"

echo "==> Gravando as credenciais em $INI"
install -d -m 755 /etc/letsencrypt
umask 077
printf 'dns_cloudflare_api_token = %s\n' "$CF_DNS_TOKEN" > "$INI"
chmod 600 "$INI"

echo "==> Gancho de recarga do nginx nas renovacoes"
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/10-recarrega-nginx.sh <<'GANCHO'
#!/bin/sh
# Recarrega o nginx depois de cada renovacao. O `nginx -t` antes evita
# recarregar uma configuracao quebrada e derrubar o site sozinho de
# madrugada, que e quando o timer do certbot costuma rodar.
nginx -t && systemctl reload nginx
GANCHO
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/10-recarrega-nginx.sh

ARGS=(certonly
  --dns-cloudflare
  --dns-cloudflare-credentials "$INI"
  --dns-cloudflare-propagation-seconds 30
  -d "$DOMINIO" -d "www.$DOMINIO"
  --non-interactive --agree-tos -m "$EMAIL"
  --key-type rsa --rsa-key-size 2048)
[[ "$ENSAIO" -eq 1 ]] && ARGS+=(--staging --cert-name "$DOMINIO-ensaio")

echo "==> certbot ${ENSAIO:+(ENSAIO/staging) }para $DOMINIO e www.$DOMINIO"
certbot "${ARGS[@]}"

if [[ "$ENSAIO" -eq 1 ]]; then
  echo "==> Ensaio concluido. Nada foi trocado no nginx."
  certbot delete --cert-name "$DOMINIO-ensaio" --non-interactive || true
  exit 0
fi

VIVO="/etc/letsencrypt/live/$DOMINIO"
for f in fullchain.pem privkey.pem chain.pem; do
  [[ -s "$VIVO/$f" ]] || { echo "ERRO: falta $VIVO/$f" >&2; exit 1; }
done
echo "==> Certificado em $VIVO"
openssl x509 -in "$VIVO/fullchain.pem" -noout -issuer -subject -dates | sed 's/^/    /'

echo "==> nginx -t"
nginx -t || { echo "ERRO: configuracao invalida; nada recarregado." >&2; exit 1; }
systemctl reload nginx
echo "==> Recarregado."

echo "==> Renovacao automatica"
systemctl list-timers certbot.timer --all --no-pager 2>/dev/null | sed -n '1,2p' || true
certbot renew --dry-run --cert-name "$DOMINIO" 2>&1 | tail -3
