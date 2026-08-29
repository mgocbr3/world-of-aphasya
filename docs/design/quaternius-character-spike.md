# Spike de personagens Quaternius (branch spike/quaternius-characters)

Registro do que este spike responde, o que ele custa e o que falta, para a
direcao decidir entre manter o elenco chibi KayKit atual ou migrar para corpos
de proporcao heroica.

**Como ver:** `?charspike=quaternius` em qualquer URL do cliente. Sem a flag o
jogo e byte-identico ao de sempre: os corpos sao `lazyPreload` e nada os alcanca.

## O que existe hoje

Quatro corpos compostos (`spike_male_ranger`, `spike_female_ranger`,
`spike_male_peasant`, `spike_female_peasant`), montados por
`scripts/assets/build_quaternius_spike.mjs` a partir de tres packs CC0:

| Pack | O que entra |
|---|---|
| Universal Base Characters | corpo (so a cabeca, cortada abaixo da clavicula), olhos, sobrancelhas, cabelo e barba |
| Modular Character Outfits Fantasy | tunica, mangas, calcas, botas, capuz, ombreira, cintos |
| Universal Animation Library 1 e 2 | 84 clipes, ligados por nome de osso sem retarget |

Todo o elenco humanoide usa esses corpos com a flag ligada: jogador, NPCs e os
mobs da familia bandido, escolhidos deterministicamente por template. Esqueletos
continuam esqueletos e bichos continuam bichos, de proposito.

## Custo medido

- 20k a 34k triangulos por corpo (o KayKit fica bem abaixo disso).
- 17 MB no total para os quatro, texturas em 512 e KTX2. Texturas dominam.
- Praca de Eastbrook com 46 rigs visiveis: 896 draw calls, 9,0M triangulos,
  76 fps. O registro anterior (elenco KayKit, mesmo preset) marcou 820 calls e
  8,1M triangulos, entao a troca custa cerca de 9% em calls e 11% em triangulos.

## O que funciona

- Locomocao, sentar, nadar, pulo com aterrissagem, vadear.
- Ataque (com variantes para duas maos e dual wield), reacao a dano, morte,
  floreio de renascimento; verificado ao vivo que a pose volta ao idle.
- Treze emotes.
- Arma e escudo equipados chegam as maos e respeitam a escala autorada.
- Criacao de personagem: genero troca o corpo inteiro, classe troca o kit.

## Variedade racial e proporcao

A raca e um ANEXO de cabeca, nao um corpo por raca: assar a raca no corpo
transformaria quatro arquivos em vinte (raca por genero por kit), enquanto uma
cabeca sao alguns milhares de triangulos que qualquer corpo veste. E a cabeca e
a unica parte que pode ser rigida sem parecer, por ser um osso so de ponta a
ponta, entao nao precisa de transferencia de peso.

Mapeamento por arquetipo, sem tocar em nenhum numero: orc no guerreiro, elfo no
cacador e no ladino, anao no xama e no druida, humano no paladino e no
sacerdote, necromante no mago e no bruxo.

As quatro cabecas raciais geradas no Meshy estao LIGADAS: baixadas do
workspace, ajustadas por `scripts/assets/build_spike_racial_head.mjs` (corta o
busto no queixo mais o cilindro do pescoco, escala queixo-para-coroa contra a
cabeca humana de referencia, senta no frame do osso, gera normais e pinta um
material fosco com a cor de pele da raca, ja que as malhas vem sem textura por
decisao). As fracoes de corte sao lidas a mao da silhueta de cada sculpt e
ficam registradas no proprio historico de invocacao:
orc chin 0.45 cut 0.20 mul 0.94; elfo chin 0.48 cut 0.33 (sculpt v2); anao chin
0.32 cut 0.17; necromante chin 0.40 cut 0.17 mul 0.85. Licoes que custaram
iteracao: o capuz do ranger e justo, entao encolher uma cabeca em 15% afunda o
rosto no buraco e o que sobra e um ovo (escala cheia e o certo para racas de
capuz); e o primeiro sculpt do elfo veio de proporcoes largas com coroa alta,
insalvavel por escala, entao foi regerado no Meshy com prompt de pose frontal
ereta e entrou como v2.

