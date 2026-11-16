# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Principal: cliente que já conhece a Porkinho.** A maioria das visitas é de
quem já comprou e volta no fim de semana. Chega pelo celular, pela bio do
Instagram, pelo QR Code no food truck ou por um link no WhatsApp, e quer o
caminho mais curto até o pedido. A decisão de "como comprar" precisa acontecer
em menos de 5 segundos.

**Secundários:**

- Quem ainda não conhece e precisa ver o produto (os kits, com foto, porção e
  preço) antes de abrir o app.
- Quem organiza festa, evento ou encomenda grande, ou quer pagar via Pix: fala
  direto com o Sr. Monteiro pelo WhatsApp.
- Buscadores e assistentes de IA, que leem os fatos do negócio (preços,
  horário, endereços, perguntas frequentes) para recomendar a Porkinho.

## Product Purpose

Hub de links de <https://feijoadaporkinho.com.br>. Leva cada pessoa ao canal
certo de compra de feijoada e torresmo caseiro, de sexta a domingo, das 09:00
às 15:00 (horário de Fortaleza), em Fortaleza e no Eusébio (CE).

Sucesso é o clique no canal: iFood e 99 Food primeiro, depois retirada num
food truck, depois WhatsApp. Cada clique passa por uma rota `/go/<canal>` e é
contado. A taxa de conversão por canal sai de cliques ÷ visitas do Cloudflare
Web Analytics.

## Positioning

Quatro fatos que, juntos, um concorrente no iFood não pode copiar com verdade:

1. **Receita caseira própria**, feijoada e torresmo feitos na fábrica da
   Porkinho (sede na Sapiranga, que não atende ao público).
2. **Kit completo na caixa da Porkinho**: feijoada com todos os
   acompanhamentos, molho apimentado exclusivo e docinhos. O kit é o produto.
3. **Uma pessoa real, o Sr. Monteiro**, atende evento, encomenda grande e Pix.
4. **4 food trucks de retirada** espalhados por Fortaleza e Eusébio no fim de
   semana.

## Operating Context

- Visita quase sempre no celular, muitas vezes já com fome e com o fim de
  semana em mente. A página é uma só (`public/index.html`), mais a política de
  privacidade e as páginas de erro.
- Hierarquia fixa da página, que não deve mudar: (1) iFood e 99 Food, logo
  seguidos dos kits; (2) retirada num dos 4 food trucks; (3) WhatsApp com o
  Sr. Monteiro. Depois, petiscos e bebidas (recolhidos no celular) e perguntas
  frequentes.
- O horário muda o que a página diz: fora do horário ela informa quando abre
  ("Abre hoje às 09:00") em vez de alarmar.
- Os food trucks são **exclusivamente para retirada**: não há mesas nem
  consumo no local.
- Preço final, promoções e entrega aparecem no app; o site mostra preço de
  referência. Pedido mínimo no iFood: R$ 59,00. Os kits não acompanham pratos
  nem talheres descartáveis.

## Capabilities and Constraints

- HTML, CSS e JavaScript puros, sem framework, bundler nem etapa de build.
  Servido por um Cloudflare Worker (`src/worker.js`) com arquivos estáticos em
  `public/`. Proibido adicionar framework, bundler, Docker ou banco de dados.
- Tudo funciona sem JavaScript; o JS só acrescenta o status de horário, a
  ordenação dos food trucks por distância e o cardápio aberto no desktop.
- Geolocalização só no clique do botão, nunca no carregamento.
- Sem formulário de contato, chat, newsletter ou pop-up.
- Fatos de negócio (preço, porção, horário, endereço, perguntas frequentes)
  aparecem em vários lugares e precisam bater: `index.html`, JSON-LD,
  `SITE_DATA` em `public/js/app.js`, `public/llms.txt` e `src/worker.js`
  (o README lista onde cada um vive). O CI confere parte disso.
- Rotas `/go/...` mantêm o nome para o histórico de cliques não se partir;
  sempre `302` + `no-store`.
- CSP estrita em `public/_headers`; o script inline do `<head>` é liberado por
  hash.
- Fora do ar no site: o ponto do Cidade Alpha.

## Brand Commitments

- Nome: **Feijoada Porkinho** (ou "a Porkinho"). Instagram
  `@feijoadaporkinho`.
- Logo oficial: o porco-chef no anel dourado, a mesma do Linktree e do
  Instagram. Favicon, ícones de PWA e og-image saem dela.
- O Sr. Monteiro é a pessoa que atende o WhatsApp e aparece pelo nome.
- Língua: português do Brasil, direto e caloroso, sem exagero. Não inventar
  preço, prazo, taxa de entrega ou telefone.

## Evidence on Hand

- **Fotos reais dos kits** na caixa da Porkinho: `public/img/kit-completa.*`
  (a que mais vende) e `public/img/kit-executiva.*`, 800×600, WebP + JPG.
- Cardápio e preços de referência em `public/llms.txt` e no JSON-LD.
- Logo e ícones oficiais em `public/img/`.
- **Prova social existe mas os números ainda não estão no projeto**: avaliação
  no iFood/99 Food, avaliações do Google nos food trucks, tempo de mercado e
  imprensa ou prêmios, segundo o dono. Nenhum desses números pode aparecer no
  site até o dono fornecer o valor exato e a fonte. Não há depoimentos de
  clientes coletados.

## Product Principles

1. **O caminho até o pedido vem antes de tudo.** Quem já conhece a Porkinho
   não deve ter que procurar o botão.
2. **O kit é o produto.** Foto, porção e preço reais ficam colados aos botões
   dos apps.
3. **Um fato, um valor.** Preço, horário e endereço iguais em toda parte, para
   o cliente, o buscador e a IA.
4. **Sem atrito e sem rastreio.** Nada de cookie, pop-up, formulário ou tag de
   terceiro além do beacon da Cloudflare.
5. **Gente de verdade.** Receita caseira, caixa da Porkinho, Sr. Monteiro no
   WhatsApp: nada genérico de marketplace.

## Accessibility & Inclusion

WCAG 2.1 AA (auditoria aplicada em novembro de 2026). Contraste recalculado a
cada troca de cor ou logo; texto escuro `#241A0B` sobre o amarelo da marca.
Link "pular para as formas de pedir", tudo navegável por teclado e legível
sem JavaScript. Privacidade conforme LGPD: sem cookie e sem identificador
persistente, portanto sem banner de consentimento.
