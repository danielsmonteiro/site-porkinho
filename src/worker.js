// ------------------------------------------------------------------------
// Feijoada Porkinho — Cloudflare Worker
//
// Os arquivos de public/ sao servidos pelo Workers Static Assets. Este
// script so roda nas requisicoes que precisam de logica (ver
// run_worker_first no wrangler.jsonc): HTML, /go/*, /health e o resto que
// nao for css/js/img/fonts/favicon/robots/sitemap. Os estaticos vao direto,
// sem consumir a cota diaria de requisicoes do Worker.
//
// O que ele faz:
//   - www -> apex e http -> https (301)
//   - /health responde "ok"
//   - rotas /go/*: 302 para o destino real + contagem do clique
//   - Cache-Control do HTML e paginas 404/50x no visual do site
//
// CABECALHOS DE SEGURANCA (CSP, HSTS, nosniff...) moram em public/_headers,
// fonte unica. Tudo o que sai de env.ASSETS.fetch() ja vem com eles. Os
// 301/302/204 montados aqui nao tem corpo e saem sem eles (o HSTS chega
// pelo HTML).
//
// CONTAGEM DE CLIQUES
// Cada /go/* grava um ponto no Workers Analytics Engine (dataset
// porkinho_cliques). SEM IP e SEM user-agent: so rota, resultado do evento,
// pais e o dominio de origem. So entram rotas e eventos conhecidos; o resto
// cai num balde unico (/go/(desconhecido)), para varredura de robo nao
// encher o dataset nem baguncar o relatorio.
//
// REGRAS QUE NAO PODEM MUDAR
//  - 302, nunca 301, nas rotas /go/. O 301 fica no cache do navegador e a
//    partir do segundo clique a contagem para.
//  - Cache-Control: no-store em todo o /go/.
//  - Os destinos abaixo sao copia literal do SITE_DATA de public/js/app.js.
//    Trocar um link = trocar aqui, no app.js e no title/JSON-LD do index.html.
// ------------------------------------------------------------------------

const DOMINIO = 'feijoadaporkinho.com.br';

const DESTINOS = {
  // --- canais de venda ---
  '/go/ifood': 'https://www.ifood.com.br/delivery/fortaleza-ce/feijoada-porkinho-sapiranga-coite/e4f431c8-ba2c-4a49-bd00-99dbea2c594e?utm_medium=share',
  '/go/99food': 'https://oia.99app.com/dlp9/0DRh5f',
  '/go/whatsapp': 'https://wa.me/5585985900985',
  '/go/instagram': 'https://instagram.com/feijoadaporkinho',
  // --- pontos de retirada (4 food trucks) ---
  '/go/ponto/guararapes': 'https://maps.app.goo.gl/XhSkyXLL1qfAMEk8A',
  '/go/ponto/eusebio': 'https://goo.gl/maps/rtKKp78Pbua8ryKr8',
  '/go/ponto/parque-del-sol': 'https://goo.gl/maps/Dm4Ts9Kn9oQHNPrBA',
  '/go/ponto/sapiranga': 'https://goo.gl/maps/FM5NELs2QDhqmfeTA',
};

// Eventos internos que public/js/app.js dispara (registrarEvento), com os
// valores possiveis de ?r=. Evento novo no app.js = entrada nova aqui.
const EVENTOS = {
  geolocalizacao: ['sucesso', 'negado', 'erro'],
  cardapio: ['aberto'],
};

const DESCONHECIDO = '/go/(desconhecido)';

// Content-Type que o Static Assets nao acerta sozinho.
const TIPOS = { '/site.webmanifest': 'application/manifest+json' };

function cacheControl(caminho) {
  if (caminho === '/site.webmanifest') return 'public, max-age=86400';
  // HTML: sempre revalida
  return 'public, max-age=0, must-revalidate';
}

function semCorpo(status, headers, cache) {
  return new Response(null, { status, headers: { ...headers, 'Cache-Control': cache } });
}

function redirecionar(destino, status) {
  return semCorpo(status, { Location: destino }, status === 302 ? 'no-store' : 'public, max-age=3600');
}

