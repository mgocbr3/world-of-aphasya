# Aphasya vertical slice: profiling registrado (GDD 16.1)

**Data:** 2026-08-18, apos o pacote visual V1 (grade AgX por bioma, nuvens, grama
storybook + capim alto, terreno pintado, pedras, sombras coloridas, escala de
personagens 0.74, boost HDR de VFX 1.3x).

## Metodo

- Cena de referencia: spawn de Eastbrook Vale, dia fixado (`/daynight day`),
  personagem parado, populacao normal da praca.
- Build dev (Vite), Chrome embarcado, Apple Silicon (arm64), render target
  2058x1286 (DPR 2 com cap de pixel ratio do jogo).
- fps: contagem de requestAnimationFrame por 4s. calls/tris: `renderer.info`
  com reset e media de 20 frames (o caminho com composer desliga o auto-reset,
  entao a leitura crua acumula; a media normalizada corrige).
- IMPORTANTE: o contador de draw calls soma TODOS os passes do composer
  (N8AO desenha a cena opaca uma segunda vez; bloom soma os mips; SMAA soma o
  resolve). A meta "draw calls visiveis" do GDD 16.1 fala da cena; os numeros
  de high/ultra abaixo sao o total bruto de passes, o que superestima contra a
  meta.

## Resultados

| Tier | fps | calls/frame | tris/frame | programas | texturas | meta GDD calls |
|---|---|---|---|---|---|---|
| low | 120 (cap do display) | ~137 | ~0.37M | 150 | 474 | <= 250 OK |
| medium | 120 (cap) | 378 | 1.6M | 232 | 676 | <= 450 OK |
| high | 113 | 820 (bruto c/ passes) | 8.1M | 372 | 706 | <= 700 (ver nota) |
| ultra | 112 | 835 (bruto c/ passes) | 8.6M | 372 | 649 | n/a (apresentacao) |

## Leitura

- fps segura em 112-120 em TODOS os tiers nesta maquina: o pacote visual de
  hoje coube no orcamento sem regressao percebida (o cap de 120Hz do display e
  o teto real de low/medium).
- O bruto de high (820) inclui o segundo passe de cena do N8AO; a cena "visivel"
  fica na casa de ~400, dentro da meta. Para uma comparacao exata contra o GDD,
  o proximo passo de medicao e separar draws de cena dos draws de post
  (o probe de cena `scene_census_core` ja da a visao por camada).
- Pendencias de medicao para fechar o criterio 16.1 por completo:
  hardware mobile real (iPhone/Android mid-range para o alvo 30fps do preset
  low), payload inicial comprimido e tempo-ate-jogavel em 20 Mbps (medir num
  build de producao servido, nao no dev server), e a matriz Steam/desktop.

## Kill switches usados nas medicoes A/B de hoje

`?gfx=<tier>` forca o preset; `?agrade=off` (grade Aphasya), `?tonemap=aces`
(AgX), `?sbgrass=off` (grama storybook), `?clouds=off` (nuvens),
`?vfxhdr=off` (boost de VFX) isolam cada camada nova para atribuicao de custo.
