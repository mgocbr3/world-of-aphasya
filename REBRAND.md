# World of Aphasya: plano vivo do rebrand

**Status:** Fase 0 (inventário e legal) em andamento. Iniciado em 2026-08-18.
**Fonte de direção:** `World_of_Aphasya_GDD_Rebrand_v1.0` (MD + DOCX na raiz do workspace WOA).
**Base técnica:** upstream v0.40.1 (branch `rebrand/identity-v0.40`, upstream `levy-street/world-of-claudecraft@main`). O import original foi a v0.38.4; ver 3.2 para o upgrade.
**Repositório destino:** `github.com/mgocbr3/world-of-aphasya`.

Este documento é o mapa operacional do rebrand: o que o GDD decide, este arquivo aterra no
repositório real. Regra central do GDD: retrofit primeiro, substituição apenas quando
necessária. Ordem de decisão por asset: preservar, reestilizar, modificar, substituir, remover.

## 1. Fundamento legal (por que o rebrand é obrigatório)

A licença do template (README, seção License) separa tres coisas:

| O que | Licença | Consequência para o fork |
|---|---|---|
| Código-fonte | MIT | Livre, inclusive comercialmente. |
| Assets de midia | Por asset, em `CREDITS.md` | Maioria CC0; exceções listadas na seção 5 abaixo. |
| Nome e marca ("World of ClaudeCraft", "Levy Street", logos) | NÃO licenciados | Uso proibido no fork. O rebrand não é opcional. |

Além da marca, quatro grupos de assets exigem ação antes de qualquer distribuição pública
(seção 5).

## 2. Decisões de naming (fonte: GDD + imagens conceito)

| Item | Antes | Depois | Observação |
|---|---|---|---|
| Produto | World of ClaudeCraft | World of Aphasya | Grafia com Y, confirmada no logo conceito. |
| Sigla | WoC | WOA | Ja usada no roundel conceito. |
| Moeda premium | Claudium | Aphasium | So apresentação; IDs mecânicos, SKUs e colunas de DB ficam estáveis (GDD 13.1, 15.1). |
| Moeda de gameplay/ads | (nova) | Lumina | GDD 13.2; entra so na fase de monetização. |
| Domínio | worldofclaudecraft.com | a definir (worldofaphasya.com?) | Canal principal será o portal Pixlland. |
| Deep link desktop | worldofclaudecraft:// | worldofaphasya:// | Electron + paginas de login. |
| Estudio/plataforma | Levy Street | Pixlland | SDK próprio: `github.com/mgocbr3/pixlland-poki`. |
| Token web3 | $WOC / Claudium store | fica isolado por feature flag | GDD 3.3: nada de ativação pública de web3 no rebrand. |

IDs internos, seeds, nomes de zonas, classes e conteúdo de jogo NÃO mudam nesta etapa
(GDD 3.2). Lore e naming de regiões ficam para fases posteriores.

## 3. Fases (roadmap do GDD aterrissado no repo)

| Fase | Entrega | Estado |
|---|---|---|
| 0. Inventário e legal | Este documento, mapa da marca no código, registro de assets restritos, matriz A-E inicial | EM ANDAMENTO |
| 1. Identidade user-facing | Nome, titulos, i18n, metadata de apps, deep links, logo provisório | EM ANDAMENTO (esta branch) |
| 2. Vertical slice visual | AphasyaArtProfile, materiais, iluminação, 1 zona, boss, HUD, presets. Plano detalhado: `docs/design/aphasya-visual-upgrade.md` | planejada |
| 3. Passagem global de render | Céu, fog, tone mapping, biome profiles em todas as regioes | pendente |
| 4. Personagens e assets | KayKit series, Meshy, normalização, cobertura de elenco. **Direção decidiu em 2026-08-29: fica no elenco KayKit e cresce com packs do mesmo criador.** Ver 3.1 | EM ANDAMENTO |
| 5. VFX, UI theme Aphasya, audio | Preset "aphasya" na infraestrutura de temas (`src/ui/theme.ts` + `src/styles/tokens.css`), substituição de audio restrito | pendente |
| 6. Loja, SDK Pixlland, monetização | Adapters por plataforma, rewarded ads com SSV, Reward Ledger | pendente |
| 7. Conteúdo, QA, lancamento | Zonas restantes, acessibilidade, localização, operação | pendente |

