# Implementação: Séries 4/5/6 do KayKit no WOC + Estratégia de Lançamento com Ads no Pixlland

## Objetivo
Documentar como integrar os personagens das séries 4, 5 e 6 do KayKit no projeto atual e preparar o caminho de publicação no `pixlland.com` com foco em monetização por anúncios, sem quebrar a base de gameplay existente.

## 1) Estado atual do projeto (resumo)
- O projeto já tem:
  - Pipeline de personagens por classe com visuais base + caminho modular em `src/render/characters/manifest.ts`.
  - Engine de personalização baseada em *looks* em `src/render/characters/modular.ts` (enum/arrays de cabelo, barba, olhos, boca, sobrancelha, orelha, brincos, etc).
  - UI de customização lendo os mesmos catálogos de `modular.ts` em `src/ui/appearance_customizer.ts`.
  - Mapa de normalização (`normalizeAppearance`) em `modular.ts` que só aceita estilos cadastrados.

### Arquivos principais tocados
- `src/render/characters/manifest.ts`
- `src/render/characters/assets.ts`
- `src/render/characters/modular.ts`
- `src/ui/appearance_customizer.ts`
- `src/render/characters/design_code_core.ts`
- `src/render/characters/player_look_core.ts`
- `src/sim/types.ts` (se classes jogáveis crescerem)
- `src/sim/content/classes.ts` (se classes jogáveis crescerem)

## 2) Compatibilidade das Séries 4/5/6
- As páginas da KayKit indicam que séries 4/5/6 usam o padrão técnico compatível com os pacotes atuais de Adventurer/Character, então a integração é **tecnicamente viável** para o pipeline atual, desde que as malhas e rigs sejam consistentes.
- **Não é plug-and-play no nível de personalização**: mesmo estando compatível em rig/modelo, ainda é necessário mapear estilos no código para aparecerem nos seletores.

## 3) O que significa “acrescentar” na prática

### 3.1 Como nova opção cosmética (baixo risco)
- Importar modelos (e texturas) da Série X para a pasta de assets.
- Registrar visuais no manifesto.
- Se for personagem modular, mapear nós e incluir variantes de estilo.
- Adicionar novos IDs em:
  - `HAIR_STYLES`, `BEARD_STYLES`, `EYE_STYLES`, etc. (`modular.ts`).
  - `HAIR_NODES`, `BEARD_NODES` (mesmo arquivo), e, se necessário, novos mapeamentos de pele/roupa/acessórios.
- Atualizar rótulos em `HAIR_LABEL`, `BEARD_LABEL`, etc. para não mostrar chaves cruas no UI.
- Atualizar os mesmos catálogs em qualquer função que compõe código de aparência (`design_code_core.ts`) para manter compartilhamento/import/export de look compatível.

### 3.2 Como adicionar “nova classe jogável” (alto impacto)
- Hoje, classes são fechadas em `PlayerClass`/`ALL_CLASSES` e dados de gameplay em `classes.ts`.
- Acrescentar classe real exige:
  - definir classe em `sim/types.ts` e `sim/content/classes.ts`;
  - adicionar animações/skills/balanceamento;
  - incluir visual principal no `manifest` e ajustar qualquer sistema que faça suposição de classes existentes.

### 3.3 Compatibilidade de “cabelos/corpo/personalização”
- A parte de personalização não depende só do GLB existir.
- Se um novo estilo não estiver no enum, o normalizador vai cair para padrão, ou não aparecer no seletor.
- Portanto a regra prática: **asset novo + código novo**.

## 4) Roteiro de implementação sugerido (ordem recomendada)
1. `Série piloto`: integrar 1 personagem por vez (ex.: Série 4) em modo não disruptivo.
2. Validar import/manifest/preview de look em ambiente local.
3. Mapear e registrar hair/beard/face que realmente existam como nós no GLB.
4. Expandir catálogo de estilos no UI e revisar design codes.
5. Rodar smoke-test manual de criação de personagem e persistência de aparência.
6. Repetir para Série 5 e 6, mantendo a compatibilidade entre jogadores já existentes.

## 5) Estrutura de lançamento no `pixlland.com`

