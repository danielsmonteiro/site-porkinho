# Feijoada Porkinho — site

Hub de links de <https://feijoadaporkinho.com.br>. A pessoa chega pela bio do
Instagram, pelo QR Code no food truck ou por um link no WhatsApp e precisa
decidir em menos de 5 segundos como comprar.

HTML, CSS e JavaScript puros. Sem framework, sem bundler, sem Node no servidor,
sem etapa de build. Só nginx servindo arquivo estático.

**Hierarquia da página — não mexa nesta ordem:**

1. **iFood** e **99 Food** — os dois botões mais destacados.
2. **Retirada** em um dos 4 food trucks.
3. **WhatsApp** com o Sr. Monteiro — só evento, encomenda grande ou Pix.

---

## Estrutura

```
public/                         tudo o que vai para o servidor
  index.html                    a página
  politica-de-privacidade.html
  404.html  50x.html            páginas de erro no visual do site
  css/style.css
  js/app.js                     SITE_DATA + banner de horário + geolocalização
  img/                          logo, ícones, og-image, fotos dos kits
  fonts/outfit-latin-var.woff2  fonte self-hosted (32 KB, pesos 400–700)
  favicon.ico  site.webmanifest  robots.txt  sitemap.xml

deploy/
  nginx/
    feijoadaporkinho.com.br.conf   server blocks (sites-available)
    cliques.conf                   rotas /go/ (snippets, contexto server)
    seguranca.conf                 cabeçalhos de segurança (snippets)
    log-cliques.conf               log_format (conf.d, contexto http)
    cloudflare-realip.conf         GERADO pelo script — não edite
    logrotate-feijoadaporkinho     retenção de 30 dias
  scripts/
    deploy.sh                      publica public/ no servidor
    update-cloudflare-ips.sh       gera o cloudflare-realip.conf
    relatorio-cliques.sh           lê o log e imprime o relatório
  .env.exemplo                     copie para .env (está no .gitignore)
```

> **Por que `log-cliques.conf` é separado de `cliques.conf`:** a diretiva
> `log_format` só vale no contexto `http` e blocos `location` só valem no
> contexto `server`. Os dois não cabem no mesmo `include`. O formato do log vai
> para `conf.d/` e as rotas vão para `snippets/`.

> **Por que `seguranca.conf` existe:** no nginx, um `add_header` dentro de um
> bloco filho **descarta todos os `add_header` herdados do pai**. Como quase
> todo `location` define o próprio `Cache-Control`, cada um deles perderia CSP,
> `nosniff` e HSTS. Em vez de repetir seis diretivas em onze blocos, elas ficam
> no snippet. **Regra: todo `location` que tiver qualquer `add_header` precisa
> do `include /etc/nginx/snippets/porkinho-seguranca.conf;`.**

> **O `<head>` tem um `<script>` de uma linha** que põe a classe `js` no
> `<html>` antes da primeira pintura — é ele que revela o botão de
> geolocalização sem empurrar a página. Fazer isso no `DOMContentLoaded`
> custava 0,015 de CLS. Ele é liberado na CSP **por hash**, não por
> `'unsafe-inline'`. **Se mudar uma vírgula nesse script, recalcule o hash** e
> troque em `deploy/nginx/seguranca.conf`, senão o navegador bloqueia e o
> botão some:
>
> ```bash
> printf '%s' 'document.documentElement.classList.add("js");' \
>   | openssl dgst -sha256 -binary | openssl base64
> ```

> **Por que os logs não ficam em `/var/log/nginx`:** o pacote nginx do Ubuntu já
> traz `/etc/logrotate.d/nginx` cobrindo `/var/log/nginx/*.log`. Listar os
> mesmos arquivos numa segunda regra faz o logrotate abortar com
> `duplicate log entry` e **pular o arquivo do pacote inteiro** — o `logrotate`
> diário passa a sair com erro e o `access.log` do próprio nginx deixa de ser
> rotacionado. Com os nossos logs em `/var/log/feijoadaporkinho/`, as duas
> regras convivem. Para conferir colisão use o ensaio **global**
> (`sudo logrotate -d /etc/logrotate.conf`); o ensaio de um arquivo isolado não
> mostra o conflito.

---

## Rodar localmente

```bash
cd public
python3 -m http.server 8000
```

Abra <http://localhost:8000>.

O que **não** funciona no servidor local, e isso é esperado:

- as rotas `/go/*` (quem faz o 302 e conta o clique é o nginx) — os botões
  devolvem 404;
- o beacon da Cloudflare.

Para conferir o comportamento sem JavaScript, desligue o JS no DevTools e
recarregue: todos os links e o cardápio inteiro estão no HTML. O JS só
acrescenta o banner de horário, a ordenação por distância e o cardápio aberto
por padrão no desktop.

---

## Token do Cloudflare Web Analytics