### 3.2 Upgrade para a base v0.40.1 do upstream (2026-08-29)

O fork estava parado na v0.38.4. O upstream andou 1556 commits e seis releases
(v0.39.0 a v0.40.1), entao o rebrand foi REBASEADO sobre a v0.40.1 na branch
`rebrand/identity-v0.40`; a `rebrand/identity` antiga fica intacta ate a
aprovacao.

O import original era a v0.38.4 menos um arquivo (`doc.md`), entao o replay foi
honesto: dos 595 arquivos que o rebrand tocava, 389 nao tinham sido tocados pelo
upstream e foram aplicados inteiros; dos 206 disputados, 42 eram renomeacao pura
de marca (reaplicada por regra derivada do proprio diff e conferida arquivo a
arquivo contra o rebrand real), e o resto foi resolvido a mao.

**O que o upgrade traz de graca para a decisao de elenco (3.1):** o upstream
autorou uma aparencia de criacao de personagem para TODOS os 91 NPCs
(`src/render/characters/npc_looks.ts`), compondo o corpo modular com guarda-roupa
misto e prop na mao por papel, no lugar dos quatro rigs compartilhados. A lacuna
medida em 3.1 (15 NPCs sendo o mesmo `rogue.glb` e `mage.glb` com tint) esta
fechada sem asset novo e sem compra.

**Duas decisoes que o upgrade forcou:**

- A extracao do AphasyaArtProfile (GDD 8.1, mover fog/luz/god-rays/HDRI para um
  modulo so) foi ABANDONADA neste upgrade. Era refactor puro, e o upstream
  reorganizou as mesmas tabelas do jeito dele (membros `private static` da classe
  Renderer). Refazer a mudanca contra a nova estrutura custa trabalho e nao muda
  um pixel, entao fica como tarefa propria se a direcao ainda quiser. O que era
  COMPORTAMENTO (grade AgX por bioma, ceu noturno, sombras coloridas, neblina de
  altura, grama, terreno, rochas, causticas) atravessou inteiro em
  `aphasya_grade_core.ts` + `aphasya_grade_driver.ts`, que nao dependem do
  profile.
- Os fingerprints dos assets de Fenbridge ficam os do upstream: eles
  reconstruiram os GLBs, e sao os deles que enviamos.

**Superficie de marca nova que o upgrade trouxe:** 58 arquivos que chegaram com
o upstream ainda citam a marca antiga (21 em `tests/`, 19 em `public/ui/*/
mapping.json`, 10 em `docs/design/`, 6 em `scripts/`, 2 em codigo). Sao registros
de proveniencia e fixtures, nao texto de jogador: o unico texto visivel
(a mensagem de assinatura do Exchange) e a URL canonica dos termos ja foram
renomeados. Renomear o resto e trabalho mecanico pendente, listado aqui para nao
se perder. Ficam de proposito: a chave de localStorage do admin e o esquema
`app://worldofclaudecraft` do shell desktop, que sao IDs mecanicos.

### 3.1 Decisão de elenco (2026-08-29): KayKit fica, Quaternius fica parado

A alternativa de proporção heroica foi construída inteira e testada
(`docs/design/quaternius-character-spike.md`), e a direção decidiu NAO adotar:
os corpos novos nao estavam ficando bons e integra-los custaria uma decisao por
NPC e por mob enquanto a cidade inteira segue KayKit. O trabalho esta parado, nao
perdido: branch `spike/quaternius-characters` e tag
`parked/quaternius-cast-2026-08-29` no remote `aphasya`. Os commits de rebrand
que nasceram naquela branch e nao sao do elenco foram trazidos para ca.

**A lacuna que sobra, medida:** 37 NPCs do jogo dividem 9 chaves de corpo, e as
duas maiores (`npc_villager` e `npc_villager_robed`, 15 NPCs somados) sao o
mesmo `rogue.glb` e o mesmo `mage.glb` com tint de entidade. O elenco humanoide
inteiro sai de 5 corpos do pack gratuito Adventurers. Nao e um problema de
estilo, e de QUANTIDADE de silhuetas.

