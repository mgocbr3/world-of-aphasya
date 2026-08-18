# Aphasya: plano de upgrade visual (Classic+ 70/30)

**Status:** plano aprovado para o vertical slice. Escrito em 2026-08-18 a partir de:
auditoria completa do renderer atual, pesquisa de estado da arte Three.js 2025/2026, as
referencias visuais fornecidas pela direcao (screenshots de MMO moderno: VFX eletricos com
bloom, rim light, vegetacao em massas, fog de profundidade, color grading) e o GDD
(secoes 4, 8, 16, 17).

Regra do GDD que governa tudo aqui: retrofit primeiro. O motor ja e muito mais capaz do
que parece; a maior parte do salto visual vem de AJUSTE e ARTE, nao de sistemas novos.

## 1. O que o alvo visual exige (das referencias)

1. Texturas pintadas com estrutura de valor forte e cor saturada (nao fotorrealismo).
2. Bloom expressivo em emissivos e magias (espadas brilhando, raios, cristais).
3. Rim light nos personagens contra fundos escuros.
4. Fog atmosferico com separacao de planos e ceu dramatico.
5. Color grading distinto por regiao.
6. VFX de habilidade densos mas legiveis (arcos eletricos, trails, telegraphs).
7. Vegetacao em massas com sway e leitura de silhueta.
8. Agua com profundidade, foam e reflexo (referencia extra da direcao: Three.js Water Pro).
9. Grama e pedras "storybook" (referencia extra da direcao: My Little Storybook, Lusion):
   grama em tufos com gradiente raiz-ponta, fundida com a cor do chao, e pedras de formas
   suaves com gradientes pintados em vez de textura fotografica.

## 2. O que o motor JA tem (auditoria 2026-08-18)

| Peca | Estado | Onde |
|---|---|---|
| Pos-processamento | Composer proprio: N8AO (SSAO), UnrealBloom custom, grade autoral (lift/gain/gamma, S-curve, saturacao 1.07, vignette, grain), SMAA em high+ | `src/render/post.ts`, `post_output_grade.ts`, `post_n8ao.ts` |
| Tone mapping | ACESFilmic, exposure modulada por hora | `renderer.ts` |
| Dia/noite | Ciclo 45min epoch-sync, fases lunares, dusk quente, pisos de luz | `day_night_core.ts` |
| Ceu | HDRIs equirect POR BIOMA com cross-fade + IBL PMREM; nuvens vem da HDRI | `sky.ts` |
| Fog | Linear por bioma + biome haze field (nevoa por zona a distancia) | `renderer.ts BIOME_FOG`, `biome_haze_field.ts` |
| Sombras | 1 directional PCF, sem cascatas; cadencia gerenciada | `renderer.ts`, `shadow_cadence_core.ts` |
| Materiais | Factory central `surfaceMat` (Standard/Lambert por tier), rim glow JA EXISTE, vertex colors, clone seguro de patches | `gfx.ts`, `pbr_fragment_shader.ts`, `material_clone_hooks.ts` |
| Terreno | Splat PBR com texturas FOTOGRAFICAS ambientCG + paleta por bioma | `terrain.ts`, `terrain_palette.ts` |
| Agua | Shader custom: scroll duplo de normais, fresnel, glints HDR, foam de costa, campo de altura interativo; SEM reflexo real nem tint por profundidade | `water.ts`, `water_simulation.ts` |
| Vegetacao | InstancedMesh bucketed, wind sway, impostors com atlas por angulo, grama blade | `foliage.ts`, `foliage_impostor.ts`, `blade_grass.ts` |
| VFX | Galeria de habilidade declarativa (ribbons, rings, decals, pillars, shells, flipbooks, sequencer por fases, 3 tiers) + pool Points 4096 | `src/render/ability_vfx/` |
| Performance | 5 tiers + governor runtime + resolucao dinamica + orcamentos por bucket | `gfx.ts`, `render_budget.ts` |