O coque (topknot) tambem foi regerado como peca limpa e ENTROU como sexto
penteado tintavel. O sculpt novo veio como cabeca inteira com cabelo, entao
`hair_topknot.glb` e esculpido dela por codigo: corte por plano inclinado que
libera o rosto (nuca desce a -0.40, frente sobe a 0.60 no espaco do sculpt),
mapa elipsoidal casando o raio do sculpt com o perfil medido do cranio de
`head_human.glb` (escala 0.103/0.109/0.115, centro y 0.115), e o no do coque
amplificado por smoothstep acima de y 0.66 (lift 0.32, volume 1.4x) para a
silhueta ler de longe. Material branco `spike_hair`, mesmo gancho de tinta das
outras pecas.

Proporcao vem de ESCALA DE OSSO, do jeito que um MMO de rig compartilhado faz:
sem geometria, sem morph, e as 84 animacoes seguem tocando por cima. Nove eixos,
todos na aba Corpo da criacao (altura, tamanho de cabeca, ombros, peito,
quadris, maos, cotovelos, joelhos, pes). Tres regras que o modulo carrega no
cabecalho: escala se propaga pela cadeia, entao cada entrada nomeia os filhos a
desfazer; o comprimento de um osso e o +Y local dele (medido em 0.996 do vetor
punho-para-no); e o plano descreve o corpo inteiro em vez da diferenca, que e o
que faz voltar um controle ao zero restaurar o corpo esculpido.

O ROSTO nao tem osso para escalar e a cabeca nao tem morph, entao as feicoes sao
encontradas na geometria: um CAMPO sobre a moldura normalizada da cabeca inteira
(cranio, olhos e sobrancelhas medidos juntos, porque cada malha quantizada tem o
seu proprio sistema de coordenadas e uma moldura por malha punha os olhos fora
das orbitas), amostrado por vertice, com queda suave ao quadrado para o traço
mover como traço em vez de arrastar a vizinhanca. Cada um dos oito controles da
criacao tem a sua propria regiao (a primeira versao dobrava queixo sobre
bochechas e derretia o rosto), os raios sao apertados de proposito, o
deslocamento morre na borda inferior da caixa (que e a costura contra o
pescoco), e a geometria clonada e promovida a float antes de qualquer escrita:
recalcular normais para dentro de um atributo int8 quantizado e o que
transformava toda face remodelada em sombreamento podre. Funciona em qualquer
cabeca: um cranio gerado ganha os mesmos controles sem passe de autoria.

As linhas de proporcao aparecem SO contra este rig, e isso e uma decisao: o
corpo enviado assa suas proporcoes no Fit Studio, e uma criacao que oferecesse
um segundo conjunto estaria mentindo sobre o que controla. Este rig nao assa
nada, entao la elas sao a unica coisa que molda o corpo.

## O que NAO funciona, e por que

- **Tom de pele.** Resolvido: `applySpikeSkin` pinta toda superficie de pele
  exposta (bracos, faixa de pescoco, cranio) numa cor so, pelo mesmo caminho de
  recolor multiplicativo do cabelo. A regra que importa: a RACA e dona da pele
  dela (o orc e verde ate dentro da camisa, a roda de tom nao move; tabela
  `SPIKE_RACE_SKIN`, os mesmos hex dos cranios gerados) e so o humano sem raca
  responde a roda de tom do criador. Isso tambem fechou o mismatch de garganta
  humana sob cabeca racial.