No painel: **Analytics & Logs → Web Analytics → Add a site**, e copie o token.

Cole em `public/index.html`, na última linha antes de `</body>`:

```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "SEU_TOKEN_AQUI"}'></script>
```

É a **única** requisição a domínio de terceiro permitida no site. Sem Google
Analytics, sem Tag Manager, sem Meta Pixel.

> **Enquanto o token for o placeholder**, a Cloudflare recusa o envio e o
> navegador registra um erro de CORS no console (`cdn-cgi/rum` sem
> `Access-Control-Allow-Origin`). Isso não quebra nada na página, mas derruba
> a nota de Boas Práticas do Lighthouse de 100 para 96. Assim que o token real
> entrar, o erro some.

---

## Trocar o link de um canal sem quebrar a contagem

O destino real aparece em **três** lugares. Os três precisam mudar juntos:

| Onde | O quê |
|---|---|
| `public/js/app.js` | `SITE_DATA.canais.<canal>.url` |
| `deploy/nginx/cliques.conf` | o `return 302 "..."` da rota |
| `public/index.html` | o atributo `title="..."` do link **e** o JSON-LD |

**Mantenha o nome da rota `/go/...` igual.** É ele que identifica o canal no
histórico do log: trocando só o destino, os números de antes e de depois
continuam comparáveis. Trocando o nome da rota, o histórico se parte em dois.

Depois de editar:

```bash
./deploy/scripts/deploy.sh --configs     # sobe site + configs, roda nginx -t e recarrega
```

Confira se os três arquivos ficaram idênticos:

```bash
grep -o 'https://[^"]*' deploy/nginx/cliques.conf | sort > /tmp/a
grep -oE "url: '[^']*'|mapa: '[^']*'" public/js/app.js | cut -d"'" -f2 | sort > /tmp/b
diff /tmp/a /tmp/b && echo "batem"
```

---

## Adicionar ou remover um ponto de retirada

São quatro mexidas, nesta ordem:

1. **`public/js/app.js`** — entrada nova em `SITE_DATA.pontos` com `id`, `nome`,
   `endereco`, `lat`, `lon`, `rota` e `mapa`. As coordenadas alimentam o cálculo
   de distância; sem elas o ponto nunca aparece como "mais perto".
2. **`deploy/nginx/cliques.conf`** — `location = /go/ponto/<id>` com o
   `return 302` para o Google Maps.
3. **`public/index.html`** — o `<li data-ponto="<id>">` na lista `#pontos`
   (copie um dos existentes) **e** a entrada em `department` no JSON-LD.
4. Publique com `./deploy/scripts/deploy.sh --configs`.

O `data-ponto` do `<li>` tem que ser exatamente igual ao `id` do `SITE_DATA` —
é assim que o JavaScript liga o cartão às coordenadas.

Para **remover**, apague a entrada nos três arquivos. A rota `/go/ponto/<id>`
pode ficar em `cliques.conf` por um tempo: quem tiver o link velho salvo ainda
chega no Maps, e o log mostra que o link antigo ainda circula.

> O ponto do **Cidade Alpha** não opera mais e não deve voltar para o site.

---

## Relatório de cliques

```bash
sudo ./deploy/scripts/relatorio-cliques.sh
sudo ./deploy/scripts/relatorio-cliques.sh /var/log/feijoadaporkinho/cliques.log
LARGURA=60 sudo ./deploy/scripts/relatorio-cliques.sh      # barras mais largas
```

Imprime, para **hoje**, **7 dias** e **30 dias**:

- total por rota, ordenado;
- proporção iFood × 99 Food × WhatsApp;
- ranking dos 4 pontos de retirada;
- cliques por dia da semana e por hora.

Lê também os arquivos rotacionados (`.1`, `.2.gz`…) e roda sem erro em log
vazio. Só usa `awk`, `sort` e `uniq`.

### GoAccess

O mesmo arquivo pode ser lido pelo GoAccess. O log é separado por TAB; ponto de
partida para `~/.goaccessrc` (ajuste se a sua versão reclamar):

```
time-format %H:%M:%S
date-format %Y-%m-%d
log-format %dT%t%^	%U	%s	%h	%^	%^	%R	%u	%^
```

```bash
sudo goaccess /var/log/feijoadaporkinho/cliques.log -o /tmp/cliques.html
```

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
válido 15 anos mas só para tráfego vindo da Cloudflare. Os caminhos ficam em
`/etc/ssl/cloudflare/` e o `deploy/scripts/gerar-csr-origem.sh` gera a chave e o
CSR no servidor, sem a chave privada sair de lá.

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

## Publicar

```bash
export DEPLOY_HOST=... DEPLOY_USER=...     # ou preencha deploy/.env
./deploy/scripts/deploy.sh --seco          # ensaio: mostra o que faria
./deploy/scripts/deploy.sh                 # só o site
./deploy/scripts/deploy.sh --configs       # site + arquivos do nginx
```

