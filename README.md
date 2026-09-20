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
sudo ./deploy/scripts/relatorio-cliques.sh /var/log/nginx/cliques.log
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
sudo goaccess /var/log/nginx/cliques.log -o /tmp/cliques.html
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
sudo systemctl restart nginx
```

> **`reload` x `restart`:** o `reload` mantem os workers antigos vivos
> atendendo conexoes keep-alive, entao uma mudanca de cabecalho pode demorar
> a aparecer nos seus testes. Em caso de duvida durante a conferencia, use
> `restart`. No dia a dia, `reload` basta.

### 2. Certificado de origem da Cloudflare

No painel: **SSL/TLS → Origin Server → Create Certificate**, RSA 2048, validade
de 15 anos, hostnames `feijoadaporkinho.com.br` e `*.feijoadaporkinho.com.br`.

```bash
sudo install -d -m 755 /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/feijoadaporkinho.com.br.pem   # cole o certificado
sudo nano /etc/ssl/cloudflare/feijoadaporkinho.com.br.key   # cole a chave privada
sudo chmod 644 /etc/ssl/cloudflare/feijoadaporkinho.com.br.pem
sudo chmod 600 /etc/ssl/cloudflare/feijoadaporkinho.com.br.key

# CA para o Authenticated Origin Pulls
sudo curl -fsSL -o /etc/ssl/cloudflare/origin-pull-ca.pem \
  https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem
```

Esse certificado **só vale para conexões vindas da Cloudflare**. Abrir
`https://<IP-do-VPS>` direto no navegador acusa certificado inválido — isso é
esperado e correto.

> **Atenção:** hoje o servidor está com um certificado **auto-assinado
> provisório**, gerado só para o nginx subir e o site poder ser testado. Ele
> funciona com o SSL em *Full*, mas **não** em *Full (strict)*. Troque pelo
> Cloudflare Origin Certificate antes de colocar o SSL em Full (strict).

**Não instale Certbot nem Let's Encrypt.** É redundante e o desafio HTTP-01
briga com o proxy laranja.

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
| 1 | SSL/TLS → Overview | **Full (strict)**. Nunca Flexible: gera loop de redirecionamento e deixa o tráfego Cloudflare↔VPS sem criptografia. |
| 2 | SSL/TLS → Edge Certificates | **Always Use HTTPS**: ligado |
| 3 | SSL/TLS → Edge Certificates | **Automatic HTTPS Rewrites**: ligado |
| 4 | SSL/TLS → Edge Certificates | **Minimum TLS Version**: 1.2 |
| 5 | Speed → Optimization → Content | **Brotli**: ligado |
| 6 | SSL/TLS → Origin Server | **Authenticated Origin Pulls**: ligado (ver passo 5 acima) |
| 7 | DNS | `A @` e `A www` → IP do VPS, **os dois com nuvem laranja** |
| 8 | Analytics & Logs → Web Analytics | ligado; copie o token para o `index.html` |
| 9 | Caching → Cache Rules | `URI Path starts with /go/` → **Bypass cache** |

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

## Imagens — o que ainda é provisório

Tudo em `public/img/` foi gerado a partir de formas simples, sem nenhuma foto
real. Nada disso veio de banco de imagens. Para trocar, basta sobrescrever o
arquivo mantendo **o mesmo nome e as mesmas dimensões** — o HTML já declara
`width`/`height`, então nada de layout shift.

| Arquivo | Tamanho | O que precisa entrar |
|---|---|---|
| `logo.webp` / `logo.jpg` | 192×192 | A logo oficial da marca. Aparece recortada em círculo. |
| `og-image.jpg` | 1200×630, < 300 KB | **O mais importante.** Foto do Kit Completa, bonita e bem iluminada. É o que aparece quando o link é colado no WhatsApp. |
| `kit-executiva.webp` / `.jpg` | 128×128 | Foto do Kit Executiva, enquadrada quadrada. |
| `kit-completa.webp` / `.jpg` | 128×128 | Foto do Kit Completa, enquadrada quadrada. |
| `icon-192.png`, `icon-512.png` | 192, 512 | Ícone do app (tela de início do celular). |
| `icon-maskable-512.png` | 512 | Mesmo ícone com folga nas bordas (Android recorta). |
| `apple-touch-icon.png` | 180×180 | Ícone no iPhone. |
| `../favicon.ico` | 16/32/48 | Ícone da aba do navegador. |

Gere sempre o par **WebP + JPG**: o `<picture>` entrega WebP a quem aceita e JPG
ao resto.

---

## Privacidade e LGPD

- **Nenhum cookie.** Nenhum identificador persistente. Por isso não existe, e
  não deve existir, banner de consentimento.
- **Cloudflare Web Analytics**, que mede sem cookie e sem impressão digital.
- **Logs com IP** (`cliques.log` e `access.log`), apagados automaticamente em
  **30 dias** pelo logrotate.
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
- Não instalar Certbot nem Let's Encrypt.
- Não usar SSL Flexible.
- Não adicionar framework, bundler, Node, Docker ou banco de dados.
- Não criar formulário de contato, chat, newsletter ou pop-up.
- Não pedir geolocalização no carregamento da página — só no clique do botão.
- Não inventar preço, prazo, taxa de entrega ou telefone.
- Não colocar o ponto do Cidade Alpha.