**Caminho escolhido:** crescer no mesmo criador (Kay Lousberg, KayKit). Os packs
Mystery Monthly 4, 5 e 6 (14 a 15 personagens cada, 43 no total) sao descritos
pelo autor como "tecnicamente identicos aos Adventurers": mesmo rig, mesmas
animacoes que ja enviamos, CC0 sem atribuicao, com fontes .blend, que e
exatamente o que a regra 6.1 do GDD pede de um pack adquirido. Sao pagos
(19,99 USD cada, ou 150 USD por The Complete KayKit, que inclui os futuros).
A compra e decisao da direcao e nao foi feita.

## 4. Aterrissagem técnica (mapa da marca no código)

Preenchido pela varredura de 2026-08-18.

### 4.1 Identidade visual (logos, ícones, splash)

| Asset | Referenciado em | Ação |
|---|---|---|
| `public/woc_logo_square.webp` (+ cópia legada na raiz) | OG/Twitter meta e JSON-LD de `index.html`, `play.html`, `guide.html` e páginas `public/*.html`; `src/main.ts` (JSON-LD); `src/guide/head.ts`; `src/ui/claudium_window.ts` (ícone da moeda); `src/wallet_handoff.ts` | Substituir pelo roundel WOA |
| `public/worldofclaudecraft-logo.png` | Title screen (`#title-logo`) e cinemática de spawn (`#intro-logo`) em `index.html`/`play.html`; `public/server-unavailable.html`; páginas de marketing | Substituir pelo logo World of Aphasya. O title screen é imagem estática com fade (`src/game/logo_fade.ts`), não desenho em código |
| `public/woc-logo-hero.webp` | `src/ui/hud/player_card/player_card.ts` (player card exportável) | Substituir |
| `public/woc-logo-guide.webp` | `src/guide/chrome.ts` (header do wiki `/wiki`) | Substituir |
| Favicons e PWA (`public/favicon*`, `icon-192/512`, `apple-touch-icon`, `manifest.webmanifest` com name/short_name) | `index.html`, `play.html`, `admin.html` | Regerar do roundel WOA; atualizar manifest |
| Ícones Electron `build/icon.{png,icns,ico}` | `package.json` (build), `electron/main.cjs` | Regerar |
| Ícones e splash Android (`android/.../mipmap-*`, `drawable*/splash.png`, `values/strings.xml`) | shell Capacitor | Regerar; `app_name`, `package_name`, `custom_url_scheme` |
| Ícones e splash iOS (`ios/App/App/Assets.xcassets`, `Info.plist`) | shell Capacitor | Regerar; `CFBundleDisplayName` |
| `public/loading-screen.jpg` | telas de carregamento | Sem logo; trocar na fase visual |

Identificadores de app: `capacitor.config.ts` (`appId com.worldofclaudecraft`, `appName`),
`package.json` (`appId com.worldofclaudecraft.desktop`, `productName`, scheme
`worldofclaudecraft://`).

### 4.2 Levy Street em superfícies de produto

- `package.json`: `author` (vira publisher/copyright dos instaladores Electron).
- `public/terms.html` e `public/privacy.html`: entidade legal "Dream Home AI Limited,
  trading as Levy Street" (o fork precisa dos SEUS próprios termos e política, não basta
  renomear).
- E-mails `@levystreet.com` em `public/support.html`, `public/data-deletion.html`,
  `public/press.html` (pinados por `tests/client_shell.test.ts`).
- `src/sim/discord_roles.ts`: papel de equipe "Levy St".
- `public/ui/skills/*/mapping.json`: proveniência das licenças CraftPix.

### 4.3 Sistema de temas (para a fase 5)

Núcleo em `src/ui/theme.ts` (`PresetId`, `PRESET_ORDER`, `THEME_PRESETS` com 9 knobs
semânticos e guard de contraste WCAG). Checklist para o preset `aphasya`: adicionar id ao
tipo e a `PRESET_ORDER`, entrada em `THEME_PRESETS`, rótulo em
`src/ui/i18n.catalog/hud_chrome.ts` (`theme.presets`), `npm run i18n:gen`, cobertura
automática em `tests/theme.test.ts`. Nenhuma mudança em `options_window.ts`/CSS.

