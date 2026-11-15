# Feijoada Porkinho — site

Hub de links de <https://feijoadaporkinho.com.br>. A pessoa chega pela bio do
Instagram, pelo QR Code no food truck ou por um link no WhatsApp e precisa
decidir em menos de 5 segundos como comprar.

HTML, CSS e JavaScript puros. Sem framework, sem bundler, sem etapa de build.
Servido por um Cloudflare Worker (arquivos estáticos + um script de ~200 linhas
que faz os redirects `/go/` e os cabeçalhos).

**Hierarquia da página — não mexa nesta ordem:**

1. **iFood** e **99 Food** — os dois botões mais destacados.
2. **Retirada** em um dos 4 food trucks.
3. **WhatsApp** com o Sr. Monteiro — só evento, encomenda grande ou Pix.

---

## Estrutura

```
public/                         tudo o que vai para a Cloudflare (Static Assets)
  index.html                    a página
  politica-de-privacidade.html
  404.html  50x.html            páginas de erro no visual do site
  css/style.css
  js/app.js                     SITE_DATA + banner de horário + geolocalização
  img/                          logo, ícones, og-image, fotos dos kits
  fonts/outfit-latin-var.woff2  fonte self-hosted (32 KB, pesos 400–700)
  favicon.ico  site.webmanifest  robots.txt  sitemap.xml
  _headers                      CSP, HSTS e Cache-Control dos arquivos (fonte única)
  .assetsignore                 o que NÃO sobe para a Cloudflare

src/worker.js                   redirects /go/, www → apex, cache do HTML, páginas de erro
wrangler.jsonc                  configuração do Worker (rotas, dataset de cliques)
.github/workflows/publicar.yml  verifica todo PR e publica a cada push na main

deploy/
  scripts/relatorio-cliques.sh  relatório de cliques (Analytics Engine)
  scripts/carregar-env.sh       lê deploy/.env para o ambiente
  .env.exemplo                  copie para .env (está no .gitignore)
```

> **O `<head>` tem um `<script>` de uma linha** que põe a classe `js` no
> `<html>` antes da primeira pintura — é ele que revela o botão de
> geolocalização sem empurrar a página. Fazer isso no `DOMContentLoaded`
> custava 0,015 de CLS. Ele é liberado na CSP **por hash**, não por
> `'unsafe-inline'`. **Se mudar uma vírgula nesse script, recalcule o hash** e
> troque no `public/_headers`, senão o navegador bloqueia e o
> botão some:
>
> ```bash
> printf '%s' 'document.documentElement.classList.add("js");' \
>   | openssl dgst -sha256 -binary | openssl base64
> ```

---

## Rodar localmente

Com o Worker inteiro (rotas `/go/`, cabeçalhos, 404):

```bash
npx wrangler@4.156.0 dev --local --local-protocol https
```

Abra <https://localhost:8787> (o certificado é local, aceite o aviso). Use
`--local-protocol https` mesmo: em HTTP o Worker vê `http://feijoadaporkinho.com.br`
e responde 301 para HTTPS, como em produção.

Sem Node, só os arquivos:

```bash
cd public
python3 -m http.server 8000
```

Nesse modo as rotas `/go/*` devolvem 404 (quem faz o 302 é o Worker) e o beacon
da Cloudflare não funciona — é esperado.

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
| `src/worker.js` | a entrada da rota em `DESTINOS` |
| `public/index.html` | o atributo `title="..."` do link **e** o JSON-LD |

**Mantenha o nome da rota `/go/...` igual.** É ele que identifica o canal no
histórico do log: trocando só o destino, os números de antes e de depois
continuam comparáveis. Trocando o nome da rota, o histórico se parte em dois.

Depois de editar:

```bash
npx wrangler@4.156.0 deploy     # ver "Publicar"
```

Confira se os três arquivos ficaram idênticos:

```bash
grep -oE "': 'https://[^']*'" src/worker.js | cut -d"'" -f3 | sort > /tmp/a
grep -oE "url: '[^']*'|mapa: '[^']*'" public/js/app.js | cut -d"'" -f2 | sort > /tmp/b
diff /tmp/a /tmp/b && echo "batem"
```

---

## Adicionar ou remover um ponto de retirada

São quatro mexidas, nesta ordem:

1. **`public/js/app.js`** — entrada nova em `SITE_DATA.pontos` com `id`, `nome`,
   `endereco`, `lat`, `lon`, `rota` e `mapa`. As coordenadas alimentam o cálculo
   de distância; sem elas o ponto nunca aparece como "mais perto".
2. **`src/worker.js`** — entrada `'/go/ponto/<id>': '<link do Google Maps>'`
   em `DESTINOS`.
3. **`public/index.html`** — o `<li data-ponto="<id>">` na lista `#pontos`
   (copie um dos existentes) **e** a entrada em `department` no JSON-LD.
4. Publique (ver "Publicar").

