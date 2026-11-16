/*!
 * Feijoada Porkinho — feijoadaporkinho.com.br
 * JavaScript sem dependencias. O site funciona sem ele: o JS so acrescenta
 * comportamento (banner de horario, ponto mais proximo, eventos internos).
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * SITE_DATA — FONTE DA VERDADE
   * Ao trocar qualquer link aqui, troque tambem em:
   *   - src/worker.js              (DESTINOS: destino do redirect 302)
   *   - public/index.html          (atributo title e JSON-LD)
   * e publique de novo (ver "Publicar" no README).
   * ------------------------------------------------------------------ */
  var SITE_DATA = {
    nome: 'Feijoada Porkinho',
    site: 'https://feijoadaporkinho.com.br',
    email: 'contato@feijoadaporkinho.com.br',
    telefone: '+5585985900985',

    /* Canais de venda. `rota` e o caminho interno contado pelo Worker. */
    canais: {
      ifood: {
        rotulo: 'iFood',
        rota: '/go/ifood',
        url: 'https://www.ifood.com.br/delivery/fortaleza-ce/feijoada-porkinho-sapiranga-coite/e4f431c8-ba2c-4a49-bd00-99dbea2c594e?utm_medium=share'
      },
      food99: {
        rotulo: '99 Food',
        rota: '/go/99food',
        url: 'https://oia.99app.com/dlp9/0DRh5f'
      },
      whatsapp: {
        rotulo: 'WhatsApp',
        rota: '/go/whatsapp',
        url: 'https://wa.me/5585985900985?text=Ol%C3%A1%2C%20Sr.%20Monteiro%21%20Vim%20pelo%20site%20da%20Feijoada%20Porkinho.'
      },
      instagram: {
        rotulo: 'Instagram',
        rota: '/go/instagram',
        url: 'https://instagram.com/feijoadaporkinho'
      }
    },

    /* Pedido minimo no iFood, em reais. */
    pedidoMinimoIfood: 59.0,

    /* Funcionamento no fuso America/Fortaleza.
       0 = domingo ... 6 = sabado. */
    horario: {
      fuso: 'America/Fortaleza',
      dias: [5, 6, 0],        /* sexta, sabado, domingo */
      abreHora: 9,
      fechaHora: 15
    },

    /* Os 4 food trucks. Exclusivamente retirada — nao ha consumo no local. */
    pontos: [
      {
        id: 'guararapes',
        nome: 'Guararapes',
        endereco: 'Fortaleza/CE',
        lat: -3.765045,
        lon: -38.487662,
        rota: '/go/ponto/guararapes',
        mapa: 'https://maps.app.goo.gl/XhSkyXLL1qfAMEk8A'
      },
      {
        id: 'eusebio',
        nome: 'Eusébio',
        endereco: 'Av. Eusébio de Queiroz, 3409',
        lat: -3.882846,
        lon: -38.459273,
        rota: '/go/ponto/eusebio',
        mapa: 'https://goo.gl/maps/rtKKp78Pbua8ryKr8'
      },
      {
        id: 'parque-del-sol',
        nome: 'Parque del Sol',
        endereco: 'Fortaleza/CE',
        lat: -3.804495,
        lon: -38.498675,
        rota: '/go/ponto/parque-del-sol',
        mapa: 'https://goo.gl/maps/Dm4Ts9Kn9oQHNPrBA'
      },
      {
        id: 'sapiranga',
        nome: 'Sapiranga',
        endereco: 'Fortaleza/CE',
        lat: -3.787895,
        lon: -38.463066,
        rota: '/go/ponto/sapiranga',
        mapa: 'https://goo.gl/maps/FM5NELs2QDhqmfeTA'
      }
    ],

    /* Sede / fabrica. NAO e ponto de atendimento. */
    sede: {
      logradouro: 'Rua Marcelino Lopes, 4100',
      bairro: 'Sapiranga',
      cidade: 'Fortaleza',
      uf: 'CE',
      cep: '60833-075'
    }
  };

  /* Exposto para depuracao no console; nada depende disso. */
  window.SITE_DATA = SITE_DATA;

  var DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var MAPA_WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }

  /* ------------------------------------------------------------------ *
   * Evento interno: contado pelo Worker (204), sem cookie e sem payload.
   * Evento novo aqui precisa de entrada em EVENTOS no src/worker.js.
   * ------------------------------------------------------------------ */
  var eventosEnviados = {};
  function registrarEvento(nome, resultado) {
    var chave = nome + ':' + resultado;
    if (eventosEnviados[chave]) { return; }
    eventosEnviados[chave] = true;
    var url = '/go/evento/' + nome + '?r=' + encodeURIComponent(resultado);
    try {
      if (window.fetch) {
        fetch(url, { method: 'GET', keepalive: true, cache: 'no-store' })
          .catch(function () { /* silencioso: medicao nunca quebra a pagina */ });
      } else if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
      }
    } catch (e) { /* silencioso */ }
  }

  /* ------------------------------------------------------------------ *
   * 1. Banner de aberto / fechado — sempre no fuso America/Fortaleza,
   *    nunca no relogio local do visitante.
   * ------------------------------------------------------------------ */

  /* Devolve { diaSemana, hora, minuto } na hora de Fortaleza. */
  function agoraEmFortaleza(base) {
    var partes = new Intl.DateTimeFormat('en-US', {
      timeZone: SITE_DATA.horario.fuso,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(base || new Date());

    var out = {};
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i];
      if (p.type === 'weekday') { out.diaSemana = MAPA_WEEKDAY[p.value]; }
      if (p.type === 'hour') { out.hora = parseInt(p.value, 10) % 24; }
      if (p.type === 'minute') { out.minuto = parseInt(p.value, 10); }
    }
    return out;
  }

  function estaAberto(t) {
    var h = SITE_DATA.horario;
    return h.dias.indexOf(t.diaSemana) !== -1 &&
           t.hora >= h.abreHora &&
           t.hora < h.fechaHora;
  }

  /* Proximo dia de abertura, virando a semana corretamente.
     Devolve { emDias, diaSemana }. */
  function proximaAbertura(t) {
    var h = SITE_DATA.horario;
    for (var i = 0; i <= 7; i++) {
      var dia = (t.diaSemana + i) % 7;
      if (h.dias.indexOf(dia) === -1) { continue; }
      /* hoje so conta se ainda nao passou da hora de abrir */
      if (i === 0 && t.hora >= h.abreHora) { continue; }
      return { emDias: i, diaSemana: dia };
    }
    return { emDias: 7, diaSemana: h.dias[0] };
  }

  function rotuloDoDia(prox) {
    if (prox.emDias === 0) { return 'hoje'; }
    if (prox.emDias === 1) { return 'amanhã'; }
    return DIAS_LONGOS[prox.diaSemana];
  }

  function doisDigitos(n) { return (n < 10 ? '0' : '') + n; }

  /* Exportado para os testes de horario (deploy/scripts nao usa; util no console). */
  function textoDoStatus(t) {
    var h = SITE_DATA.horario;
    if (estaAberto(t)) {
      return {
        aberto: true,
        status: 'Aberto agora · fecha às ' + doisDigitos(h.fechaHora) + ':00'
      };
    }
    /* Fechado: o status olha para a frente ("Abre hoje às 09:00"). O iFood
       e o 99 Food nao aceitam pedido agendado: o apoio de cada botao diz
       quando abre, no ponto do toque, e a secao de retirada avisa que os
       food trucks tambem estao fechados. */
    var prox = proximaAbertura(t);
    var dia = rotuloDoDia(prox);
    var hora = doisDigitos(h.abreHora) + ':00';
    return {
      aberto: false,
      status: 'Abre ' + dia + ' às ' + hora,
      apoio: 'Fechado · abre ' + dia + ' às ' + hora,
      retirada: 'Fechado agora · os food trucks abrem ' + dia + ' às ' + hora
    };
  }
  window.__porkinhoStatus = function (base) { return textoDoStatus(agoraEmFortaleza(base)); };

  function renderizarStatus() {
    var banner = $('#status');
    if (!banner) { return; }
    var texto = $('#status-texto');
    var s = textoDoStatus(agoraEmFortaleza());

    /* Tirar as tres antes de por a certa. Sem isso, quem deixa a aba aberta
       atravessando as 15:00 fica com status--aberto E status--fechado ao
       mesmo tempo: o texto vira vermelho, mas a animacao `pulsar` da regra
       de aberto continua valendo e o ponto vermelho fica piscando como se
       a loja estivesse funcionando. */
    banner.classList.remove('status--neutro', 'status--aberto', 'status--fechado');
    banner.classList.add(s.aberto ? 'status--aberto' : 'status--fechado');
    banner.setAttribute('data-aberto', s.aberto ? 'sim' : 'nao');
    /* #status e uma regiao anunciada (role="status"). Reescrever o mesmo
       texto a cada minuto fazia alguns leitores de tela repetirem o horario
       sem parar; so troca quando muda. */
    if (texto && texto.textContent !== s.status) { texto.textContent = s.status; }

    /* Botoes dos apps: fechado, viram secundarios (sem sombra nem seta: o
       dourado e para o que da para pedir agora) e o apoio diz quando abre;
       aberto, volta ao texto do HTML, guardado no primeiro uso. */
    $$('#comprar > .botao--primario').forEach(function (botao) {
      botao.classList.toggle('botao--fechado', !s.aberto);
      var el = $('[data-apoio]', botao);
      if (!el) { return; }
      if (!el.hasAttribute('data-apoio-original')) {
        el.setAttribute('data-apoio-original', el.textContent);
      }
      var alvo = s.aberto ? el.getAttribute('data-apoio-original') : s.apoio;
      if (el.textContent !== alvo) { el.textContent = alvo; }
    });

    /* WhatsApp: no horario, pedido direto sem app; fora dele, reserva. O do
       topo fica dourado quando fechado: e o unico pedido possivel agora. */
    $$('[data-whatsapp]').forEach(function (botao) {
      var rotulo = $('[data-rotulo]', botao);
      var apoio = $('[data-apoio-wa]', botao);
      var r = s.aberto ? 'Pedir no WhatsApp' : 'Reservar no WhatsApp';
      var a = s.aberto ? 'Direto com o Sr. Monteiro, com Pix'
                       : 'Diga a data, quantas pessoas e o bairro';
      if (rotulo && rotulo.textContent !== r) { rotulo.textContent = r; }
      if (apoio && apoio.textContent !== a) { apoio.textContent = a; }
    });
    var waTopo = $('#whatsapp-topo');
    if (waTopo) { waTopo.classList.toggle('botao--destaque', !s.aberto); }

    /* Retirada: fechado, uma linha avisa antes da lista de food trucks. */
    var avisoRetirada = $('#retirada-fechado');
    if (avisoRetirada) {
      var alvoTexto = $('[data-texto]', avisoRetirada);
      if (!s.aberto && alvoTexto && alvoTexto.textContent !== s.retirada) {
        alvoTexto.textContent = s.retirada;
      }
      avisoRetirada.hidden = s.aberto;
    }

    /* A barra fixa so faz sentido com a loja aberta (ver prepararBarra). */
    lojaAberta = s.aberto;
    if (atualizarBarra) { atualizarBarra(); }
  }

  var lojaAberta = true;
  var atualizarBarra = null;

  /* ------------------------------------------------------------------ *
   * 2. Ponto de retirada mais proximo — so no clique, nunca no load.
   * ------------------------------------------------------------------ */
  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad;
    var dLon = (lon2 - lon1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatarDistancia(km) {
    if (km < 1) { return Math.round(km * 1000) + ' m'; }
    return km.toFixed(1).replace('.', ',') + ' km';
  }

  function avisoGeo(mensagem, tipo) {
    var el = $('#geo-aviso');
    if (!el) { return; }
    /* O <p> e role="status" e fica sempre na arvore de acessibilidade:
       com `hidden` alternando junto com o texto, o leitor de tela nao
       anunciava nada. Vazio, ele tem altura zero (:empty no CSS). */
    el.className = 'geo-aviso' + (tipo ? ' geo-aviso--' + tipo : '');
    el.textContent = mensagem || '';
  }

  function ordenarPontos(lat, lon) {
    var lista = $('#pontos');
    if (!lista) { return; }
    var cartoes = $$('[data-ponto]', lista);
    var comDistancia = cartoes.map(function (el) {
      var p = null;
      for (var i = 0; i < SITE_DATA.pontos.length; i++) {
        if (SITE_DATA.pontos[i].id === el.getAttribute('data-ponto')) { p = SITE_DATA.pontos[i]; }
      }
      var km = p ? haversineKm(lat, lon, p.lat, p.lon) : Infinity;
      return { el: el, km: km };
    });

    comDistancia.sort(function (a, b) { return a.km - b.km; });

    comDistancia.forEach(function (item, indice) {
      var alvo = $('[data-distancia]', item.el);
      if (alvo && isFinite(item.km)) {
        alvo.textContent = 'a ' + formatarDistancia(item.km) + ' de você';
        alvo.hidden = false;
      }
      item.el.classList.toggle('ponto--proximo', indice === 0);
      var selo = $('[data-selo-proximo]', item.el);
      if (selo) { selo.hidden = indice !== 0; }
      lista.appendChild(item.el);
    });
  }

  /* Cada falha diz o que aconteceu e o que fazer, na voz da interface. */
  var MSG_GEO = {
    bloqueada: 'Localização bloqueada no navegador. Libere nas configurações do site ou escolha um food truck abaixo.',
    demorou: 'A localização demorou para responder. Toque de novo ou escolha um food truck abaixo.',
    indisponivel: 'Não foi possível saber onde você está agora. Escolha um food truck abaixo.'
  };

  function pedirLocalizacao(botao) {
    /* Busca em andamento: ignora toques repetidos. */
    if (botao.getAttribute('aria-disabled') === 'true') { return; }
    if (!navigator.geolocation) {
      avisoGeo(MSG_GEO.indisponivel, 'erro');
      registrarEvento('geolocalizacao', 'erro');
      return;
    }

    /* aria-disabled, nao `disabled`: desabilitar o botao focado jogava o
       foco do teclado para o <body>, e quem navega por teclado ou leitor de
       tela perdia o lugar na pagina. */
    botao.setAttribute('aria-disabled', 'true');
    botao.setAttribute('aria-busy', 'true');
    var rotuloOriginal = botao.querySelector('[data-rotulo]');
    var textoOriginal = rotuloOriginal ? rotuloOriginal.textContent : '';
    if (rotuloOriginal) { rotuloOriginal.textContent = 'Buscando sua localização…'; }
    avisoGeo('', null);

    function encerrar() {
      botao.removeAttribute('aria-disabled');
      botao.removeAttribute('aria-busy');
      if (rotuloOriginal) { rotuloOriginal.textContent = textoOriginal; }
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        encerrar();
        ordenarPontos(pos.coords.latitude, pos.coords.longitude);
        avisoGeo('Food trucks em ordem, do mais perto ao mais longe.', 'ok');
        registrarEvento('geolocalizacao', 'sucesso');
      },
      function (err) {
        encerrar();
        /* 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT */
        var resultado = 'erro';
        var mensagem = MSG_GEO.indisponivel;
        if (err && err.code === 1) {
          resultado = 'negado';
          mensagem = MSG_GEO.bloqueada;
        } else if (err && err.code === 3) {
          mensagem = MSG_GEO.demorou;
        }
        avisoGeo(mensagem, 'erro');
        registrarEvento('geolocalizacao', resultado);
      },
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 }
    );
  }

  /* ------------------------------------------------------------------ *
   * 3. Petiscos e bebidas — recolhido no mobile, aberto no desktop.
   *    Os kits ficam fora, sempre visiveis (secao #kits). O evento se chama
   *    `petiscos` desde 15/11/2026; antes era `cardapio` e contava quem
   *    abria o cardapio inteiro, kits inclusive. As duas series nao se
   *    comparam.
   * ------------------------------------------------------------------ */
  function prepararCardapio() {
    var det = $('#cardapio');
    if (!det) { return; }

    var desktop = window.matchMedia('(min-width: 760px)');

    /* O evento `toggle` do <details> e disparado de forma assincrona, inclusive
       quando quem mexe no `open` e o proprio script. Sem esta trava, todo
       carregamento no desktop disparava /go/evento/cardapio?r=aberto — ou seja,
       o contador media pageview de desktop, nao abertura de cardapio — e ainda
       marcava data-tocado, desligando o ajuste automatico por largura de tela. */
    var programatico = false;

    det.addEventListener('toggle', function () {
      if (programatico) { programatico = false; return; }
      det.setAttribute('data-tocado', '1');
      if (det.open) { registrarEvento('petiscos', 'aberto'); }
    });

    function aplicar(mq) {
      /* so abre automaticamente enquanto o visitante nao mexeu */
      if (det.hasAttribute('data-tocado')) { return; }
      if (det.open === mq.matches) { return; }
      programatico = true;
      det.open = mq.matches;
    }

    aplicar(desktop);
    if (desktop.addEventListener) {
      desktop.addEventListener('change', aplicar);
    } else if (desktop.addListener) {
      desktop.addListener(aplicar);
    }
  }

  /* ------------------------------------------------------------------ *
   * 4. Barra fixa de pedido — aparece quando os botoes do topo (iFood e
   *    99 Food) ja ficaram para cima, e some quando eles voltam a tela.
   *    Nao aparece antes de rolar: no topo ela so duplicaria os botoes.
   * ------------------------------------------------------------------ */
  function prepararBarra() {
    var barra = $('#barra-pedido');
    var topo = $$('#comprar > .botao--primario');
    if (!barra || !topo.length || !('IntersectionObserver' in window)) { return; }

    var naTela = [];
    /* Fora do horario a barra nao aparece: os apps nao aceitam pedido
       agendado, e uma barra dourada ali levaria a uma loja fechada. */
    atualizarBarra = function () {
      var algumNaTela = topo.some(function (_, i) { return naTela[i] !== false; });
      var mostrar = lojaAberta && !algumNaTela;
      barra.hidden = !mostrar;
      document.documentElement.classList.toggle('com-barra', mostrar);
    };
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        /* conta como "na tela" tambem o que ainda esta abaixo dela; so o
           que saiu pelo alto libera a barra */
        naTela[topo.indexOf(e.target)] = e.isIntersecting || e.boundingClientRect.top > 0;
      });
      atualizarBarra();
    });
    topo.forEach(function (b) { obs.observe(b); });
  }

  /* ------------------------------------------------------------------ *
   * Inicializacao
   * ------------------------------------------------------------------ */
  function iniciar() {
    renderizarStatus();
    /* reavalia a cada minuto: quem deixa a aba aberta atravessa as 15:00 */
    setInterval(renderizarStatus, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { renderizarStatus(); }
    });

    /* Nao mexemos na visibilidade aqui: quem revela o botao e a classe `js`
       posta pelo script inline do <head>, antes da primeira pintura. */
    var botaoGeo = $('#btn-geo');
    if (botaoGeo) {
      botaoGeo.addEventListener('click', function () { pedirLocalizacao(botaoGeo); });
    }

    prepararCardapio();
    prepararBarra();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