Conclusao da auditoria: as maiores lacunas contra o alvo sao (a) materiais/texturas
fotograficos em vez de pintados, (b) sem grading por zona no post, (c) bloom contido
demais para "glow magico", (d) sombra unica sem cascatas, (e) agua sem profundidade/
reflexo, (f) nuvens estaticas da HDRI.

## 3. Workstreams (em ordem de retorno sobre esforco)

### W1. AphasyaArtProfile (GDD 8.1) e o preset de tema

Criar `src/render/aphasya_art_profile.ts`: modulo central que declara, por bioma e por
qualidade, os valores que hoje estao espalhados (BIOME_FOG, BIOME_LIGHT, HDRI_TUNE,
BIOME_PALETTE, parametros do grade). Primeiro passo mecanico: mover as tabelas existentes
para o profile sem mudar valores (refactor puro, testavel); segundo passo: retunar valores
por bioma na direcao Aphasya (azul runico, ouro, sombras coloridas). O preset de UI
`aphasya` entra em `src/ui/theme.ts` (checklist ja mapeado no REBRAND.md 4.3).

### W2. Tone mapping e grading por bioma (maior impacto por menor custo)

- Trocar ACESFilmic por **AgXToneMapping** atras de flag no profile e comparar A/B na
  mesma cena (ACES dessatura tons medios; AgX preserva saturacao com shoulder suave,
  melhor para o look pintado). Decisao final por screenshot comparado.
- Estender `OutputGradePass` com **grade por bioma**: uniforms de lift/gain/gamma/
  temperatura interpolados no cross-fade de zona (mesma janela do sky/haze). LUT 3D
  (.cube, 32x32x32) e a alternativa se quisermos autoria de artista no DaVinci; uniforms
  parametricos bastam para comecar e custam quase zero.
- Requinte: expor `duskWarmAmount`/tints do dia-noite no profile para cada bioma ter o
  seu por-do-sol.

### W3. Materiais e texturas hand-painted (o coracao do 70/30; maior esforco de ARTE)

- **Resposta de luz estilizada:** injetar no patch PBR existente
  (`pbr_fragment_shader.ts`) um termo de wrap/half-Lambert leve + ramp tri-tone sutil
  (textura 1D por categoria de material), atras de knob no profile. NAO usar
  MeshToonMaterial: perderiamos sombra/fog/skinning nativos; o padrao onBeforeCompile do
  repo ja resolve (com `customProgramCacheKey` e `material_clone_hooks`).
- **Rim light:** ja existe (`patchPbrRimGlowFragmentShader`); retunar por categoria
  (personagens mais forte, props mais fraco) e por bioma noturno.
- **Terreno pintado:** substituir progressivamente as texturas ambientCG fotograficas por
  versoes repintadas (mesmo tiling/canais, albedo pintado com luz e desgaste incorporados,
  GDD 4.2). Comecar pelo set do vale (grass/dirt/rock) no vertical slice. O splat, AO
  packed e relevo continuam iguais; e troca de arte, nao de codigo.
- **Vertex color tinting por bioma/faccao** ja suportado; expor no profile.

#### W3b. Grama e pedras storybook (referencia Lusion)

O motor ja tem as duas pecas-chave do look: normais constantes para cima na grama
(`patchConstantUpNormalVertexShader`, que faz a grama sombrear como o chao e e o segredo
do visual "fofo" coeso) e wind sway em camadas. O que falta:

- **Gradiente raiz-ponta por blade:** base escura herdando a cor do terreno no ponto de
  spawn (sample da paleta de bioma no build do bucket), ponta clara/quente; 1 varying.
- **Clumping:** distribuir blades em tufos (noise de densidade no scatter) em vez de
  espalhamento uniforme; massas leem melhor a distancia (GDD 9.1).
