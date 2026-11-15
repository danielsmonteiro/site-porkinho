# Legado — VPS com nginx (até 11/2026)

O site saiu do VPS `192.168.51.106` e passou a ser servido por um **Cloudflare
Worker** (ver o README). Este arquivo guarda como era a instalação antiga, para
o caso de precisar voltar. Os arquivos citados continuam em `deploy/nginx/` e
`deploy/scripts/` (`deploy.sh`, `emitir-certificado.sh`, `update-cloudflare-ips.sh`,
`gerar-csr-origem.sh`).

> **Voltar ao VPS não é só tirar as rotas do Worker.** O VPS está em
> `192.168.51.106`, um IP **privado**: a borda da Cloudflare não tem como
> chegar nele. Era exatamente o que acontecia antes da migração — o site
> respondia **522**. Remover as rotas do Worker com o DNS assim troca um site no
> ar por um site fora do ar.
>
> Para o VPS voltar a servir, antes de mexer no Worker é preciso dar à borda um
> caminho até ele: um IP público com as portas 80/443 liberadas para as faixas
> da Cloudflare (e os registros `A` apontando para esse IP), ou um
> **Cloudflare Tunnel** (`cloudflared`) rodando no servidor. Só depois disso,
> e com `curl -k --resolve feijoadaporkinho.com.br:443:<ip> https://feijoadaporkinho.com.br/health`
> respondendo `ok`, remova as rotas (Workers & Pages → feijoadaporkinho →
> Settings → Domains & Routes).

---

## Instalação no VPS, na ordem certa

Ubuntu 24.04. Os comandos abaixo rodam **no servidor**.

### 1. nginx

```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable --now nginx

# O site de exemplo do Ubuntu tambem declara `default_server` na porta 80 e
# briga com o nosso catch-all. Sem remover, o `nginx -t` reprova.
sudo rm -f /etc/nginx/sites-enabled/default

# Fuso do servidor. Os carimbos de hora do log alimentam o relatorio por
# hora e por dia da semana; em UTC os numeros sairiam 3 horas deslocados.
sudo timedatectl set-timezone America/Fortaleza

# Diretorio proprio de log (o deploy.sh --configs tambem cria).
sudo install -d -m 755 -o root -g adm /var/log/feijoadaporkinho

sudo systemctl restart nginx
```

> **`reload` x `restart`:** o `reload` mantem os workers antigos vivos
> atendendo conexoes keep-alive, entao uma mudanca de cabecalho pode demorar
> a aparecer nos seus testes. Em caso de duvida durante a conferencia, use
> `restart`. No dia a dia, `reload` basta.

### 2. Certificado (Let's Encrypt, via DNS-01)

O certificado é do **Let's Encrypt**, publicamente confiável e renovado sozinho
pelo timer do certbot. Por ser confiável, funciona com o SSL da Cloudflare em
**Full (strict)** e continua válido se um dia o proxy for pausado.

```bash
# --- na sua máquina: leva os scripts de manutenção para o servidor ---
# Tem que ser AGORA, não no passo 4: o --configs instala a config do nginx que
# já aponta para /etc/letsencrypt/live/..., e o `nginx -t` reprova enquanto o
# certificado não existir. O --scripts não toca no nginx nem em /var/www.
./deploy/scripts/deploy.sh --scripts

# --- no servidor ---
sudo apt install -y certbot python3-certbot-dns-cloudflare
sudo CF_DNS_TOKEN=<token> /opt/porkinho-scripts/emitir-certificado.sh --ensaio contato@feijoadaporkinho.com.br
sudo CF_DNS_TOKEN=<token> /opt/porkinho-scripts/emitir-certificado.sh          contato@feijoadaporkinho.com.br
```

O token é da Cloudflare, com permissão **Zone → DNS → Edit** restrita à zona
`feijoadaporkinho.com.br` (modelo pronto "Edit zone DNS"). Ele fica em
`/etc/letsencrypt/cloudflare.ini` com `chmod 600` e **nunca** no repositório.
Se o token for revogado, a renovação automática para de funcionar.

