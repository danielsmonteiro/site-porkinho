# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pessoas em Fortaleza e no Eusébio (CE) com vontade de comer feijoada no fim de
semana. **A maioria já conhece a Porkinho**: é cliente que volta e quer o
caminho mais curto até o pedido. Chegam ao site pelo celular, vindas da bio do
Instagram, do QR Code no food truck ou de um link no WhatsApp, e precisam
decidir em menos de 5 segundos como comprar: pedir pelo app, retirar no food
truck ou falar com o Sr. Monteiro.

Públicos secundários:

- quem ainda não conhece e precisa ver o produto (os kits, com foto, porção e
  preço) antes de abrir o app;
- quem organiza festa ou evento e quer uma encomenda grande, combinada pelo
  WhatsApp;
- buscadores e assistentes de IA, que leem os fatos do negócio para
  recomendar a Porkinho.

## Product Purpose

O site é um hub de pedido, não uma loja. Ele existe para levar a pessoa ao
canal certo o mais rápido possível: iFood e 99 Food para entrega, um dos 4 food
trucks para retirada, WhatsApp para pedir direto durante o funcionamento (sem
passar pelos apps), reservas, festas, eventos e encomendas grandes, com Pix.

Sucesso é clique de saída para iFood, 99 Food ou WhatsApp, medido pelas rotas
`/go/*` (Cloudflare Analytics Engine). A taxa de conversão por canal sai de
cliques ÷ visitas do Cloudflare Web Analytics. O site também precisa ser
encontrado e recomendado por buscadores e por IAs.

## Positioning

- **Receita caseira do Sr. Monteiro**: feita na fábrica própria. O dono é
  conhecido pelo nome e atende pessoalmente no WhatsApp.
- **Torresmo e molho próprios**: torresmo crocante caseiro e um molho apimentado
  exclusivo.
- **Kit completo pronto, na caixa da Porkinho**: um pedido traz a feijoada, os
  acompanhamentos e a sobremesa.
- **4 food trucks de retirada** espalhados por Fortaleza e Eusébio no fim de
  semana.

## Operating Context

- Funciona de sexta a domingo, das 09:00 às 15:00 (horário de Fortaleza).
- Pedido para entrega pelo iFood e pelo 99 Food. Os apps fazem **só entrega**,
  sem retirada, e não aceitam pedido agendado: fora do horário a loja não
  recebe pedido. O pagamento é feito no app. Pedido mínimo no iFood: R$ 59,00.
- Retirada em 4 food trucks: Guararapes, Parque del Sol e Sapiranga (Fortaleza)
  e Eusébio. No food truck a compra é feita na hora, no balcão, para levar: sem
  pedido antecipado, sem mesas e sem consumo no local.
  Os 3 de Fortaleza ficam na rua e não têm endereço, só uma localização no mapa.
  O do Eusébio fica na Av. Eusébio de Queiroz, 3409.
- A sede/fábrica tem endereço, mas não atende ao público.
- Pelo WhatsApp com o Sr. Monteiro: pedido direto durante o funcionamento, sem
  passar pelos apps; reservas; festas, eventos e encomendas grandes. Pagamento
  via Pix.
- Os kits não acompanham pratos nem talheres descartáveis.

## Capabilities and Constraints

- **Produtos.** O produto principal são dois kits:
  - **Kit Feijoada Completa**: 1,2 kg de feijoada, torresmo, arroz, couve,
    farofa, laranja, molho apimentado e 3 docinhos. Serve de 3 a 4 pessoas.
  - **Kit Feijoada Executiva**: 600 g de feijoada, torresmo, arroz, farofa e um
    docinho. Serve de 1 a 2 pessoas.

  Também há petiscos (como a bolinha de feijoada) e bebidas.
- **Preços.** Os preços mostrados são de referência. O valor final, com
  promoções e entrega, aparece no app.
- **Ordem da página.** Não muda:
  1. iFood e 99 Food;
  2. kits;
  3. retirada nos food trucks;
  4. WhatsApp;
  5. petiscos e bebidas;
  6. perguntas frequentes.

  As perguntas frequentes servem a clientes, buscadores e IAs.
- **Mobile first.** Cabeçalho compacto, para a foto do Kit Completa caber na
  primeira tela. Uma barra fixa de pedido aparece quando os botões do topo saem
  da tela. Fora do horário, nada de vermelho: o site diz quando abre.
- **Sem JavaScript também.** Todos os links e o cardápio inteiro estão no HTML;
  o JS só acrescenta o status de horário, a ordenação por distância e o
  cardápio aberto no desktop. Geolocalização só no clique do botão.
- **Stack.** HTML, CSS e JS puros, sem framework e sem build, servidos por um
  Cloudflare Worker. Proibido adicionar framework, bundler, Docker ou banco de
  dados.
- **Sem atrito.** Nada de formulário de contato, chat, newsletter ou pop-up.
- **Privacidade e terceiros.** Nenhuma tag de terceiros além do beacon da
  Cloudflare. Nenhum cookie. Nenhum IP ou user-agent guardado.
- **Dados estruturados.** O JSON-LD (Organization, 4 FoodEstablishment, Menu,
  FAQPage) e o `llms.txt` precisam bater com o texto da página.
- **Rotas `/go/`.** O nome de cada rota fica igual para o histórico de cliques
  não se partir; sempre `302` + `no-store`.
- **Fatos.** Não inventar preços, endereços, horários, prazos, taxas de entrega
  nem promoções. Não mostrar o ponto da Cidade Alpha.

## Brand Commitments

- Nome: Feijoada Porkinho. Instagram `@feijoadaporkinho`.
- Logo oficial: o porco-chef no anel dourado, a mesma do Linktree e do
  Instagram, em `public/img/`. Favicon, ícones e og-image saem dela.
- O Sr. Monteiro é a pessoa da marca. O WhatsApp abre com mensagem já escrita
  para ele.
- Voz simples e direta: frases curtas, sem gíria, sem exagero, sem promessas
  vagas. Erros e avisos dizem o que aconteceu e o que fazer.

## Evidence on Hand

- Fotos reais dos dois kits: `public/img/kit-completa.*`, `public/img/kit-executiva.*`.
- Existem, mas ainda não foram coletados para o repositório (pedir os números e
  textos reais antes de usar, nunca estimar):
  - nota e quantidade de avaliações no iFood e no 99 Food;
  - avaliações de clientes no Google;
  - tempo de mercado (ano de início);
  - imprensa ou prêmios;
  - fotos e vídeos do Instagram da marca.
- Ausente: depoimentos escritos com autorização, números de vendas.

## Product Principles

1. **Decidir em 5 segundos.** Cada tela leva a um pedido. O que não ajuda a
   escolher o canal fica abaixo ou recolhido.
2. **O kit é o produto.** A foto, a porção e o preço vêm antes de qualquer
   história.
3. **Fato antes de promessa.** Tudo o que o site diz (horário, local, preço,
   prova) é verdadeiro e confere com o JSON-LD.
4. **Pessoa, não plataforma.** O Sr. Monteiro e a receita caseira são o que um
   concorrente não pode copiar.
5. **Leve e acessível no celular.** Funciona em conexão ruim, com uma mão só e
   com leitor de tela.

## Accessibility & Inclusion

WCAG 2.1 AA, auditada e corrigida em 15/11/2026: contraste (incluindo 1.4.11 em
bordas de botão), foco visível que nunca fica embaixo da barra fixa, regiões
`role="status"` anunciadas, animação que para sozinha e respeito a
`prefers-reduced-motion`. Ainda falta um teste com leitor de tela real
(VoiceOver ou NVDA).