- **Cabelo e barba.** Resolvidos: cinco pecas emitidas em espaco de osso de
  cabeca (`--emit-hair`), montadas por `setSpikeHair`, com os 37 estilos do
  criador resolvidos por silhueta (`spike_hair_core`) e pintados pela roda de
  cor via o cache de materiais tingidos (lease propria, para uma troca de skin
  nao repintar o cabelo com o tint do corpo). Brincos e maquiagem continuam sem
  lugar neste rig; o dye de roupa esta LIGADO: bandas de
  pano medidas dos atlas dos packs (spike_outfit_dye_core, verde do ranger e
  camisa creme do peasant, couro e calcas fora da janela), aplicadas pelo
  mesmo shader de zonas do armor_dye via troca de source
  (applySpikeOutfitDyeSources) e re-sweep, entao tint de entidade, pele e
  cabelo continuam por cima. Os 13 colorways de matiz funcionam nos dois
  kits; os colorways de MATERIAL (gilded etc., zonas por set KayKit) caem em
  classic ate serem medidos aqui; e no tier low o dye nao existe (Lambert nao
  compila o hook), a mesma limitacao do KayKit.
- **O pescoco.** Resolvido em duas partes. Os corpos headless perdiam o pescoco
  junto com a cabeca e o anexo corta acima da gola, entao a cabeca flutuava:
  `scripts/assets/build_spike_neck_band.mjs` recorta a FAIXA de pescoco dos
  corpos assados (que vivem no git) como complemento exato do anexo de cabeca
  (macho por casamento de centroides, 2600 de 2600; femea por plano, que tambem
  emite a cabeca feminina propria, porque a femea vestia o cranio masculino por
  omissao e o osso de cabeca dela fica 5cm mais baixo) e solda a faixa de volta
  SKINNED, com os pesos do anel superior entregues ao osso da cabeca em blend
  para a costura nao abrir em pose nenhuma.
- **O look autorado no mundo.** Resolvido: `applySpikeLook` e o unico ponto de
  aplicacao (proporcoes, rosto, cabelo) e roda tanto no turntable do criador
  quanto no `createCharacterVisual` do mundo, que antes desenhava todo jogador
  com corpo padrao e cabeca careca.
- **Guardar arma nas costas.** Resolvido: `hand_rig_core` separa "isto e uma
  mao" de "este rig usa a tabela do KayKit", e cada rig aponta seu proprio osso
  de guarda. O que continua do KayKit sao os offsets autorados na moldura de
  peito dele, que nao transferem.
- **Andar de re.** A biblioteca nao tem o clipe; o fallback repete a caminhada
  para frente.
- **Uma empunhadura por slot.** Resolvido: a tabela por variante e agnostica de
  rig (mede a arma e aplica um teto por familia), entao espada, cajado e adaga
  deixaram de dividir um transform. A correcao de unidades converte o RESULTADO,
  nunca o teto: escalar o teto nao faz nada quando a arma ja cabe embaixo dele,
  que foi o que deixou toda lamina 39% grande.
- **Dois kits apenas.** O tier gratis traz ranger e peasant. As classes de robe
  usam o peasant como substituto ate os 12 kits pagos entrarem.

## Decisoes que ficaram registradas no codigo

- O corte no pescoco fica ABAIXO da clavicula: cortar no queixo deixa a cabeca
  flutuando sobre a gola.
- Todo material vai a metallic 0: os kits deixam o fator em 1 e delegam ao canal
  azul de um ORM empacotado, que a compressao KTX2 embaralha.
- A fusao adota so as malhas e descarta o resto: o esqueleto duplicado que vem
  junto sequestra as tracks de animacao por nome e trava o corpo em bind pose.
- Escala de arma e derivada, nao estimada: o corpo e autorado a 1,87 e
  normalizado para `HUMANOID_H`, entao tudo presso a mao herda esse fator.

## Ferramentas que nasceram aqui e sobrevivem a decisao

- `scripts/assets/build_meshy_prop.mjs`: entrada de um export cru do Meshy
  (600k a 1,6M triangulos) para prop de jogo por decimacao e normalizacao.
- `scripts/assets/lib/skin_weight_transfer.mjs`: da a uma peca sem rig o
  skinning do corpo por transferencia de vertice mais proximo, com busca em
  grade. Serve a qualquer peca gerada, deste pack ou nao.