- **Contato com o chao:** faixa de AO pintado na base dos tufos (decal ou vertex color),
  fundindo grama e terreno.
- **Pedras:** trocar o splat fotografico de rocha por forma + gradiente: vertex color com
  gradiente vertical (base fria/escura, topo quente/claro), AO pintado, microdetalhe so
  por normal map leve. Mesma receita para as rochas de props (`props.ts`): material do
  factory com ramp, sem textura fotografica.

Referencia de implementacao aprovada pela direcao: `github.com/cortiz2894/stylized-components`
(MIT, atribuicao a Christian Ortiz obrigatoria no CREDITS). O GrassField de la traz as
tecnicas exatas: mascara procedural de terra compartilhada entre chao/grama/flores,
translucencia na ponta das blades, trampling com splay, flores cross-billboard com sombra.
E React Three Fiber, mas os shaders GLSL portam direto para o pipeline proprio
(`foliage_shader_core.ts`).

### W4. Bloom seletivo e disciplina de emissivos

- Hoje: threshold 1.32, strength 0.4 (protegendo o ceu HDRI). Caminho: separar o
  orcamento de bloom de VFX do de cena, subindo o push HDR dos efeitos (`vfx.ts hdr()`,
  ribbons/pillars) para 2.0+ em high/ultra, mantendo o threshold do ceu. Se o controle
  fino nao bastar, migrar o bloom para mip-blur half-res com selecao (padrao
  pmndrs/postprocessing SelectiveBloomEffect); avaliar custo de adotar a lib vs portar a
  tecnica para o composer proprio (o repo preza dependencias minimas).
- Emissivos de cristais/runas/portais entram na selecao; superficies claras comuns nunca.

### W5. Sombras em cascata (CSM) em high/ultra

- Adotar `three/addons/csm/CSM.js` (3 cascatas, mode practical, 1024-2048) atras de
  `GFX.csm` apenas em high/ultra desktop; low/medium mantem a shadow map unica atual.
  Integrar via `surfaceMat` (csm.setupMaterial no factory central, um unico ponto).
  PCF mantido; PCSS so em cena hero se sobrar orcamento.
- Mobile/low: manter como esta + avaliar blob shadows para NPCs distantes (os proxies de
  sombra de crowd ja existem).

### W6. Agua nivel "Water Pro"

Referencia da direcao: Three.js Water Pro (threejsroadmap.com). Avaliacao tecnica:
WebGPU-first com fallback WebGL (o projeto e WebGL2 no three r185 patchado; no fallback
perde FFT, mantem Gerstner/ruido), oceano fisicamente realista, licenca comercial de
compra unica (bundle com Sky Pro por $239).

Recomendacao em duas frentes:

1. **Base (sem compra, direcao hand-painted, mobile-safe):** evoluir o shader proprio
   (`water.ts`), que ja tem scroll duplo e glints HDR, adicionando as tres tecnicas que
   faltam do padrao "toon water" moderno: **tint de absorcao por profundidade** (via
   depthTexture, agua rasa clara / funda escura), **foam por interseccao de profundidade**
   (costa/rochas, mascara dupla: threshold + noise scrolling) e **caustics fake**
   (textura projetada animada no fundo raso). Custo: 1 sample de depth + 2 de noise;
   compativel com o orcamento mobile do GDD 16.1. O WaterFloor do
   `cortiz2894/stylized-components` (MIT) e a referencia de codigo para o ramp de 3 cores
   voronoi, o glow de interseccao em screen-space e os aneis de ripple procedurais; o
   campo de altura interativo que ja existe (`water_simulation.ts`) cobre o papel do
   ping-pong GPU dele.
2. **Premium opcional (decisao de compra da direcao):** adquirir Water Pro para o oceano
   do Farshore em desktop high/ultra, onde o drama do mar sitiado paga o custo; exige
   spike de integracao com o culling por zona e o campo de altura interativo proprios.
   So decidir apos o item 1 estar no ar e medido.

