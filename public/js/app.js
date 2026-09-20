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
   *   - deploy/nginx/cliques.conf  (destino do redirect 302)
   *   - public/index.html          (atributo title e JSON-LD)
   * e recarregue o nginx (sudo nginx -t && sudo systemctl reload nginx).
   * ------------------------------------------------------------------ */
  var SITE_DATA = {
    nome: 'Feijoada Porkinho',
    site: 'https://feijoadaporkinho.com.br',
    email: 'contato@feijoadaporkinho.com.br',
    telefone: '+5585985900985',

    /* Canais de venda. `rota` e o caminho interno contado pelo nginx. */
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
        url: 'https://wa.me/5585985900985'
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
    },

    /* Precos de referencia. Promocoes do iFood e do 99 Food alteram o valor final. */
    cardapio: [
      {
        nome: 'Kit Feijoada Executiva',
        porcao: '1 a 2 pessoas',
        preco: 69.9,
        descricao: '600 g de feijoada, torresmo crocante, arroz soltinho, farofa temperada e docinho de sobremesa.'
      },
      {
        nome: 'Kit Feijoada Completa',
        porcao: '3 a 4 pessoas',
        preco: 119.9,
        descricao: '1,2 kg de feijoada, torresmo crocante, arroz soltinho, couve fresca, farofa temperada, laranja, molho apimentado exclusivo e 3 docinhos artesanais.'
      },
      {
        nome: 'Bolinha de Feijoada',
        porcao: '12 unidades',
        preco: 24.9,
        descricao: 'Petisco crocante por fora, recheado de feijoada.'
      },
      {
        nome: 'Porção de Torresmo Caseiro',
        porcao: '80 g',
        preco: 14.9,
        descricao: 'Frito até ficar sequinho.'
      },
      { nome: 'Coca-Cola garrafa', porcao: '2 L', preco: 19.9, descricao: '' },
      { nome: 'Coca-Cola lata', porcao: '350 ml', preco: 8.9, descricao: '' }
    ]
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
   * Evento interno: contado pelo nginx (204), sem cookie e sem payload.
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
        status: 'Aberto agora · fecha às ' + doisDigitos(h.fechaHora) + ':00',
        cta: 'Peça agora'
      };
    }
    var prox = proximaAbertura(t);
    return {
      aberto: false,
      status: 'Fechado · abre ' + rotuloDoDia(prox) + ' às ' + doisDigitos(h.abreHora) + ':00',
      cta: 'Peça para o próximo fim de semana'
    };
  }
  window.__porkinhoStatus = function (base) { return textoDoStatus(agoraEmFortaleza(base)); };

  function renderizarStatus() {
    var banner = $('#status');
    if (!banner) { return; }
    var texto = $('#status-texto');
    var cta = $('#cta-titulo');
    var s = textoDoStatus(agoraEmFortaleza());

    /* Tirar as tres antes de por a certa. Sem isso, quem deixa a aba aberta
       atravessando as 15:00 fica com status--aberto E status--fechado ao
       mesmo tempo: o texto vira vermelho, mas a animacao `pulsar` da regra
       de aberto continua valendo e o ponto vermelho fica piscando como se
       a loja estivesse funcionando. */
    banner.classList.remove('status--neutro', 'status--aberto', 'status--fechado');
    banner.classList.add(s.aberto ? 'status--aberto' : 'status--fechado');
    banner.setAttribute('data-aberto', s.aberto ? 'sim' : 'nao');
    if (texto) { texto.textContent = s.status; }
    if (cta) { cta.textContent = s.cta; }
  }

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
    el.textContent = mensagem || '';
    el.hidden = !mensagem;
    el.className = 'geo-aviso' + (tipo ? ' geo-aviso--' + tipo : '');
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

  function pedirLocalizacao(botao) {
    if (!navigator.geolocation) {
      avisoGeo('Não consegui pegar sua localização — os 4 pontos estão abaixo.', 'erro');
      registrarEvento('geolocalizacao', 'erro');
      return;
    }

    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    var rotuloOriginal = botao.querySelector('[data-rotulo]');
    var textoOriginal = rotuloOriginal ? rotuloOriginal.textContent : '';
    if (rotuloOriginal) { rotuloOriginal.textContent = 'Procurando…'; }
    avisoGeo('', null);

    function encerrar() {
      botao.disabled = false;
      botao.removeAttribute('aria-busy');
      if (rotuloOriginal) { rotuloOriginal.textContent = textoOriginal; }
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        encerrar();
        ordenarPontos(pos.coords.latitude, pos.coords.longitude);
        avisoGeo('Pontos ordenados do mais perto ao mais longe.', 'ok');
        registrarEvento('geolocalizacao', 'sucesso');
      },
      function (err) {
        encerrar();
        /* 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT */
        var resultado = 'erro';
        var mensagem = 'Não consegui pegar sua localização — os 4 pontos estão abaixo.';
        if (err && err.code === 1) {
          resultado = 'negado';
          mensagem = 'Não consegui pegar sua localização — os 4 pontos estão abaixo.';
        } else if (err && err.code === 3) {
          resultado = 'erro';
          mensagem = 'Não consegui pegar sua localização — os 4 pontos estão abaixo.';
        }
        avisoGeo(mensagem, 'erro');
        registrarEvento('geolocalizacao', resultado);
      },
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 }
    );
  }

  /* ------------------------------------------------------------------ *
   * 3. Cardapio — recolhido no mobile, aberto no desktop.
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
      if (det.open) { registrarEvento('cardapio', 'aberto'); }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