O `data-ponto` do `<li>` tem que ser exatamente igual ao `id` do `SITE_DATA` —
é assim que o JavaScript liga o cartão às coordenadas.

Para **remover**, apague a entrada nos três arquivos. A rota `/go/ponto/<id>`
pode ficar em `DESTINOS` por um tempo: quem tiver o link velho salvo ainda
chega no Maps, e o relatório mostra que o link antigo ainda circula.

> O ponto do **Cidade Alpha** não opera mais e não deve voltar para o site.

---

## Relatório de cliques

Cada `/go/*` grava um ponto no **Workers Analytics Engine** (dataset
`porkinho_cliques`) com rota, resultado do evento (`?r=`), status, país e o
domínio de origem — **sem IP e sem user-agent**. Só entram as rotas de
`DESTINOS` e os eventos de `EVENTOS` (`src/worker.js`) com os `?r=` previstos;
qualquer outra coisa em `/go/` cai num balde único, **`/go/(desconhecido)`**,
com o caminho original guardado à parte (`blob5`). Assim varredura de robô não
enche o relatório, e link velho circulando ainda aparece:

```sql
SELECT blob5 AS caminho, SUM(_sample_interval) AS n FROM porkinho_cliques
WHERE blob1 = '/go/(desconhecido)' GROUP BY caminho ORDER BY n DESC
```

> **Evento novo no `app.js`** (`registrarEvento`) precisa de entrada em
> `EVENTOS`, senão é contado como desconhecido.

O relatório roda na sua máquina e lê de lá:

```bash
./deploy/scripts/relatorio-cliques.sh                     # lê CLOUDFLARE_* do deploy/.env
LARGURA=60 ./deploy/scripts/relatorio-cliques.sh          # barras mais largas
./deploy/scripts/relatorio-cliques.sh logs/cliques-nginx-anonimo.log   # histórico de 09–10/2026
```

Imprime, para **hoje**, **7 dias** e **30 dias** (horário de Fortaleza):

- total por rota, ordenado;
- proporção iFood × 99 Food × WhatsApp;
- ranking dos 4 pontos de retirada;
- cliques por dia da semana e por hora.

O histórico de antes do Worker (20/09 a 07/10/2026, 217 cliques, do tempo em
que o site rodava num servidor próprio com nginx) foi salvo em
`logs/cliques-nginx-anonimo.log` — fora do git, já sem IP e sem user-agent.

Para consultas avulsas, a SQL API aceita qualquer `SELECT`:

```bash
set -a; . deploy/.env; set +a
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --data "SELECT blob1 AS rota, SUM(_sample_interval) AS cliques FROM porkinho_cliques
          WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY rota ORDER BY cliques DESC"
```

O Analytics Engine guarda os pontos por **3 meses**.

---

## Infraestrutura — Cloudflare Worker

Desde 11/2026 o site roda num **Cloudflare Worker** com *Static Assets*. Não há
servidor: `public/` é enviado para a Cloudflare e o trabalho se divide assim:

| O quê | Onde |
|---|---|
| `www` → apex e `http` → `https` (301) | `src/worker.js` |
| `/health` responde `ok` | `src/worker.js` |
| rotas `/go/*` (302 + `no-store`) e contagem do clique | `src/worker.js`, tabelas `DESTINOS` e `EVENTOS` |
| CSP, HSTS, `nosniff`, Referrer/Permissions-Policy | `public/_headers` (fonte única) |
| `Cache-Control` de css/js/img/fonts e arquivos de raiz | `public/_headers` |
| `Cache-Control` do HTML, 404.html e 50x.html | `src/worker.js` |
| quais caminhos passam pelo Worker, rotas da zona, dataset | `wrangler.jsonc` |

> **O Worker não roda para css/js/img/fonts, favicon, robots e sitemap**
> (`run_worker_first` no `wrangler.jsonc`). Esses arquivos saem direto, de
> graça e sem limite. A conta está no plano **Free**, com **100 mil execuções do
> Worker por dia**; se cada imagem passasse por ele, uma visita gastaria ~10
> execuções e um pico de ~10 mil visitas derrubaria o site inteiro (erro 1027)
> até a cota zerar. Hoje uma visita gasta 1–2. **Arquivo novo fora dessas pastas
> passa pelo Worker** — ponha imagem em `img/`, nunca na raiz.
>
> Os 301/302/204 que o Worker monta não têm corpo e saem sem CSP; o HSTS chega
> pelas páginas HTML.

O Worker está preso às **rotas** `feijoadaporkinho.com.br/*` e
`www.feijoadaporkinho.com.br/*`. As rotas só funcionam se existir um registro
DNS **com nuvem laranja** para cada um dos dois nomes; o conteúdo do registro
não importa, porque o Worker responde antes de qualquer origem. **Não apague
esses registros nem desligue a nuvem laranja** — o site sai do ar.

> Até 11/2026 o site rodou num servidor próprio com nginx. O servidor foi
> desligado e os arquivos dele saíram do repositório; estão no histórico do git
> (antes do commit que removeu `deploy/nginx/`), se um dia precisar consultar.

