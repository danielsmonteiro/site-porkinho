---
name: Feijoada Porkinho
description: Hub de pedidos de feijoada caseira, desenhado para o celular, em cimento e o dourado da logo.
colors:
  primaria: "#E9D45C"
  primaria-forte: "#F2DE6B"
  primaria-tinta: "#241A0B"
  primaria-apoio: "#4A3A12"
  primaria-texto-claro: "#6B5410"
  primaria-borda-claro: "#937520"
  fundo: "#262624"
  superficie: "#31312E"
  superficie-alta: "#3B3B38"
  borda: "#85827B"
  borda-suave: "#46453F"
  texto: "#F1EFEA"
  texto-2: "#B5B1A9"
  fundo-claro: "#E0E0DD"
  superficie-claro: "#F1F1EF"
  superficie-alta-claro: "#FFFFFF"
  borda-claro: "#807C74"
  borda-suave-claro: "#CFCCC5"
  texto-claro: "#1F1E1C"
  texto-2-claro: "#57534C"
  whatsapp: "#25D366"
  ifood: "#E81C2B"
  ifood-forte: "#CF1626"
  noventa: "#FFDD00"
  noventa-forte: "#F2D000"
  noventa-tinta: "#1A1A1A"
  noventa-apoio: "#3D3500"
  noventa-borda-claro: "#8F7A00"
  wa: "#008069"
  wa-forte: "#006B58"
  whatsapp-texto: "#3BE07A"
  whatsapp-texto-claro: "#0B7C3A"
  aberto: "#4ADE80"
  aberto-claro: "#146C2E"
  fechado: "#F87171"
  fechado-claro: "#B3261E"
  foco: "#FFE9A3"
  foco-claro: "#4A3A12"
typography:
  titulo:
    fontFamily: "Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  destaque:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  rotulo:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
  texto:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  apoio:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  raio: "14px"
  raio-g: "20px"
  pilula: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  secao: "28px"
components:
  botao-primario:
    backgroundColor: "{colors.primaria}"
    textColor: "{colors.primaria-tinta}"
    rounded: "{rounded.raio}"
    padding: "11px 16px"
    height: "64px"
  botao-primario-hover:
    backgroundColor: "{colors.primaria-forte}"
    textColor: "{colors.primaria-tinta}"
  botao-secundario:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.raio}"
    padding: "11px 16px"
    height: "56px"
  botao-secundario-hover:
    backgroundColor: "{colors.superficie-alta}"
  botao-fantasma:
    backgroundColor: "transparent"
    textColor: "{colors.texto}"
    rounded: "{rounded.raio}"
    padding: "11px 16px"
    height: "48px"
  cartao-kit:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.raio}"
    padding: "12px 14px 14px"
  ponto-retirada:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.raio}"
    padding: "11px 14px"
    height: "56px"
  selo:
    backgroundColor: "{colors.primaria}"
    textColor: "{colors.primaria-tinta}"
    rounded: "{rounded.pilula}"
    padding: "3px 9px"
  status:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pilula}"
    padding: "10px 18px"
    height: "48px"
  barra-pedido-botao:
    backgroundColor: "{colors.primaria}"
    textColor: "{colors.primaria-tinta}"
    rounded: "{rounded.raio}"
    padding: "0 12px"
    height: "48px"
---

# Design System: Feijoada Porkinho

## Overview

**Creative North Star: "O Cardápio de Bolso"**

O site é um cardápio que cabe na mão: uma coluna estreita (no máximo 520px),
lida de cima para baixo com o polegar, que diz o essencial e manda a pessoa
pedir. Tudo é desenhado primeiro para um celular de 390px; em telas maiores a
coluna não cresce, só o respiro em volta. Não há grade, nem colunas, nem
herói: a primeira tela é o nome, o horário, os dois botões dourados e a foto
do kit.

O mundo de cor é cimento e dourado, o mesmo do Instagram da marca. O fundo
é cimento queimado (grafite levemente quente, por padrão) ou cimento claro
quando o celular está no tema claro; as superfícies são um degrau mais
claras, e o único acento é o dourado do anel da logo oficial do porco-chef.
O cinza neutro deixa as fotos da comida e o dourado como as únicas cores
quentes da tela. O dourado marca ação e preço, nada mais. As
fotos reais dos kits na caixa da Porkinho são a única imagem do site e carregam
o apetite; a interface em volta fica quieta para não competir com elas.