// rota: o que vira indice e blob1 | r: resultado do evento (ou '')
// original: caminho cru, so para o balde de desconhecidos (blob5)
function registrarClique(env, request, rota, r, status, original = '') {
  if (!env.CLIQUES) return;
  let origem = '';
  try {
    const ref = request.headers.get('Referer');
    if (ref) origem = new URL(ref).hostname;
  } catch (_) { /* referer invalido: ignora */ }
  try {
    env.CLIQUES.writeDataPoint({
      indexes: [rota],
      // blob1 rota | blob2 query (?r=...) | blob3 pais | blob4 dominio de origem
      // blob5 caminho original (so em /go/(desconhecido))
      blobs: [rota, r ? `?r=${r}` : '', request.cf?.country || '', origem.slice(0, 100),
        original.slice(0, 100)],
      // double1 status
      doubles: [status],
    });
  } catch (e) {
    console.error('falha ao registrar clique', e);
  }
}

function tratarGo(env, request, url) {
  const caminho = url.pathname;
  const destino = DESTINOS[caminho];
  if (destino) {
    registrarClique(env, request, caminho, '', 302);
    return redirecionar(destino, 302);
  }
  if (caminho.startsWith('/go/evento/')) {
    const nome = caminho.slice('/go/evento/'.length);
    const r = url.searchParams.get('r') || '';
    if (Object.hasOwn(EVENTOS, nome) && EVENTOS[nome].includes(r)) {
      registrarClique(env, request, caminho, r, 204);
    } else {
      registrarClique(env, request, DESCONHECIDO, '', 204, caminho);
    }
    return semCorpo(204, {}, 'no-store');
  }
  // Qualquer outra coisa em /go/: conta no balde (ajuda a achar link velho
  // circulando) e devolve 404.
  registrarClique(env, request, DESCONHECIDO, '', 404, caminho);
  return paginaDeErro(env, request, '/404.html', 404);
}

async function paginaDeErro(env, request, arquivo, status) {
  const r = await env.ASSETS.fetch(new Request(new URL(arquivo, request.url), { method: 'GET' }));
  const resposta = new Response(request.method === 'HEAD' ? null : r.body, { status, headers: r.headers });
  resposta.headers.set('Content-Type', 'text/html; charset=utf-8');
  resposta.headers.set('Cache-Control', 'no-store');
  return resposta;
}

async function tratar(request, env) {
  const url = new URL(request.url);
  const caminho = url.pathname;

  // --- saude: responde em qualquer host e esquema -----------------------
  if (caminho === '/health') {
    return new Response('ok\n', {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }

  // --- www -> apex e http -> https ---------------------------------------
  if (url.hostname === `www.${DOMINIO}` || (url.hostname === DOMINIO && url.protocol === 'http:')) {
    return redirecionar(`https://${DOMINIO}${caminho}${url.search}`, 301);
  }

  // --- contagem de cliques -----------------------------------------------
  if (caminho === '/go' || caminho.startsWith('/go/')) return tratarGo(env, request, url);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed\n', {
      status: 405,
      headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }

  // --- arquivos escondidos e paginas de erro nao sao acessiveis direto ---
  if (/\/\./.test(caminho) || caminho === '/404.html' || caminho === '/50x.html') {
    return paginaDeErro(env, request, '/404.html', 404);
  }

  // --- estaticos ----------------------------------------------------------
  // Caminho terminado em / serve o index.html da pasta.
  let alvo = request;
  if (caminho.endsWith('/')) alvo = new Request(new URL(caminho + 'index.html', url), request);
  const resposta = await env.ASSETS.fetch(alvo);

  if (resposta.status === 404) return paginaDeErro(env, request, '/404.html', 404);

  const r = new Response(resposta.body, resposta);
  r.headers.set('Cache-Control', cacheControl(caminho));
  if (TIPOS[caminho]) r.headers.set('Content-Type', TIPOS[caminho]);
  return r;
}

export default {
  async fetch(request, env) {
    try {
      return await tratar(request, env);
    } catch (e) {
      console.error('erro no worker', e);
      try {
        return await paginaDeErro(env, request, '/50x.html', 500);
      } catch (_) {
        return new Response('Erro interno\n', { status: 500 });
      }
    }
  },
};