Como o Worker roda antes do cache da Cloudflare, cada clique em `/go/*` sempre
passa por ele: não é preciso Cache Rule de bypass.

### Publicar

**É automático: todo push na `main` publica.** O workflow
`.github/workflows/publicar.yml` (GitHub Actions) faz duas coisas:

- **em todo PR para a `main`**: confere a sintaxe do JS e dos scripts, confere
  se os destinos de `/go/` batem entre `src/worker.js` e `public/js/app.js` e
  roda um `wrangler deploy --dry-run`. É o check que aparece no PR;
- **em push na `main`** (o merge de um PR): repete a verificação, publica na
  Cloudflare e falha se `/health` não responder `ok`.

O deploy usa dois secrets do repositório (Settings → Secrets and variables →
Actions): `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O token precisa só de
Account → Workers Scripts → Edit, Zone → Workers Routes → Edit e Zone → Zone →
Read na zona `feijoadaporkinho.com.br`. PR vindo de fork não recebe os secrets e
nunca publica. Para republicar sem commit novo: aba **Actions → Publicar → Run
workflow**.

**Na mão, da sua máquina** (emergência, ou para testar antes do merge): precisa
de Node (só na sua máquina, nunca no site) e de `deploy/.env` com
`CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` (permissões no
`deploy/.env.exemplo`). Um deploy feito assim é sobrescrito pelo próximo push na
`main`.

```bash
set -a; . deploy/.env; set +a
npx wrangler@4.156.0 deploy --dry-run     # ensaio: mostra os arquivos e as rotas
npx wrangler@4.156.0 deploy               # publica
curl -s https://feijoadaporkinho.com.br/health   # tem que responder ok
```

Mantenha a versão do wrangler **fixa** (`@4.156.0`, a mesma no README e no
workflow): o `compatibility_date` do `wrangler.jsonc` não pode ser mais novo que
o runtime que a versão traz, senão o `wrangler dev` nem sobe.

Para voltar uma versão: `npx wrangler@4.156.0 rollback`.

**Nenhum segredo neste repositório.** O token fica nos secrets do GitHub e, na
sua máquina, em `deploy/.env`, que está no `.gitignore`.

### Painel da Cloudflare — o que precisa estar ligado

| Onde | Valor |
|---|---|
| SSL/TLS → Edge Certificates | **Always Use HTTPS** ligado, **Minimum TLS** 1.2 |
| Analytics & Logs → Web Analytics | ligado; token no `index.html` (ver acima) |
| Rules → Redirect Rules / Page Rules | **nenhuma** regra para este domínio — ela vence o Worker. Em 19/09/2026 havia uma mandando tudo para o Linktree. |
| Scrape Shield → Email Address Obfuscation | tanto faz: o HTML se protege com `<!--email_off-->` (ver abaixo) |

O modo SSL (Full/Flexible) e certificado de origem não se aplicam: com o Worker
não existe conexão com origem.

> **E-mail no HTML:** com *Email Address Obfuscation* ligada, a borda troca o
> `mailto:` por `/cdn-cgi/l/email-protection`, que só volta ao normal com JS — e
> o contato da LGPD fica ilegível sem JavaScript. Todo `mailto:` vai entre
> `<!--email_off-->` e `<!--email_on-->`. Confira depois de publicar:
>
> ```bash
> curl -s https://feijoadaporkinho.com.br/ | grep -c '__cf_email__'   # tem que ser 0
> ```

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
- **Contagem de cliques sem IP e sem user-agent** (Analytics Engine: rota,
  horário, país, domínio de origem), guardada por 3 meses.
- **Logs do Worker** (Workers Logs, ligados em `observability`) ficam poucos
  dias na Cloudflare — bem dentro dos 30 dias da política.
- `public/politica-de-privacidade.html` conta tudo isso em português claro, com
  `contato@feijoadaporkinho.com.br` para exercício de direitos.

---

## O que não fazer

- Não adicionar Google Analytics, Tag Manager, Meta Pixel ou qualquer tag de
  terceiro. A única exceção é o beacon da Cloudflare.
- Não gravar cookie nem identificador persistente.
- Não usar `301` nas rotas `/go/` — o navegador guarda o redirect permanente e a
  partir do segundo clique a contagem para. É sempre `302` + `no-store`.
- Não deixar a Cloudflare cachear `/go/*` (não criar Cache Rule que "cache everything" na frente do Worker).
- Não gravar IP nem user-agent no Analytics Engine.
- Não adicionar framework, bundler, Docker ou banco de dados. Node só na sua
  máquina, para o `wrangler`; o site não depende dele.
- Não criar formulário de contato, chat, newsletter ou pop-up.
- Não pedir geolocalização no carregamento da página — só no clique do botão.
- Não inventar preço, prazo, taxa de entrega ou telefone.
- Não colocar o ponto do Cidade Alpha.