O script confere a branch e a árvore de trabalho, sobe `public/` com
`rsync --delete`, ajusta `www-data:www-data` com 644/755, roda `nginx -t`,
recarrega o nginx, opcionalmente limpa o cache da Cloudflare
(`CF_ZONE_ID` + `CF_API_TOKEN`) e no fim exige que
`https://feijoadaporkinho.com.br/health` responda `ok`. Se não responder, o
script falha.

**Nenhum segredo neste repositório.** Host, usuário e tokens vêm do ambiente ou
de `deploy/.env`, que está no `.gitignore`.

### Cache busting

`css/`, `js/`, `img/` e `fonts/` são servidos com `max-age=31536000, immutable`.
Ao mudar o CSS ou o JS, **suba o `?v=` no `index.html`** (e nas outras páginas),
senão o navegador continua com o arquivo velho:

```html
<link rel="stylesheet" href="/css/style.css?v=2">
<script src="/js/app.js?v=2" defer></script>
```

---

## Imagens e paleta

A **logo é a oficial**, a mesma do [Linktree](https://linktr.ee/porkinho) e do
[Instagram](https://www.instagram.com/feijoadaporkinho): o porco-chef no anel
dourado. Dela saem o favicon, os ícones de PWA e a og-image.

O **amarelo do site vem do próprio anel da logo**. O degradê metálico dele vai
de `#945C24` a `#F4EC6C`; `--primaria: #E9D45C` é a faixa clara desse degradê.
Os tons estão todos em `:root` no `css/style.css` — mexendo lá, o site inteiro
acompanha.

> Se trocar a logo, **recalcule o contraste** antes de publicar. O amarelo
> claro funciona porque o texto por cima dele é a tinta escura `#241A0B`
> (11,43:1). Um amarelo mais escuro, ou texto claro por cima, reprova na
> acessibilidade.

### O que ainda é provisório

| Arquivo | Tamanho | Situação |
|---|---|---|
| `img/kit-executiva.*` | 128×128 | **Placeholder** — ilustração de tigela. Entra foto real do Kit Executiva, enquadrada quadrada. |
| `img/kit-completa.*` | 128×128 | **Placeholder** — idem, foto do Kit Completa. |
| `img/og-image.jpg` | 1200×630, < 300 KB | Funcional, montada com a logo. O ideal é uma **foto do Kit Completa** bem iluminada: é isto que aparece quando o link é colado no WhatsApp. |
| `img/logo.webp` / `.png` | 192×192 | Pronto — logo oficial, com transparência. |
| `img/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `../favicon.ico` | — | Prontos, gerados da logo oficial. |

Para trocar, sobrescreva mantendo **o mesmo nome e as mesmas dimensões** — o
HTML já declara `width`/`height`, então não há layout shift. Gere sempre o par
**WebP + JPG**: o `<picture>` entrega WebP a quem aceita e JPG ao resto.

E **suba o `?v=`** da imagem no `index.html`: os arquivos de `/img/` são
servidos com `max-age=31536000, immutable`, então sem isso o navegador de quem
já visitou continua com a imagem velha.

## Privacidade e LGPD

- **Nenhum cookie.** Nenhum identificador persistente. Por isso não existe, e
  não deve existir, banner de consentimento.
- **Cloudflare Web Analytics**, que mede sem cookie e sem impressão digital.
- **Logs com IP** (`/var/log/feijoadaporkinho/{cliques,access,error}.log`),
  apagados automaticamente em **30 dias** pelo logrotate.
- Anonimização do IP fica **pronta e comentada** em
  `deploy/nginx/log-cliques.conf`: descomente o `map` e troque `$remote_addr`
  por `$ip_anon` nos dois `log_format`.
- `public/politica-de-privacidade.html` conta tudo isso em português claro, com
  `contato@feijoadaporkinho.com.br` para exercício de direitos.

---

## O que não fazer

- Não adicionar Google Analytics, Tag Manager, Meta Pixel ou qualquer tag de
  terceiro. A única exceção é o beacon da Cloudflare.
- Não gravar cookie nem identificador persistente.
- Não usar `301` nas rotas `/go/` — o navegador guarda o redirect permanente e a
  partir do segundo clique a contagem para. É sempre `302` + `no-store`.
- Não deixar a Cloudflare cachear `/go/*`.
- Não usar SSL Flexible.
- Não adicionar framework, bundler, Node, Docker ou banco de dados.
- Não criar formulário de contato, chat, newsletter ou pop-up.
- Não pedir geolocalização no carregamento da página — só no clique do botão.
- Não inventar preço, prazo, taxa de entrega ou telefone.
- Não colocar o ponto do Cidade Alpha.