> **Por que DNS-01 e não HTTP-01:** com a nuvem laranja ligada, o HTTP-01 exige
> que a borda da Cloudflare consiga falar com a origem — exatamente o que deixa
> de funcionar quando o certificado da origem está com problema. Seria uma
> dependência circular: consertar o certificado dependeria de ele já estar bom.
> Foi o que aconteceu de fato aqui: com o SSL em Full (strict) e um certificado
> provisório na origem, a borda respondia **526** e nenhum desafio HTTP chegava.
> O DNS-01 valida por registro TXT e não passa pela porta 80 nem pela origem.

> **O `location ~ /\.`** que barra `.git` e `.env` também barrava
> `/.well-known/` inteiro, devolvendo 403 no desafio ACME. Por isso existe o
> `location ^~ /.well-known/acme-challenge/` — o prefixo `^~` ganha do regex.
> O webroot é `/var/www/acme`, **fora** de `/var/www/feijoadaporkinho/public`,
> porque o deploy roda `rsync --delete` e apagaria o desafio no meio da emissão.

A renovação roda pelo `certbot.timer` e recarrega o nginx pelo gancho em
`/etc/letsencrypt/renewal-hooks/deploy/`. Para conferir:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
systemctl list-timers certbot.timer
```

**Alternativa:** um **Cloudflare Origin Certificate** (SSL/TLS → Origin Server),
válido 15 anos mas só para tráfego vindo da Cloudflare.
`deploy/scripts/gerar-csr-origem.sh` gera a chave e o CSR no servidor, sem a
chave privada sair de lá.

> Trocar exige **duas** coisas: instalar os arquivos em `/etc/ssl/cloudflare/`
> **e** apontar os dois pares `ssl_certificate` / `ssl_certificate_key` da
> config para lá. Só copiar os arquivos não muda nada — o nginx recarrega sem
> erro e segue servindo o Let's Encrypt, dando a impressão de que a troca
> funcionou.

### 3. Faixas de IP da Cloudflare

```bash
sudo ./deploy/scripts/update-cloudflare-ips.sh
```

Sem isso, o IP registrado no log seria sempre o da borda da Cloudflare e a
contagem de cliques não serviria para nada. As faixas mudam — rode de novo de
vez em quando. Cron mensal (deixe comentado até conferir o caminho):

```cron
# 17 4 1 * * root /opt/site-porkinho/deploy/scripts/update-cloudflare-ips.sh >> /var/log/cf-ips.log 2>&1
```

### 4. Arquivos do nginx e o site

Da sua máquina:

```bash
cp deploy/.env.exemplo deploy/.env   # preencha DEPLOY_HOST e DEPLOY_USER
./deploy/scripts/deploy.sh --configs
```

### 5. Authenticated Origin Pulls (recomendado, dois passos)

Primeiro baixe a CA que valida o certificado de cliente que a Cloudflare
apresenta — **nada mais no repositório cria esse arquivo**, e sem ele o
`nginx -t` reprova com "cannot load certificate":

```bash
sudo install -d -m 755 /etc/ssl/cloudflare
sudo curl -fsSL -o /etc/ssl/cloudflare/origin-pull-ca.pem \
  https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
```

As duas linhas abaixo vêm **comentadas** em
`deploy/nginx/feijoadaporkinho.com.br.conf`:

```nginx
# ssl_client_certificate /etc/ssl/cloudflare/origin-pull-ca.pem;
# ssl_verify_client on;
```

Ligue **primeiro no painel** (SSL/TLS → Origin Server → Authenticated Origin
Pulls) e **só depois** descomente e recarregue. Na ordem invertida o nginx passa
a recusar todo mundo — inclusive a Cloudflare — e o site cai.

### 6. Firewall

Gere e confira antes de aplicar. **Não execute às cegas: uma regra errada de SSH
te tranca para fora do servidor.**

```bash
# SSH primeiro, senão você se tranca para fora
sudo ufw allow from SEU.IP.FIXO.AQUI to any port 22 proto tcp comment 'ssh admin'

