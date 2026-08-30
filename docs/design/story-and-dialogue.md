# The story as it is actually told

What the game SAYS, in the order a player hears it. Every line quoted here is
shipped text, pulled from `src/sim/content/`, not a pitch for something unbuilt.

Two sibling docs already exist and this one deliberately does not repeat them:

- `world-lore.md` is the world BIBLE (the Three, the Ages, the Night of Glass,
  and all fourteen realms as places). It answers "what is true about this world".
- `master-spec.md` is the campaign SPEC (level bands, mob tables, XP budgets,
  dungeon layouts). It answers "what does the content have to be".

This one answers the third question, the one neither covers: **what does a
player actually read, in what order, and whose voice is it in.** It exists
because that text is scattered across seventeen content files and the campaign
spine is invisible until you line the quests up.

`$N` in every quoted line is the player's name, substituted at runtime.

## The spine in one paragraph

A priest of a village chapel notices the dead will not stay buried. Pulling that
thread takes him, and the player, up a chain of masters that runs from a single
grave-robber to the thing three lands of stolen souls were being fed to. Every
act ends by naming the next master, and the priest climbs with you the whole way:
he is the only character who appears in all three zones, and the arc is really
his losing his certainty one act at a time.

## Act 0. The Proving Shore, the tutorial island

Ten quests on a shore camp, all mechanics, none of them plot. It teaches by
making you do the thing: walk the lanes, take a target, use an ability, fight
something that fights back, open a strayed crate, buy a bag, read the guild
board, and finally die on purpose.

That last one is the best writing on the island. Instructor Maren hands you a
stone and asks you to lie down:

> One lesson left, $N, and it is the one I cannot tell you: you have to have
> done it once. You are going to die out there. Everyone does, and it is not the
> end of anything.

and when you walk back to your body:

> Remember what that felt like, $N, because the next time it happens there will
> be teeth involved and no one standing by to explain. Your body waits, the walk
> is free, and the only thing death really costs you is the time it takes to
> come back.

The island's cast: **Warden Tam** (the Gauntlet), **Overseer Pell** (targeting),
**Drillmaster Rook** (abilities, first real kill), **Tidewarden Nel** (the wreck
line, the lure), **Quartermaster Finch** (bags), **Instructor Maren** (boards,
death, departure), **Ferryman Odo** (the crossing). Maren's send-off is the
handover to the campaign proper:

> There is nothing left on this shore you have not already run, beaten, opened,
> or bought, $N. You are ready, and Eastbrook has real work waiting.

Source: `src/sim/content/proving_shore.ts`.

## Act I. Eastbrook Vale, the Quiet Inheritance (levels 1 to 6)

The village opens as ordinary work. **Marshal Redbrook** wants wolves thinned and
bandits driven off; **Trader Wilkes** wants boar hides; **Fisherman Brandt** has
lost his nets to the Mudfin; **Foreman Odell** has rats in the copper dig. It is
deliberately mundane, and it is the control against which the real thread reads
as wrong.

The thread is **Brother Aldric**, and it starts as a favour to the dead:

> The old ruin on the northwest hill was a chapel once, and its yard a resting
> place. Something has stirred the dead from their sleep. Put them down and bring
> me a skull from each you lay to rest, $N, eight in all, so I may speak the
> rites over them and grant the peace they were denied.

Then it stops being a favour. The dead come back, so he asks who is calling them;
the answer is a sigil. He asks whose graves were robbed, and the answer is a
burial ledger scattered across the yard, which turns the horror personal:

> Every name in that ledger is a soul Morthen means to drag from the earth, and
> the chapel yard already crawls with those he has called.

The act ends in the Hollow Crypt, a five-player dungeon, against **Morthen the
Gravecaller** and his first raised servant, **Sexton Marrow**, the chapel's own
caretaker, "guarding his master's door in death as faithfully as he kept the
chapel in life".

And then the twist that makes it a campaign instead of a story. Aldric will not
let it rest:

> Morthen is dead, yet a question gnaws at me: a sect that hid for a century does
> not spend itself on one village chapel.

The grimoire from the vestry gives the answer, and the act's last line is the
hook into Act II:

> Morthen wrote to a 'Fogbinder' in the northern fen. The sect is not dead, $N,
> it has merely been patient.

Source: `src/sim/content/zone1.ts` (33 quests, including the profession
onboarding and the four crafting-attunement vows).

## Act II. Mirefen Marsh, the Sea That Never Left (levels 6 to 13)