Os componentes são firmes e generosos: alvos de toque grandes (56–64px),
cantos suaves de 14px, rótulos em negrito curto, e um texto de apoio menor
embaixo dizendo o que acontece ao tocar.

**Key Characteristics:**
- Uma coluna de no máximo 520px, mobile-first, sem layout de desktop próprio.
- Dois temas automáticos pelo sistema: cimento queimado e cimento claro.
- Um acento só, o dourado da logo, para ação e preço.
- Fotos reais dos kits como única imagem.
- Uma fonte (Outfit), cinco tamanhos, dois pesos.
- Plano e tonal; sombra só nos botões de pedido.

## Colors

Cimento com o dourado da logo: neutro, sóbrio, de pouco contraste entre
superfícies e muito contraste no que importa. A cor quente vem do dourado e
das fotos, nunca do fundo.

### Primary
- **Dourado do Anel** (`primaria`): a faixa clara do degradê metálico do anel
  da logo (que vai de #945C24 a #F4EC6C). Fundo do selo "Mais perto" e do
  botão da página 404. É igual nos dois temas.
- **Dourado Aceso** (`primaria-forte`): hover dos botões dourados no tema
  escuro; no claro o hover escurece para #DFC544.
- **Tinta de Torresmo** (`primaria-tinta`): o único texto que pode ir sobre o
  dourado (11,43:1). O texto de apoio sobre o dourado usa **Tinta Velha**
  (`primaria-apoio`, 7,37:1).
- **Dourado de Preço**: no tema escuro, preços, distâncias, ícones de pino e o
  "+" das perguntas usam o próprio dourado como texto; no claro passam a
  **Ouro Queimado** (`primaria-texto-claro`), legível sobre o cimento claro.
- **Borda de Ouro** (`primaria-borda-claro`): só no tema claro, contorna os
  botões dourados, que sem ela somem no cimento claro (WCAG 1.4.11, 3,3:1).

### Secondary
- **Cores dos canais** (`ifood`, `noventa`, `wa` e variações): iFood
  `#E81C2B` (um tom abaixo do `#EA1D2C` da marca, para o branco passar de
  4,5:1), 99 Food `#FFDD00` com tinta `#1A1A1A`, WhatsApp `#008069` (o verde
  do app; branco sobre o `#25D366` da logo daria 1,98:1). Só nos botões de
  cada canal.

### Neutral
- **Cimento** (`fundo` / `fundo-claro`): cimento queimado no escuro, cimento
  claro no tema claro. O fundo da página e da barra fixa.
- **Placa** (`superficie` / `superficie-claro`): cartões, botões secundários,
  status, cardápio e perguntas.
- **Placa Acesa** (`superficie-alta`): hover das superfícies e fundo enquanto
  a foto carrega.
- **Junta** (`borda` / `borda-claro`): contorno dos controles
  secundários e das linhas de food truck; precisa passar de 3:1.
- **Risco Suave** (`borda-suave` / `borda-suave-claro`): divisórias e contorno
  de cartões que não são controles.
- **Giz** (`texto` / `texto-claro`): texto principal.
- **Pó de Cimento** (`texto-2` / `texto-2-claro`): texto de apoio, porções,
  descrições, rodapé.

### Status
- **Aberto** (`aberto` / `aberto-claro`): ponto e texto do status quando está
  aberto, e mensagem de geolocalização encontrada.
- **Erro** (`fechado` / `fechado-claro`): só mensagem de erro (geolocalização
  negada). Apesar do nome, **não** é usado para "fechado".
- **Foco** (`foco` / `foco-claro`): anel de foco de 3px, afastado 3px.

### Named Rules
**A Regra do Ouro que Age.** O dourado é a cor da Porkinho: preço, selo,
ponto de status, pinos e os "+". Não é cor de enfeite, de título nem de fundo
de seção.

**A Regra da Cor do Canal.** Os botões que levam a um app vestem a cor e o
logo oficial daquele app: iFood em vermelho com o logo branco, 99 Food em
amarelo com o "99" preto, WhatsApp em verde com o logo e o texto brancos. Nada
mais na página usa essas cores.

**A Regra do Fundo Neutro.** O fundo é sempre cimento, nunca marrom, bege ou
creme: a cor quente da tela vem só do dourado e das fotos da comida.

**A Regra do Fechado Dourado.** Fora do horário nada fica vermelho: o ponto do
status fica dourado (com o anel de Borda de Ouro no tema claro) e o texto diz
quando abre. Os botões dos apps perdem o dourado cheio, a sombra e a seta
(ficam com borda dourada e o apoio "Fechado · abre sexta às 09:00"), o
WhatsApp do topo ganha o dourado como "Reservar no WhatsApp", a retirada
mostra "Fechado agora" com o mesmo ponto dourado, e a barra fixa não aparece.
Vermelho é só para erro.

**A Regra da Tinta Escura.** Sobre o dourado o texto é sempre a tinta escura.
Texto claro sobre o dourado, ou um dourado mais escuro, reprova no contraste.

**A Regra Sem Opacidade.** Nunca usar `opacity` para clarear texto; usar o
token de apoio certo, que já tem o contraste medido.

## Typography

**Fonte:** Outfit (variável, 400–700, self-hosted em
`public/fonts/outfit-latin-var.woff2`), com `system-ui` de reserva.

**Character:** uma sans geométrica e redonda, amigável sem ser infantil; em
negrito tem a firmeza de letreiro de food truck, em regular lê bem em letra
pequena.

### Hierarchy
- **Título** (700, 28px, 1.15, -0.015em): o nome da marca no topo e o `h1` das
  páginas de texto. Só um por página.
- **Destaque** (700, 20px, 1.25): títulos de seção e preços dos kits.
- **Rótulo** (700, 16px, 1.25): rótulo dos botões, nome de kit, de ponto e de
  item, perguntas.
- **Texto** (400, 16px, 1.5): corpo.
- **Apoio** (400, 15px): linha abaixo do nome, textos de apoio de seção,
  descrições, respostas (máximo 62ch).
- **Meta** (400 ou 700, 13px, 1.3): texto de apoio dentro dos botões, porções,
  notas, rodapé, selo.

### Named Rules
**A Regra dos Cinco Degraus.** Só existem os cinco tamanhos de `--fs-*` em
`:root` (13, 15, 16, 20, 28). Nenhum tamanho solto.

**A Regra dos Dois Pesos.** Só 400 e 700. Hierarquia vem do tamanho e do
peso, nunca de caixa alta, itálico ou espaçamento de letras.

## Layout

Uma coluna centralizada de largura máxima 520px (`--largura`), com 16px de
margem lateral e 24px no topo (44px a partir de 760px de largura, único
ponto de quebra). O fundo de página respeita a área segura do iPhone.

O ritmo é vertical e curto: 28px entre seções, 12px entre botões e
cartões, 10px entre pontos de retirada, 4px entre título de seção e apoio, 14px
entre apoio e conteúdo.

A ordem da página é fixa (ver PRODUCT.md): cabeçalho compacto (logo de 56px ao
lado do nome, status em largura cheia embaixo), botões dos apps, kits,
retirada, WhatsApp, petiscos e bebidas, perguntas, rodapé. O cabeçalho é
compacto de propósito, para a foto do Kit Completa caber inteira na primeira
tela do celular.

A **barra fixa de pedido** (iFood e 99 Food lado a lado) só aparece depois que
os botões do topo saem da tela, e só com a loja aberta; quando ela está visível, a página ganha
espaço no fim e o `scroll-padding-bottom` impede que o foco fique escondido
atrás dela.

Nenhum elemento pode deslocar o layout depois da primeira pintura: imagens
declaram `width` e `height`, o status já nasce em largura cheia e o botão de
geolocalização é revelado por uma classe posta antes da pintura.

## Elevation & Depth

Plano e tonal. A profundidade vem do degrau entre `fundo`, `superficie` e
`superficie-alta`, e de bordas finas de 1px. A sombra existe em dois lugares
só: os botões dourados de pedido (`0 6px 18px`, forte no escuro, quase
imperceptível no claro) e a barra fixa, que projeta uma sombra para cima.

### Shadow Vocabulary
- **Sombra de pedido** (`--sombra`: `0 6px 18px rgba(0,0,0,.38)` no escuro,
  `0 6px 18px rgba(72,48,26,.12)` no claro): só nos botões primários.
- **Sombra da barra** (`0 -6px 18px rgba(0,0,0,.25)`): só a barra fixa.

### Named Rules
**A Regra do Prato na Mesa.** Cartões, listas e o status ficam deitados: borda
suave, sem sombra. Só o que leva ao pedido se levanta da página.

## Shapes

Cantos suaves e consistentes. Controles e cartões usam 14px (`raio`);
blocos que agrupam vários itens (cardápio, perguntas) usam 20px (`raio-g`);
status e selo são pílulas. A logo é recortada em círculo. As fotos dos
kits ficam em 4:3, cortadas pelo canto do cartão. Não há contorno tracejado
nem caixa dentro de bloco: aviso é texto de apoio.

## Components

### Botões
**Firmes e generosos**: largura cheia, ícone à esquerda, rótulo em negrito,
apoio de 13px embaixo e seta à direita (55% de opacidade, decorativa).
- **Shape:** cantos suaves (14px), altura mínima 56px.
- **Canal (iFood, 99 Food):** fundo na cor do app, logo oficial no lugar do
  ícone, 64px de altura, sombra de pedido. O 99 ganha borda escura no tema
  claro (amarelo sobre cimento claro não tem limite visível).
- **Canal fechado:** fundo de placa, borda na cor do app, texto normal, sem
  sombra e sem seta; o logo vai para um quadrado na cor do app, como o ícone
  do aplicativo. Continua link.
- **WhatsApp:** sempre cheio, no verde do app, com logo e texto brancos.
  Fechado, é o único botão cheio do topo. Rótulo por horário: "Pedir no
  WhatsApp" aberto, "Reservar no WhatsApp" fechado.
- **Secundário (voltar):** fundo de placa, Junta.
- **Fantasma (geolocalização):** transparente com Junta, 48px,
  conteúdo centralizado; desabilitado com 60% enquanto busca.
- **Toque:** encolhe para 98,5% (`scale(.985)`), 160ms; sem isso com
  movimento reduzido.
- **Foco:** anel de 3px na cor de foco, afastado 3px.

### Cartão de kit (assinatura)
O produto. Foto real em largura cheia e 4:3 no topo, depois nome (rótulo),
porção (meta), preço em destaque dourado e descrição (apoio). Fundo de placa,
Risco Suave, 14px, sem sombra. A nota de preço de referência vem depois dos
cartões, nunca antes.

### Ponto de retirada
Linha tocável de 56px com Junta (é um controle): pino dourado, nome em
negrito, detalhe em meta ("Abrir no mapa" ou o endereço), seta à direita e,
depois da geolocalização, a distância em dourado e o selo "Mais perto" (pílula
dourada). O mais perto ganha borda dourada.

### Status de horário
Pílula em largura cheia com ponto de 10px: verde e pulsando três vezes quando
aberto, dourado e texto normal quando fechado, cinza neutro antes do JS.

### Cardápio e perguntas
`<details>` nativos em bloco de 20px com divisórias internas, com título de
seção visível acima. Um só idioma de abrir e fechar: "+" que vira "−" em
dourado, à direita do resumo. O resumo do cardápio diz o que tem dentro
("Bolinha, torresmo e Coca-Cola"), sem ícone nem seta de link.
Notas dentro do bloco são texto de apoio. Os botões dos apps dentro do
cardápio só existem sem JavaScript.

### Barra fixa de pedido
Dois botões de 48px lado a lado, nas cores do iFood e do 99 Food, presos ao
rodapé da tela, entrando de baixo em 180ms. Só com a loja aberta.

## Do's and Don'ts

### Do:
- **Do** usar só os tokens de `:root` em `public/css/style.css`; mexendo lá,
  os dois temas acompanham.
- **Do** manter todo texto em 4,5:1 e todo limite de controle em 3:1, nos dois
  temas, e recalcular ao trocar cor ou logo.
- **Do** manter alvos de toque de pelo menos 48×48px (botões de 56px).
- **Do** usar fotos reais dos kits, sempre em par WebP + JPG, com `width` e
  `height` declarados e o `?v=` incrementado ao trocar.
- **Do** desenhar primeiro em 390px e conferir no tema claro e no escuro.
- **Do** desligar animação e transição com `prefers-reduced-motion`.

### Don't:
- **Don't** usar vermelho para "fechado"; vermelho é só erro.
- **Don't** pôr texto claro sobre o dourado, nem usar o dourado como
  decoração.
- **Don't** criar tamanho de fonte fora dos cinco degraus, nem um terceiro
  peso.
- **Don't** clarear texto com `opacity`.
- **Don't** alargar a coluna além de 520px nem criar layout de várias colunas
  no desktop.
- **Don't** pôr sombra em cartões, listas ou status.
- **Don't** pôr caixa com borda e fundo dentro de outro bloco com borda e
  fundo.
- **Don't** usar seta de "sai do site" em algo que só abre e fecha.
- **Don't** usar animação infinita; o que pulsa, pulsa três vezes e para.
- **Don't** usar fontes, ícones ou imagens de CDN de terceiro; tudo é
  servido do próprio site.