# 80 e 443 só das faixas da Cloudflare
for faixa in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo ufw allow from "$faixa" to any port 80,443 proto tcp comment 'cloudflare'
done
for faixa in $(curl -s https://www.cloudflare.com/ips-v6); do
  sudo ufw allow from "$faixa" to any port 80,443 proto tcp comment 'cloudflare'
done

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status numbered
```

---

## Painel da Cloudflare — o que precisa estar ligado

| # | Onde | Valor |
|---|---|---|
| 1 | SSL/TLS → Overview | **Full (strict)**. Nunca Flexible — ver o quadro abaixo. |
| 2 | SSL/TLS → Edge Certificates | **Always Use HTTPS**: ligado |
| 3 | SSL/TLS → Edge Certificates | **Automatic HTTPS Rewrites**: ligado |
| 4 | SSL/TLS → Edge Certificates | **Minimum TLS Version**: 1.2 |
| 5 | Speed → Optimization → Content | **Brotli**: ligado |
| 6 | SSL/TLS → Origin Server | **Authenticated Origin Pulls**: ligado (ver passo 5 acima) |
| 7 | DNS | `A @` e `A www` → IP do VPS, **os dois com nuvem laranja** |
| 8 | Analytics & Logs → Web Analytics | ligado; copie o token para o `index.html` |
| 9 | Caching → Cache Rules | `URI Path starts with /go/` → **Bypass cache** |
| 10 | Scrape Shield → Email Address Obfuscation | Tanto faz — o HTML já se protege com `<!--email_off-->`. Ver abaixo. |

### A Cloudflare reescreve o e-mail do rodapé

Com **Email Address Obfuscation** ligada (Scrape Shield), a borda troca
`<a href="mailto:...">` por `/cdn-cgi/l/email-protection` e o texto visível por
`[email protected]`, que só volta ao normal com um script injetado. Resultado:
**sem JavaScript o contato fica ilegível** — inclusive na política de
privacidade, que é onde o endereço para exercício de direitos da LGPD precisa
estar.

Os `<!--email_off-->` em volta de cada `mailto:` já resolvem isso no HTML, sem
depender de configuração de conta. **Se algum dia acrescentar um e-mail novo,
envolva com os marcadores também**, e confira:

```bash
curl -s https://feijoadaporkinho.com.br/ | grep -c '__cf_email__'   # tem que ser 0
```

### Se o site entrar em loop de redirecionamento

Sintoma: `https://feijoadaporkinho.com.br/` responde **301 para ela mesma**, sem
parar. Causa quase certa: **SSL/TLS em Flexible**. Nesse modo a Cloudflare
conecta na origem em **http/80**, recebe o nosso 301 para HTTPS, devolve ao
navegador, que volta pela borda, e assim por diante. De quebra, o trecho
Cloudflare↔VPS trafega sem criptografia.

Como confirmar em dez segundos, olhando a coluna `esquema/porta` do log:

```bash
sudo tail -3 /var/log/feijoadaporkinho/access.log
# http/80   -> SSL está em Flexible. É esse o problema.
# https/443 -> a origem está sendo acessada certo.
```

Correção: **SSL/TLS → Overview → Full**. Use *Full (strict)* somente depois de
instalar o Cloudflare Origin Certificate — com um certificado auto-assinado na
origem, o *strict* responde erro 526.

O item **9 não é opcional**. Sem ele a borda responde o redirect do próprio
cache, a requisição não chega ao VPS e o clique não é contado.

Se existir alguma **Redirect Rule / Page Rule antiga** mandando o domínio para
outro lugar, desative antes — ela vence o site. Em 19/09/2026 havia uma regra
ativa mandando `feijoadaporkinho.com.br` para `https://linktr.ee/porkinho`:
**enquanto ela existir, ninguém chega neste site.**

---

## Publicar (VPS)

```bash
export DEPLOY_HOST=... DEPLOY_USER=...     # ou preencha deploy/.env
./deploy/scripts/deploy.sh --seco          # ensaio: mostra o que faria
./deploy/scripts/deploy.sh                 # só o site
./deploy/scripts/deploy.sh --configs       # site + arquivos do nginx
./deploy/scripts/deploy.sh --scripts       # só os scripts de manutenção (bootstrap)
```

O script confere a branch e a árvore de trabalho, sobe `public/` com
`rsync --delete`, ajusta `www-data:www-data` com 644/755, roda `nginx -t`,
recarrega o nginx, opcionalmente limpa o cache da Cloudflare
(`CF_ZONE_ID` + `CF_API_TOKEN`) e no fim exige que
`https://feijoadaporkinho.com.br/health` responda `ok`. Se não responder, o
script falha.

**Nenhum segredo neste repositório.** Host, usuário e tokens vêm do ambiente ou
de `deploy/.env`, que está no `.gitignore`.