### 4.4 Naming user-facing (mapa da varredura)

Escala: ~405 arquivos e ~5.100 ocorrências de "ClaudeCraft"; ~960 de
`worldofclaudecraft.com`. Não existe constante central de marca; o nome é literal
espalhado. Pontos de edição:

- **i18n cliente (fonte):** `src/ui/i18n.catalog/shell.ts` (maior concentração),
  `guide.ts` (chaves `brand`/`brandShort` já pensadas para interpolação `{brand}`, mas
  `home.title`/`footer.rights` duplicam o literal), `hud_chrome.ts`, `editor.ts`,
  `index.ts` (inclui `brandWordmark` desenhado em canvas no player card),
  `src/admin/i18n.en.ts`. Overlays em `src/ui/i18n.locales/*` também carregam o literal.
  `src/ui/server_i18n.ts` casa por REGEX o texto que o servidor emite
  ("has entered World of ClaudeCraft."): servidor e matcher mudam na MESMA mudança
  (guard S3). `server_i18n.newlocales.ts` diz "generated" no header mas NÃO é protegido
  pelo hook e precisa edição manual.
- **Servidor (texto visível ao jogador):** `server/account.ts` (TOTP_ISSUER),
  `server/game.ts` (world.entered), `server/oauth.ts`, `server/discord.ts`,
  `server/github.ts`, `server/wallet_link.ts` (mensagem de assinatura Solana),
  `server/profile_page.ts` (GAME_NAME), `server/email/catalog.ts` (BRAND local).
- **Bot Discord:** `bot/logic.ts` (boas-vindas, embeds), `bot/discord_api.ts`
  (User-Agent, audit log), `bot/main.ts`.
- **Entradas HTML e SEO:** `index.html`/`play.html` (title, og:, twitter:, JSON-LD
  duplicado em `src/main.ts`, hreflang de 22 locales), `guide.html`, `admin.html`,
  `editor.html`, `music_editor.html`, `public/*.html` (terms, privacy, support, press,
  merch, links, data-deletion, server-unavailable, wallet-return),
  `public/manifest.webmanifest`.
- **Empacotamento:** `package.json` (name, author, appId, productName, scheme
  `worldofclaudecraft://`, publish URL), `capacitor.config.ts`, `electron/main.cjs` +
  `shell_strings.cjs` + `update_guard.cjs`, `android/` (strings.xml, build.gradle,
  AndroidManifest scheme; pacote Java `com.worldofclaudecraft` é refactor de diretório,
  pode ficar como id interno numa primeira etapa), `ios/App/App/Info.plist` +
  `project.pbxproj`.
- **Domínios em runtime:** `src/runtime.ts`, `src/main.ts` (SITE_URL),
  `src/guide/head.ts`, `src/ui/wiki_link.ts`, `player_card_data.ts`,
  `src/net/wallet_connect.ts`, `src/game/desktop_download.ts`, `server/realm.ts`
  (allowlist de origem), `server/player_card.ts`, `server/email/index.ts`,
  `electron/update_guard.cjs`.
- **Nota do upstream:** o track `ip-refactor/T1-debrand-text.md` do template renomeia
  conteúdo de jogo e explicitamente ADIA o nome do produto ("separate business track");
  este REBRAND.md é esse track.

### 4.5 Claudium → Aphasium (o que muda e o que NÃO muda)

