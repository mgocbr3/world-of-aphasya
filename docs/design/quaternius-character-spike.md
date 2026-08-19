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

Proporcao vem de ESCALA DE OSSO, do jeito que um MMO de rig compartilhado faz:
sem geometria, sem morph, e as 84 animacoes seguem tocando por cima. Nove eixos,
todos na aba Corpo da criacao (altura, tamanho de cabeca, ombros, peito,
quadris, maos, cotovelos, joelhos, pes). Tres regras que o modulo carrega no
cabecalho: escala se propaga pela cadeia, entao cada entrada nomeia os filhos a
desfazer; o comprimento de um osso e o +Y local dele (medido em 0.996 do vetor
punho-para-no); e o plano descreve o corpo inteiro em vez da diferenca, que e o
que faz voltar um controle ao zero restaurar o corpo esculpido.

O ROSTO nao tem osso para escalar e a cabeca nao tem morph, entao as feicoes sao
encontradas na geometria: cada vertice e pontuado contra uma regiao na caixa
normalizada da cabeca e deslocado com queda suave. Funciona em qualquer cabeca
(um cranio gerado ganha os mesmos controles sem passe de autoria) e nao consegue
rasgar a malha. Medido contra a cabeca em disco: os cinco eixos alcancam
geometria real e movem entre 1.2% e 2.5% da altura da cabeca.

As linhas de proporcao aparecem SO contra este rig, e isso e uma decisao: o
corpo enviado assa suas proporcoes no Fit Studio, e uma criacao que oferecesse
um segundo conjunto estaria mentindo sobre o que controla. Este rig nao assa
nada, entao la elas sao a unica coisa que molda o corpo.

## O que NAO funciona, e por que

- **Cabelos, barbas, brincos, maquiagem e dye de armadura.** Continuam sem
  lugar neste rig. Cabelo e o proximo: os oito estilos do pack sao presos ao
  osso da cabeca e, com a cabeca ja sendo anexo, entram pelo mesmo caminho.
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
