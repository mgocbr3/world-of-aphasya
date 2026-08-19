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

## O que NAO funciona, e por que

- **Customizacao profunda.** Cabelos escolhiveis, sliders de rosto, barbas,
  brincos, maquiagem e dye de armadura nao tem onde morar neste rig. Os
  controles seguem na tela sem efeito. Reconstruir isso e o maior item de um
  eventual go.
- **Guardar arma nas costas.** A logica procura um osso `chest` e trata apenas
  os nomes `handslot.r`/`handslot.l` como maos; este rig tem `spine_03`,
  `hand_r` e `hand_l`. Nao quebra nada, so nao acontece.
- **Andar de re.** A biblioteca nao tem o clipe; o fallback repete a caminhada
  para frente.
- **Uma empunhadura por slot.** As classes usam uma tabela por variante de arma
  calibrada na mao KayKit; este rig fica fora dela de proposito (aqueles valores
  plantariam toda lamina de lado), entao espada e cajado dividem o mesmo grip.
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
