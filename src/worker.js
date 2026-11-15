// ------------------------------------------------------------------------
// Feijoada Porkinho — Cloudflare Worker
//
// Substitui o nginx do VPS. Os arquivos de public/ sao servidos pelo
// Workers Static Assets (binding ASSETS); este script roda ANTES deles
// (run_worker_first) e faz o que o nginx fazia:
//
//   - www -> apex (301) e http -> https (301)
//   - /health responde "ok"
//   - rotas /go/*: 302 para o destino real + contagem do clique
//   - cabecalhos de seguranca (CSP, HSTS, nosniff...) em TODA resposta
//   - Cache-Control por tipo de arquivo
//   - 404.html e 50x.html no visual do site
//
// CONTAGEM DE CLIQUES
// Cada /go/* grava um ponto no Workers Analytics Engine (dataset
// porkinho_cliques). SEM IP e SEM user-agent: so rota, status, pais e o
// dominio de origem. O relatorio sai de deploy/scripts/relatorio-cliques.sh.
//
// REGRAS QUE NAO PODEM MUDAR (herdadas do nginx)
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

// Se mudar o <script> inline do <head>, recalcule o hash (ver README).
const SEGURANCA = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'sha256-WZRJfWvsnNCPcxzZwvyhovnZGqhZaC+8gPGPRbx6wTk=' https://static.cloudflareinsights.com; " +
    "style-src 'self' 'unsafe-inline'; connect-src 'self' https://cloudflareinsights.com; " +
    "img-src 'self' data:; font-src 'self'; form-action 'none'; frame-ancestors 'none'; " +
    "base-uri 'self'; object-src 'none'; manifest-src 'self'",
};

const IMUTAVEL = 'public, max-age=31536000, immutable';

function cacheControl(caminho, status) {
  if (status === 404 || status >= 500) return 'no-store';
  if (/^\/(css|js|img|fonts)\//.test(caminho)) return IMUTAVEL;
  if (caminho === '/favicon.ico') return 'public, max-age=2592000';
  if (caminho === '/site.webmanifest' || caminho === '/robots.txt' || caminho === '/sitemap.xml') {
    return 'public, max-age=86400';
  }
  // HTML: sempre revalida
  return 'public, max-age=0, must-revalidate';
}

function comSeguranca(resposta, extras = {}) {
  const r = new Response(resposta.body, resposta);
  for (const [k, v] of Object.entries(SEGURANCA)) r.headers.set(k, v);
  for (const [k, v] of Object.entries(extras)) r.headers.set(k, v);
  return r;
}

function redirecionar(destino, status) {
  return comSeguranca(new Response(null, { status, headers: { Location: destino } }), {
    'Cache-Control': status === 302 ? 'no-store' : 'public, max-age=3600',
  });
}

function registrarClique(env, request, caminho, status) {
  if (!env.CLIQUES) return;
  let origem = '';
  try {
    const ref = request.headers.get('Referer');
    if (ref) origem = new URL(ref).hostname;
  } catch (_) { /* referer invalido: ignora */ }
  const url = new URL(request.url);
  try {
    env.CLIQUES.writeDataPoint({
      indexes: [caminho.slice(0, 96)],
      // blob1 rota | blob2 query (?r=...) | blob3 pais | blob4 dominio de origem
      blobs: [caminho, url.search.slice(0, 200), request.cf?.country || '', origem],
      // double1 status
      doubles: [status],
    });
  } catch (e) {
    console.error('falha ao registrar clique', e);
  }
}

async function paginaDeErro(env, request, arquivo, status) {
  const url = new URL(request.url);
  url.pathname = arquivo;
  url.search = '';
  const r = await env.ASSETS.fetch(new Request(url, { method: 'GET' }));
  return comSeguranca(new Response(request.method === 'HEAD' ? null : r.body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }), { 'Cache-Control': 'no-store' });
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
  if (url.hostname === `www.${DOMINIO}` || url.protocol === 'http:') {
    if (url.hostname === `www.${DOMINIO}` || url.hostname === DOMINIO) {
      return redirecionar(`https://${DOMINIO}${caminho}${url.search}`, 301);
    }
  }

  // --- contagem de cliques -----------------------------------------------
  if (caminho === '/go' || caminho.startsWith('/go/')) {
    const destino = DESTINOS[caminho];
    if (destino) {
      registrarClique(env, request, caminho, 302);
      return redirecionar(destino, 302);
    }
    if (caminho.startsWith('/go/evento/')) {
      registrarClique(env, request, caminho, 204);
      return comSeguranca(new Response(null, { status: 204 }), { 'Cache-Control': 'no-store' });
    }
    // qualquer outra coisa em /go/: registra (ajuda a achar link velho) e 404
    registrarClique(env, request, caminho, 404);
    return paginaDeErro(env, request, '/404.html', 404);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return comSeguranca(new Response('Method Not Allowed\n', {
      status: 405, headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' },
    }), { 'Cache-Control': 'no-store' });
  }

  // --- arquivos escondidos e paginas de erro nao sao acessiveis direto ---
  if (/\/\./.test(caminho) || caminho === '/404.html' || caminho === '/50x.html') {
    return paginaDeErro(env, request, '/404.html', 404);
  }

  // --- estaticos ----------------------------------------------------------
  // Equivale ao `try_files $uri $uri/ =404` + `index index.html` do nginx.
  let alvo = request;
  if (caminho.endsWith('/')) {
    const u = new URL(url);
    u.pathname = caminho + 'index.html';
    alvo = new Request(u, request);
  }
  const resposta = await env.ASSETS.fetch(alvo);

  if (resposta.status === 404) {
    return paginaDeErro(env, request, '/404.html', 404);
  }

  const extras = { 'Cache-Control': cacheControl(caminho, resposta.status) };
  if (caminho === '/site.webmanifest') extras['Content-Type'] = 'application/manifest+json';
  if (caminho.endsWith('.woff2')) extras['Content-Type'] = 'font/woff2';
  return comSeguranca(resposta, extras);
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