### W7. Ceu vivo: nuvens e god rays

- Manter as HDRIs por bioma (ja sao um diferencial) e adicionar por cima uma **camada de
  nuvens 2D com scroll** (2 texturas, paralaxe leve, tint pelo sol/hora) em medium+;
  barata e da vida imediata ao ceu estatico.
- **God rays** radiais baratos (blur radial a partir do disco solar ja existente em
  `celestial_sprites.ts`) apenas em high/ultra, em momentos de sol baixo/floresta.
- Fog: adicionar termo de **altura** no biome haze (chao dos vales com nevoa, picos
  limpos), 3 linhas no chunk de fog ja interceptado.

### W8. VFX: expandir a galeria existente

- O sistema `ability_vfx/` ja e o formato certo (declarativo, tiers, pooling). Expandir:
  **soft particles** (depth-fade nos impactos de chao), mais arquetipos de ribbon
  eletrico/arcano (as referencias pedem raios ramificados), decals de telegraph com borda
  animada, e screen-space impact frames nos crits (o ScreenFx ja suporta).
- three.quarks fica como referencia, nao dependencia: o sistema proprio cobre o mesmo
  espaco e a regra do repo e dependencia minima.

Referencias de VFX aprovadas pela direcao (repos do mesmo autor do stylized-components):

| Repo | O que aproveitar | Onde encaixa | Licenca |
|---|---|---|---|
| `charged-blast-vfx` | Orbe de carga com flow noise + aneis orbitais, trail de projétil, muzzle flash, outline por shell de back-face | `ability_vfx/overlay_sprites.ts` (windup), `ribbons.ts` (travel), impactos | SEM licenca explicita: reimplementar a tecnica, NAO copiar codigo |
| `flow-shield-effect` | Escudo com grid hexagonal tri-planar, fresnel na borda, flow noise, ate 6 aneis de impacto, reveal por dissolve | upgrade direto de `ability_vfx/shells.ts` (as barreiras fresnel ja existem) | SEM licenca explicita: reimplementar |
| `hologram-particles` | 60k esferas instanciadas via MeshSurfaceSampler + compute | NAO portavel agora (WebGPU/TSL puro); guardar para o spike WebGPU futuro | SEM licenca explicita |

Regra (GDD 20): sem licenca declarada, tratar como todos-os-direitos-reservados;
inspiracao de tecnica ok, copia de shader nao. So o `stylized-components` e MIT.

## 4. Ordem de execucao (amarrada ao vertical slice do GDD 17)

| Etapa | Conteudo | Gate |
|---|---|---|
| V1 | W1 (profile mecanico) + W2 (AgX A/B + grade por bioma no vale) | screenshots antes/depois do vale, zero regressao de fps |
| V2 | W4 (bloom de VFX) + W8 (2 habilidades hero com VFX finalista) | metas GDD 16.1 nos presets |
| V3 | W3 (ramp/rim retune + terreno pintado do vale) | "captura sem logo e reconhecivel como Aphasya" (GDD 17.3) |
| V4 | W6.1 (agua base) + W7 (nuvens/fog de altura) | profiling registrado low/medium/high |
| V5 | W5 (CSM high/ultra) + polimento | slice aprovado |

Protocolo obrigatorio (GDD 20): toda mudanca visual com captura baseline antes/depois
(skill `pr-screenshots`), profiling por preset registrado, e nada de valores fora do
profile (nao espalhar magic numbers de volta pelo codigo).

## 5. Regras de plataforma

- Mobile/low: nada de CSM, god rays, carpet de grama; bloom half-res; N8AO desligado ou
  Performance half-res; DPR cap ja existente (1.48) mantido.
- WebGPU/TSL: NAO migrar agora (experimental no r185; perderiamos onBeforeCompile e o
  composer proprio, exatamente as tecnicas deste plano). Reavaliar num spike isolado
  depois do slice.