### 5.1 Frontend
- Servir build web otimizada (asset versioning por hash, cache-control adequado).
- Configurar lazy-load de personagens para reduzir TTFB/tempo de entrada no jogo.
- Implementar fallback de carregamento (sem travar seleção).

### 5.2 Backend / operações
- Autenticação, persistência de conta e estado de personagem em backend já existente (se já houver no stack do Pixlland).
- Logs de sessão para eventos de gameplay (para medir monetização e retenção).
- Endpoint de configuração remota de regras de ads (frequência/valor de bloqueios) para ajuste sem novo deploy.

### 5.3 Pipeline de deploy
- Build -> staging -> smoke -> produção.
- Checagem de saúde (`/api/health`) + smoke de gameplay crítico (login, spawn, movimentação, customização, inventário/sessão).
- Deploy de ativos de personagens com rota pública previsível e cache busting.

## 6) Monetização por Ads: desenho de produto (rentável e defensável)

### 6.1 Princípios
- Não interromper o “flow principal” com interstitial agressivo.
- Priorizar:
  - **rewarded video** em pontos de escolha (reviver, boost de velocidade, aceleração de fila/teleporte, skip de espera leve);
  - **banner pequeno** em telas não críticas (menu principal, garagem, social), com frequência baixa;
  - **interstitial ocasional** apenas em transições longas (ex.: fim de sessão/tempo ocioso).
- Evitar pay-to-win: anúncios devem dar conveniência/tempo/cosmético, não vantagem competitiva exagerada.

### 6.2 Lógica recomendada de frequência
- 1 ação de recompensa por janela de X minutos por jogador.
- 1 interstitial no máximo por sessão curta (somente após checkpoint seguro).
- Cap de saturação por sessão (ex.: máximo 3 formatos ativos).
- `capping` diário por jogador e A/B por cohorte (novos jogadores vs veteranos).

### 6.3 Métrica de viabilidade
- Métrica central: `ARPDAU`.
- Fórmula base: `ARPDAU = (impressões_por_user_por_dia * eCPM) / 1000 + receita_IAP`.
- Objetivo prático inicial:
  - **ads-only** para cobrir infraestrutura inicial e servir como *buffer*;
  - complementar depois com cosméticos / temporada passiva (se desejar).

### 6.4 Roadmap de rentabilidade (90 dias)
1. **Semanas 1-2 (MVP ads)**: rewarded + banner + limite conservador.
2. **Semanas 3-6 (otimização)**: ajustar eCPM e fill rate por zona/posição.
3. **Semanas 7-10 (segmentação)**: regras por coorte (retenção x spending potencial).
4. **Semanas 11-13 (escala)**: expandir catálogo de personagens/skins para aumentar retenção e exposição de anúncios em retornos recorrentes.

## 7) Existem MMO RPG com ads hoje?
Há exemplos de jogos classificados como MMORPG/ARPG multiplayer em marketplace mobile que ainda trazem anúncio (indicados pelo próprio meta de “Contains ads” em loja/serviços de listagem):
- Arcane Legends (MMO-Action RPG) — mostra “Contains ads”.
- Warspear Online (MMORPG, RPG) — “Contains ads”.
- Sherwood Dungeon 3D MMO RPG — “Contains ads”.
- Flyff Legacy (Anime MMORPG) — “Contains ads”.
- AdventureQuest 3D MMO RPG (segundo índice de loja) também aparece com essa configuração em resultados recentes.

Observação importante: muitos grandes MMO premium no nicho “massivo” preferem IAP/subscription, então o modelo de ads tende a funcionar melhor em jogos com fluxo casual/idle/híbrido, menor risco de churn por fricção.

## 8) Itens de decisão imediata
- [ ] Definir se a meta é “mais fantasia visual” (fácil) ou “novas classes” (complexo).
- [ ] Escolher prioridade de series (4 primeiro), depois 5/6.
- [ ] Definir estratégia de ad inventory para preservar retenção.
- [ ] Definir teto de exposição e indicadores de QA de UX por sessão.
- [ ] Validar legalmente/operacionalmente criativo de ads para público e região.