- **Muda (apresentação):** strings em `src/ui/i18n.catalog/hud_chrome.ts` ("Claudium
  Balance" etc.), glossário do wiki (`src/guide/pages/glossary.ts`), fallbacks estáticos
  em `index.html`/`play.html`, docs.
- **NÃO muda (mecânico):** rotas `/api/claudium/*` (pinadas por
  `tests/server/claudium.test.ts`), SKUs `claudium_*` (definidos no serviço de economia
  EXTERNO; catálogo de preço não vive neste repo), env vars `WOC_ECONOMY_*` e
  `STRIPE_PRICE_CLAUDIUM_*`, nomes de arquivo (`claudium_*.ts`), DOM id
  `claudium-window`, type `ClaudiumRail`. Nenhum teste pina o texto exibido, então o
  rename de apresentação não quebra a suíte, desde que os artefatos i18n sejam
  regenerados (`npm run i18n:build`).
- O saldo Claudium é autoritativo num serviço de economia externo (outro repo); o rebrand
  de verdade da moeda acontece la e no catálogo Season 1 quando a fase 6 chegar.

### 4.6 Web3: estado real e plano de isolamento

- **Kill switch parcial já existe:** `VITE_WALLET_DISABLED=1` esconde toda a UI de wallet
  (client, build-time); sem `WOC_ECONOMY_SERVICE_URL`/secret o proxy Claudium falha
  fechado; sem `WOC_DAILY_REWARD_SERVICE_URL` o Daily Rewards não opera.
- **Buraco:** `server/wallet.ts` (link/unlink) não lê flag nenhuma; rotas sempre
  registradas. Recomendação: novo flag `WEB3_ENABLED` default off seguindo exatamente o
  padrão `STEAM_ENABLED`/`RIFT_FORGE_ENABLED` (fail closed).
- **Acoplamento de gameplay:** `server/bank_entitlements.ts` dá +2 slots de banco por
  wallet vinculada; desligar wallet sem tratar isso muda a economia de slots.
- **Marketing $WOC na landing:** FEITO (2026-08-29): o bloco `#token-ca` saiu de
  `index.html` junto com seu copiador em `src/main.ts`, as chaves `mode.ca*` e as
  regras CSS (pin de `tests/client_shell.test.ts` atualizado); o whitepaper ja havia
  saido na fase 1. No mesmo passe, o wordmark do player card (esquecido pela fase 1)
  virou WORLD OF APHASYA em todas as linguas e a loja de cosmeticos passou a se
  apresentar como Aphasium Store (chaves `wocStore.*`, rotas e arquivos continuam
  mecanicos). As superficies de wallet/daily-rewards que citam o token continuam
  atras das flags e mudam na fase 6.

## 5. Registro de assets restritos (isolar e substituir)

Fonte: README (License) + CREDITS.md. Estados: registrado, isolado, substituido.

| Grupo | Onde | Licença | Acao no fork | Estado |
|---|---|---|---|---|
| Ícones de habilidade CraftPix | `public/ui/skills/` (480 arquivos, 9 classes; consumidos por `src/ui/icons.ts` via `ABILITY_IMAGE_IDS` e `src/ui/talent_icons.ts`) | Compra da Levy Street, sem redistribuição | Remover do fork: ids fora de `ABILITY_IMAGE_IDS` caem automaticamente no icon painter procedural (`ABILITY_RECIPES`), nada quebra. Depois, arte própria ou licença própria CraftPix | registrado |
| SFX @jamiecypher | ~326 de 495 arquivos em `public/audio/sfx/` (famílias `quest_*`, `impact_*`, `proj_*`, `melee_*`, `foot_*`, `ui_level_up*` etc.; tabela em `CREDITS.md` seção Audio) | CC BY-NC 4.0 (grant comercial só para o projeto original) | Substituir para uso comercial (SFX Studio do repo gera os próprios) | registrado |
| Arte de loja/prestige (Season 1 Armory, set Claudium, ícones rework v0.29, professions 2.0, ícones Book of Deeds, marcadores de mapa, emblema do dragão elite, arte sob permissão específica) | listada em `CREDITS.md` "Do not redistribute these" | Comissionada, rights reserved | Substituir por arte própria Aphasya | registrado |
| Marcas de terceiros | Twitch/X/Kick/YouTube/Discord: SVG paths inline em `src/ui/ui_icons.ts`; Solana/USDC: `public/claudium/icons/*.webp` via `src/ui/claudium_window.ts` | Trademarks dos donos | Solana/USDC saem junto com o isolamento web3; sociais mantêm uso nominativo apenas onde houver canal real do Aphasya | registrado |
| Whitepaper $WOC | `public/World-of-ClaudeCraft-Whitepaper-v1.0.pdf` (linkado no footer do site, pinado em `tests/client_shell.test.ts`) | Documento da marca WoC | Remover do fork junto com o isolamento web3 | registrado |
| Logos e title screen WoC | raiz + `public/` + shells nativos | Marca nao licenciada | Substituir por logo Aphasya (conceitos v1 disponíveis) | registrado |
| Nome/branding em texto | código + i18n + docs | Marca nao licenciada | Fase 1 desta branch | em andamento |

Regra do GDD 20: ao encontrar asset restrito ou licença incerta, isolar e registrar aqui;
nunca presumir permissão.

## 6. Web3 e $WOC (isolamento)

O GDD (3.3, 13.1) preserva os rails existentes atrás de adapter e feature flag, sem
ativação pública. Concretamente no fork:

- Wallet linking, holder tiers, Daily Rewards e WOC Store ficam DESLIGADOS por padrão.
- O endereço do contrato $WOC e as menções ao token saem de qualquer superfície pública
  do fork (README, site, HUD).
- A arquitetura de saldo/catálogo/entitlements continua viva para a loja Aphasium.

## 7. Errata do GDD e das imagens conceito (feitos por IA; erros confirmados)

Auditoria pedida pela direção. Erros encontrados ate agora:

1. **Poster "GDD REBRAND" (16_17_18):** "MUNGEONS & RAIDS" é typo de "DUNGEONS & RAIDS".
2. **Poster 2 (16_17_20 (2)):** lista "Estilo World of Warcraft" como bullet da direção
   artística e usa um emblema de leao em estandarte vermelho muito próximo do brasão da
   Aliança (Blizzard). Contradiz o próprio GDD (4, 22.1): a referência é linguagem visual,
   nunca IP. Não usar esse poster como guia de marca.
3. **Poster 3 (16_17_20 (3)):** apresenta "raças" copiadas de World of Warcraft (Humano,
   Elfo, Anao, Gnomo, Orc, "Elfa Noturna", Troll, Morto-Vivo) como se fossem elenco do
   jogo. Dois problemas: (a) é o conjunto exato de raças do WoW, risco de IP; (b) o
   template NÃO tem raças jogáveis, tem nove classes; raças novas nem estão no escopo da
   primeira etapa (GDD 3.2). Tratar como ilustração de estilo, não como plano de conteudo.
4. **Posters:** grafia oscila entre "ClaudeCraft", "Claudecraft" e "ClaudCraft" em alguns
   trechos; o correto do template e "World of ClaudeCraft".
5. **GDD MD:** as secoes 1.1, 1.2, 2.1, 2.2, 4.2, 5.1 a 5.3, 6.2, 7.1 a 7.3, 8.3 a 8.5,
   10.2, 11.3, 12.1, 13.2, 13.4, 14.2, 16.1, 17.2 a 17.3, 18 (tabela), 19.1, 21, 21.2 e 22
   estão vazias no arquivo Markdown; o conteúdo completo existe apenas no DOCX/PDF. Extração
   textual completa arquivada pela produção em 2026-08-18. Recomendação: regenerar o MD a
   partir do DOCX para os agentes nao trabalharem com o GDD truncado.
6. **Referencias IMG_5170 a IMG_5173:** são peças de marketing/UI do World of Warcraft
   (material Blizzard). Servem apenas como referência de princípios (GDD 22.1); nunca
   entram no repo do jogo nem em material publico. Ficam fora do repositório.
7. **Imagens conceito de UI:** os mockups de HUD dos posters mostram molduras e layout
   praticamente idênticos ao WoW; a UI real deve seguir `DESIGN.md` (que ja define uma
   linguagem própria de metal azul-meia-noite, pergaminho e ouro) com o preset Aphasya,
   sem cópia pixel a pixel (GDD 11).

Acerto a registrar: a referência `docs/claudium-store.md` citada no GDD existe no repo, e a
infraestrutura de temas citada em 11.4 existe (`src/ui/theme.ts`, `src/styles/tokens.css`,
padrão adotado em `DESIGN.md`).

## 8. Pendencias abertas da Fase 1 (decisoes da direcao)

- **Hospedagem decidida (2026-08-18):** o jogo entra no acervo da Pixlland
  (`pixlland.com/{locale}/g/world-of-aphasya`, como os demais jogos), primeiro MMO com
  servidor da plataforma. Arquitetura da plataforma (ADR 47 do repo local
  `~/GitHub/Pixlland-Poki-v2`): shell em pixlland.com, dispatcher em
  `games.pixlland.com/<id>`, builds imutaveis no R2 em
  `<gameId>.<runtime-domain>/<versionId>/`, SDK por postMessage, jogo NUNCA same-origin
  com o shell. Consequencia para o WOA: o CLIENTE pode virar release estatico no R2
  (exige passe de base path/asset URLs no Vite), mas o SERVIDOR (REST+WS+Postgres) precisa
  de origin proprio de longa duracao fora do R2, com CORS/WS cross-origin e tokens bearer
  (ja e o modelo de auth do jogo). Caminho recomendado em duas etapas: (1) primeiro deploy
  como jogo de origin externo no acervo (cliente+servidor juntos, zero cirurgia de base
  path, como DEPLOY.md ja faz); (2) migrar o cliente para o runtime R2 quando a flag de
  origem-por-jogo da plataforma estiver validada. **Origin do jogo: DECIDIR DEPOIS**; o
  codigo mantem `worldofaphasya.com` como placeholder consistente e documentado ate la.
- **Termos e privacidade:** `public/terms.html` e `public/privacy.html` foram
  rebrandeados mas a entidade legal virou placeholder explicito ("operating entity to be
  confirmed"); precisam de texto juridico proprio antes de publicar.
- **E-mail de contato/suporte:** paginas de suporte ainda apontam `woc@levystreet.com`;
  definir o e-mail real (ex.: suporte@pixlland.com) e trocar em
  `public/support.html`, `public/data-deletion.html`, `public/press.html` e
  `tests/client_shell.test.ts`. `package.json author` ja aponta
  `contact@pixlland.com` (criar a caixa antes de publicar instaladores).
- **Discord/redes sociais:** links apontam `discord.com/invite/worldofaphasya` e
  afins, que nao existem; criar os canais ou remover os links (decisao da direcao).
  O JSON-LD `sameAs` em `index.html`/`src/main.ts` ja lista handles Aphasya
  (inexistentes ate os canais serem criados); o README raiz deixou de linkar
  qualquer canal social.
- **Nome do app Discord (Rich Presence):** vem do app registrado no portal do Discord,
  fora do codigo; registrar app proprio.
- **Pacote Java Android:** diretorios e ids ja renomeados para `com.worldofaphasya`;
  builds de loja novas terao identidade nova (sem migracao de instalacao, ok para fork).
- **README:** FEITO (2026-08-29): reescrito do ponto de vista do fork. Credito
  factual ao template upstream mantido (a secao de licenca preserva os fatos:
  CraftPix comprado pelo upstream, CC BY-NC do @jamiecypher, marcas nao licenciadas
  nos DOIS sentidos), secao Web3 removida da superficie publica, badges de CI e
  Discord mortos removidos, hero image trocada por captura sem logo. Os READMEs
  localizados em `docs/i18n/README.*.md` continuam sendo os do template e regeneram
  na fase 7 de localizacao.
- **RL env:** classe Python `WoWClassicEnv` (`python/wow_env.py`) tem naming herdado
  infeliz; renomear numa fase futura (API publica do env).
- **ffprobe-static quebrado neste Mac:** o pacote traz binario x86_64 na pasta arm64;
  sem Rosetta o gate completo e os passos de SFX nao rodam. Corrigir com Rosetta
  (`softwareupdate --install-rosetta`) ou ffmpeg/ffprobe arm64 no PATH.

## 9. Regras para agentes neste fork

Herdam o GDD seção 20 mais as convenções do repo (`CLAUDE.md`), em especial:

- Nenhuma mudança visual altera a simulação determinística ou a autoridade do servidor.
- IDs mecânicos estáveis; apresentação muda em catálogos/i18n.
- Sem em dash, en dash ou emoji em código, docs, commits e copy.
- Toda string visível ao jogador passa por `t()`; inglês na fonte, locales no fluxo do repo.
- Mudanca visual exige captura baseline antes/depois.
- Gate local antes de dar por pronto: `node scripts/gate_select.mjs`.
