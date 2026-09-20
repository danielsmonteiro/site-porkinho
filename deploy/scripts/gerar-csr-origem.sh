#!/usr/bin/env bash
#
# Feijoada Porkinho — prepara o pedido do Cloudflare Origin Certificate.
#
# Gera a chave privada DIRETO NO SERVIDOR e imprime so o CSR. A chave nunca
# sai da maquina, nunca passa por chat, e-mail ou repositorio — o CSR e a
# parte publica do pedido e pode ser colado no painel sem receio.
#
# Fluxo:
#   1. rode este script no servidor           -> ele imprime o CSR
#   2. painel da Cloudflare: SSL/TLS > Origin Server > Create Certificate
#      marque "Use my private key and CSR", cole o CSR, validade 15 anos
#   3. copie o certificado devolvido e instale com:
#         sudo tee /etc/ssl/cloudflare/feijoadaporkinho.com.br.pem
#         sudo chmod 644 /etc/ssl/cloudflare/feijoadaporkinho.com.br.pem
#         sudo nginx -t && sudo systemctl reload nginx
#
# A chave existente so e substituida com --forcar, para nao invalidar um
# certificado que ja esteja em uso.
#
set -euo pipefail

DIR="/etc/ssl/cloudflare"
DOMINIO="feijoadaporkinho.com.br"
CHAVE="$DIR/$DOMINIO.key"
CSR="$DIR/$DOMINIO.csr"
FORCAR=0

[[ "${1:-}" == "--forcar" ]] && FORCAR=1

sudo install -d -m 755 "$DIR"

if [[ -f "$CHAVE" && "$FORCAR" -eq 0 ]]; then
  echo "==> Reaproveitando a chave que ja existe em $CHAVE" >&2
  echo "    (use --forcar para gerar uma nova — isso invalida o certificado atual)" >&2
else
  echo "==> Gerando chave privada RSA 2048" >&2
  sudo openssl genrsa -out "$CHAVE" 2048 2>/dev/null
  sudo chmod 600 "$CHAVE"
  sudo chown root:root "$CHAVE"
fi

echo "==> Gerando o CSR para $DOMINIO e *.$DOMINIO" >&2
sudo openssl req -new -key "$CHAVE" -out "$CSR" -subj "/CN=$DOMINIO" \
  -addext "subjectAltName=DNS:$DOMINIO,DNS:*.$DOMINIO" 2>/dev/null
sudo chmod 644 "$CSR"

echo >&2
echo "================ COLE ISTO NO PAINEL DA CLOUDFLARE ================" >&2
sudo cat "$CSR"
echo "===================================================================" >&2
echo >&2
echo "Chave privada .: $CHAVE (chmod $(sudo stat -c %a "$CHAVE"), nao sai daqui)" >&2
echo "CSR ...........: $CSR" >&2