Aldric follows you north, and the marsh escalates the same idea from a robbed
graveyard to a manufactured one. **Warden Fenwick** holds Fenbridge and thinks
he has a monster problem. He has a supply problem too, and the writing lets the
frontier feel poor: the causeway's pilings are wrapped in oiled prowler hide
because it is "the only thing the rot will not chew through", and the stock has
run out.

Aldric sees the shape first, and the line where he says it is the act's thesis:

> Travelers drowned on the causeway are walking out of the lakes, $N, still hung
> with the weeds they died in. This is no restless haunting. Drowning leaves no
> marks; it makes obedient corpses. Someone is filling this fen like a tithing
> box.

The chain climbs: rusted funerary censers from a chapel that drowned with its
congregation, a **Drowned Warlord** holding the ranks together, a cult camp that
has stopped hiding ("Grey robes, grey banners: Gravecallers, camped in the open
like they already own the fen"), **Deacon Voss** singing Fenwick's own drowned
wardens up out of the water, and finally the Sunken Bastion.

The Bastion carries the act's cruellest beat. **Knight-Commander Olen** drowned
at his post rather than abandon it, and every warden learns his name with pride:

> Now the Fogbinder has raised him as a puppet to guard the very door he died
> defending.

**Vael the Fogbinder** dies at the bottom, and hands the campaign its third act
with his last breath:

> Vael is dead, and the mist is lifting for the first time in years. But Maren
> heard his last words, and they freeze my blood: 'The Wyrm stirs beneath the
> peaks.' The sect serves something older than we ever guessed, $N.

Source: `src/sim/content/zone2.ts` (25 quests). Aldric appears here as
`brother_aldric_fen`.

## Act III. Thornpeak Heights, the Jailer's Body (levels 12 to 20)

The mountain is the reveal: everything since Eastbrook was a tithe. **Captain
Thessaly** holds the wall at Highwatch and reads Aldric's arrival as the alarm it
is:

> If the priest of the Vale is climbing the mountain himself, then it is as bad
> as I feared.

The act braids three threads that turn out to be one. **Loremaster Caddis**
notices the mountain itself waking, and his understatement is the best line on
the peak: "I suspect I already know, $N, and I dearly hope that I am wrong."
**Scout Maren** finds Thornpeak ogre clans camped where they never come, bought
with someone's coin, mustering under **Warlord Drogmar**. And the Wyrmcult stops
hiding, singing below the Sanctum.

Aldric finally says the whole of it:

> The Gravecallers serve Korzul the Gravewyrm, an ancient dragon sealed beneath
> this mountain, and every soul they have stolen since Eastbrook is a tithe
> poured into its waking.

The ladder tops out at **Threnos the First Voice** (Korzul speaks through his
mouth), **Grand Necromancer Velkhar** ("first of the Gravecallers, keeper of the
waking rite"), and the Wyrm itself. Killing Velkhar does not stop it, which is
the point:

> Velkhar is dead, and the rite is headless. But you felt it down there, did you
> not? The souls are already spent, the Wyrm is no longer asleep.

The campaign closes on a bell:

> It is over. The dead of three lands may rest, the mountain sleeps unhaunted,
> and it is your name, $N, that every bell from here to Eastbrook rings tonight.

Source: `src/sim/content/zone3.ts` (35 quests).

## Epilogue. Nythraxis, Scourge of Thornpeak (level 20)

A second, quieter chain on the same mountain, and the only one told through
found evidence rather than a living informant. Three old graves on the northern
battlefield (Captain Aldren, High Priest Malric, Royal Assassin Voss) give
visions when touched; the visions point at a sealed crypt; the crypt holds a king
that Malric's ritual "twisted into something deathless", sealed below by the
survivors along with the signet that opens him.

It ends without triumph, which is why it works as an epilogue:

> Thornpeak will still carry its dead, but no king below it will call them to
> war again. You have ended what Aldren, Malric, and Voss could only contain.

## Brother Aldric, the through-line

He is three NPC ids for one man: `brother_aldric` in the Vale,
`brother_aldric_fen` in the marsh, `brother_aldric_highwatch` on the peak. Read
his quests in order and the arc is his: a village priest who starts by asking for
skulls so he can say the right names over them, and ends standing outside a
dragon's tomb having been right about every escalation he feared.

He also carries the paladin's own thread. The Dawnbound Tome is his to give, and
he gives it in the Vale and completes it in the drowned fen for a reason he says
out loud: "nowhere is the veil between life and death thinner than a place where
the dead will not stay buried".

## The realms beyond the campaign

Fourteen realms exist as places with their own quests and their own trouble, and
`world-lore.md` is the authority on each. Their subtitles are the fastest index
of what each one is FOR:

| Realm | The hook |
|---|---|
| Eastbrook Vale | the Quiet Inheritance |
| Mirefen Marsh | the Sea That Never Left |
| Thornpeak Heights | the Jailer's Body |
| The Farshore | Where the Sky Is Thin |
| The Veiled Hollow | the Seed Vault |
| The Drakelands | the Forge and the Civil War |
| The Frostveil Reach | the Wall and the Other |
| The Amberfall | the Held Instant |
| The Willowfen | the Spilled Lullaby |
| The Nightbloom | Where She Lies |
| The Wraithwood | the Forest of Lost Names |
| The Palmreach | the First Fire and the Older Thing |
| The Evergarden | the Unattended Masterpiece |
| The Galecrest | the Held Breath and the Kept Promise |

Two of these have their own local chains worth knowing: the **Veiled Hollow**
runs a seal-and-warden story through Keeper Saelwyn, Loremother Bryn and
Archivist Tullo (`realm.ts`, 17 quests), and **Glimmermere** runs a drowned-choir
story through Tidewatcher Ondrel that ends at Sethrael the Palecoil
(`temple.ts`, 6 quests). The PvP battleground has its own bible in
`thornhollow-fields-lore.md`.

## The other places the game speaks

Quests are the loudest surface but not the only one:

- **Letters** (`letters.ts`, 23): the Ravenpost delivers narrative mail. Some are
  receipts, but the campaign ones land after the fact and are written as
  aftermath, with subjects like *The pens are quiet again*, *Old Greyjaw, at
  last*, and *What you did in the dark*.
- **Noticeboards** (`noticeboards.ts`, `noticeboard_listings.ts`): town-board
  postings, the world talking about itself rather than to you.
- **The Book of Deeds** (`deeds.ts`, 274 records): achievement titles, cosmetic
  only. They are named, not described, so the name has to carry it.
- **The Reliquary** (`reliquary.ts`): pages authored for unique loot, the place
  where an item gets to have a history.
- **Refusal lines** (`ground_pickup_lines.ts`): the small texture of being told
  no. "The crate is nailed shut." "The sigil repels your touch."

## The house voice, as observed

Rules nobody wrote down but every line follows. Worth keeping if new content is
authored:

1. **A quest-giver wants something for a reason of their own.** Nobody hands out
   errands on the player's behalf. Wilkes wants boar hide because packs sell;
   Hale needs pelts because the causeway is sinking; Yara needs venom because she
   bled a man of fen-rot that morning.
2. **The horror is specific and domestic.** Not "evil stirs" but a burial ledger
   with names in it, a sexton still guarding his door, a knight raised to hold
   the gate he drowned defending.
3. **Escalation is a chain of masters, named one at a time.** Every act ends by
   naming the next one, and the player learns the shape of the thing only in Act
   III.
4. **Officers understate.** Thessaly, Caddis and Fenwick are professionals; their
   fear reads through what they decline to say.
5. **Comic relief is a dialect, not a joke.** Tinker Gizzel doubles her words
   ("the loud stuff, yes?"); Hale is dry ("my insurance man drowned years ago");
   Hesk barely speaks at all ("Vats are empty. Bring eight rough hides. Coin when
   you do.").
6. **The tutorial explains mechanics in character.** No line on the Proving Shore
   is written as a tooltip, and the death lesson is a lesson about courage.

## Where it lives

| Content | File |
|---|---|
| Tutorial island | `src/sim/content/proving_shore.ts` |
| Act I, Eastbrook Vale | `src/sim/content/zone1.ts` |
| Act II, Mirefen Marsh | `src/sim/content/zone2.ts` |
| Act III + epilogue, Thornpeak | `src/sim/content/zone3.ts` |
| Veiled Hollow | `src/sim/content/realm.ts` |
| Glimmermere temple | `src/sim/content/temple.ts` |
| The other realms | `amberfall.ts`, `drakelands.ts`, `evergarden.ts`, `farshore.ts`, `frostveil.ts`, `galecrest.ts`, `nightbloom.ts`, `palmreach.ts`, `willowfen.ts`, `wraithwood.ts` |
| Dungeons and bosses | `src/sim/content/dungeons.ts` |
| Mail | `src/sim/content/letters.ts` |
| Boards | `src/sim/content/noticeboards.ts`, `noticeboard_listings.ts` |
| Deeds | `src/sim/content/deeds.ts` |
| Reliquary pages | `src/sim/content/reliquary.ts` |

Quest text is player-facing and therefore localized: the English in these files
is the SOURCE, and the locale overlays carry the translations. Changing a line
means changing the English here, never the overlay (root `CLAUDE.md`, the i18n
invariant).
