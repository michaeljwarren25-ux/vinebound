# Card audio

Every card has a short cue, played the moment it lands. A card without a file still sounds fine —
every placement plays a wooden knock on stone regardless — so these can be replaced one at a time.

## Adding a cue

1. Save it in `audio/cards/`, named after the card id, e.g. `audio/cards/blind-jaguar.ogg`.
2. Run `npm run art` to update `art/manifest.json`.
3. Reload the game.

## File spec

| | |
| --- | --- |
| **Format** | **OGG Vorbis** preferred (`.mp3`, `.m4a`, `.wav`, `.webm` also work) |
| **Size** | Under 70 KB each; all 40 together under ~2.5 MB |
| **Sample rate** | 44.1 kHz, mono is fine — nothing is panned |
| **Peak** | Normalise to **−3 dBFS** |
| **Loudness** | Keep the set within a few LU of each other. A legendary may be *bigger*, not louder |
| **Head** | **No leading silence.** Trim to the first sample |
| **Tail** | Natural decay, fade the last ~50 ms to zero. No hard cut |

### Length — body and tail

Take the room you need, but know what you're working against: **the next card can land 770 ms
after yours.** That's the game's own floor — the opponent waits the longer of its think time
(0.5–1.5 s) and the attack animation (0.77 s, up to 1.37 s on a long capture chain).

So the rule isn't a hard cap on length, it's a cap on where the *weight* sits. Two cues
overlapping is fine when one of them is already decaying; two bodies fighting is not.

| Family | Total length | The body — the part with weight — lands inside |
| --- | --- | --- |
| **Creature** and **Other** | 0.4–1.0 s | 0.7 s |
| **Voice** | 0.6–1.4 s | 0.9 s (the vocalization itself well inside that) |
| **Legendary**, any family | up to **1.8 s** | 1.0 s |

Past the body it should be tail only — room decay, a fire settling, breath running out. Anything
still loud at 0.9 s will collide with the next card.

**The knock is already there.** The card-on-stone thud plays first and the cue starts **60 ms
after it**. Don't put an impact at the head of the cue — that space is taken. Start on the subject.

## The three families

**What the card *is* decides what you hear.** This is the part the first pass got wrong: it gave
the people their equipment instead of their voices, so a Ruin Digger sounded like a shovel and a
Smuggler sounded like a boat.

### 1. Voice — the 18 humanoid cards

**Lead with the person.** A vocalization, in character, up front. Tools and cloth can sit
*behind* it, quietly, but the first thing you hear is a human being.

- **1–3 syllables, no more.** These repeat every match; a catchphrase gets old in twenty minutes.
- **Non-lexical or invented.** A grunt of effort, a warning bark, a hissed breath, a called
  syllable in no real language. **Not English**, and **not an imitation of any real-world
  language or accent** — the setting borrows from real places and people, and a made-up syllable
  both sidesteps that and never needs translating.
- Think *effort and reaction*, not dialogue. The sound a person makes while doing the thing.
- Vary the voices: age, sex, weight. Eighteen cards shouldn't be one actor.
- The **Rusted Conquistador** is the one exception worth allowing a real-language flavour — he's
  a European soldier four centuries dead — but even there keep it to a groan or a single word.

### 2. Creature — the 13 animal cards

The animal's own sound, recorded close. No human in it at all, and no musical treatment. Real
species where there is one (howler monkey, jaguar, dart frog); for the invented ones, build from
real animals rather than synths.

### 3. Other — the 9 plants, spirits, stone and swarms

Everything that isn't a person or a beast: growing wood, moving stone, wings, water, breath in an
empty room. These can be the most abstract, but keep them physical — something is making the
sound.

## Style

Diegetic and dry. Sounds *in* the jungle, recorded close: no synth stabs, no orchestral hits, no
stingers. Humid and unpleasant. Colour steers the texture — **green** wet and organic, **red** dry
and percussive, **blue** cold and hollow — and rarity steers the weight and the room, not the volume.
A common is a thing happening next to you; a legendary is a thing happening in a bigger space.

---

## All 40 cards

`Redo` marks the ones the current file gets wrong. `Keep` means the existing file is already the
right kind of sound and only needs re-checking, not remaking.

### Voice — humanoid (18)

| File | Card | Colour | Cue |
| --- | --- | --- | --- |
| `vine-thief.ogg` | Vine Thief | green | **Redo.** A stifled laugh, breathless and delighted, disappearing into leaves |
| `ruin-digger.ogg` | Ruin Digger | blue | **Redo.** A grunt of effort on the spade, then a short surprised "huh" at what came up |
| `river-smuggler.ogg` | River Smuggler | blue | **Redo.** A low warning syllable, hushed, one hand on the gunwale |
| `ash-shaman.ogg` | Ash Shaman | red | **Redo.** A whispered invocation over a breath blown through smoke |
| `drowned-explorer.ogg` | Drowned Explorer | blue | **Redo.** A waterlogged groan, lungs full, a word that never makes it out |
| `snake-handler.ogg` | Snake Handler | green | **Redo.** A steady shushing hiss through the teeth, calming something, rattle underneath |
| `silent-tracker.ogg` | Silent Tracker | green | **Keep.** Almost nothing — one controlled exhale, bowstring easing. His whole point is silence |
| `machete-bandit.ogg` | Machete Bandit | red | **Redo.** A hard grunt of effort on the swing, blade through green stalks behind it |
| `venom-brewer.ogg` | Venom Brewer | red | **Redo.** A pleased little hum, then a sharp intake through the nose at the fumes |
| `canopy-oracle.ogg` | Canopy Oracle | green | **Keep.** A whispered word in no language, high leaves stirring around it |
| `rusted-conquistador.ogg` | Rusted Conquistador | blue | **Redo.** A dry dead groan inside a helmet, corroded plate shifting under it |
| `bone-drummer.ogg` | Bone Drummer | red | **Redo.** A shouted call on the downbeat, two hide-drum hits answering |
| `swamp-witch.ogg` | Swamp Witch | green | **Keep.** A low muttered incantation, bone charm clattering, mud bubbling |
| `sun-cultist.ogg` | Sun Cultist | red | **Keep.** A rising chanted syllable, ecstatic, a struck ritual bowl under it |
| `river-priest.ogg` | River Priest | blue | **Keep.** A soft spoken blessing as water is poured into water |
| `headhunter.ogg` | Headhunter | red | **Keep.** A short guttural bark, trophy bone knocking, spear butt on earth |
| `jungle-warlord.ogg` | Jungle Warlord | red | **Keep.** A shouted command and the roar of men answering it |
| `sun-priestess.ogg` | The Sun Priestess | red | **Redo.** A single commanding word over a city-sized fire drawing breath |

### Creature — animal (13)

| File | Card | Colour | Cue |
| --- | --- | --- | --- |
| `bone-beetle.ogg` | Bone Beetle | blue | **Keep.** Dry chitin skittering on stone, a shell clicking, a bone knocked aside |
| `mire-leech.ogg` | Mire Leech | green | **Keep.** Thick wet suction pulling free of mud, a slow slithering settle |
| `carrion-vulture.ogg` | Carrion Vulture | red | **Keep.** Two heavy wingbeats and a rasping croak |
| `dart-frog.ogg` | Poison Dart Frog | green | **Keep.** A bright wet croak, a small hop onto a leaf |
| `howler-monkey.ogg` | Howler Monkey | green | **Keep.** The howl, close and hoarse, branches thrashing |
| `mud-caiman.ogg` | Mud Caiman | green | **Keep.** Still water, then a heavy surge and the snap of jaws |
| `blind-jaguar.ogg` | Blind Jaguar | red | **Keep.** A low rumbling growl, a padded footfall, one breath scenting air |
| `were-jaguar.ogg` | Were-Jaguar | green | **Keep.** A human breath collapsing into an animal snarl, bone shifting under it |
| `storm-serpent.ogg` | Storm Serpent | blue | **Keep.** Churning water, a rolling thunder swell, coils breaking the surface |
| `ant-queen.ogg` | Army Ant Queen | red | **Keep.** A vast dry rustle of ten thousand legs, mandibles clicking |
| `fire-salamander.ogg` | Fire Salamander | red | **Keep.** A hiss into a roar of flame, something scaled scrabbling |
| `goliath-spider.ogg` | Goliath Spider | blue | **Keep.** Heavy legs on taut web, silk stretching, a sudden fast scuttle |
| `jaguar-king.ogg` | The Jaguar King | green | **Keep.** A roar that empties the canopy, the jungle going quiet behind it |

### Other — plants, spirits, stone, swarms (9)

| File | Card | Colour | Cue |
| --- | --- | --- | --- |
| `firefly-guide.ogg` | Firefly Guide | red | **Keep.** A soft insect whirr rising, two faint glassy chimes, night air |
| `mist-wraith.ogg` | Mist Wraith | blue | **Keep.** A cold hollow exhale over water, a faint distant voice, no body |
| `temple-guardian.ogg` | Temple Guardian | blue | **Keep.** Stone grinding on stone as something carved takes one step |
| `strangler-fig.ogg` | Strangler Fig | green | **Keep.** Wood groaning under slow pressure, roots creeping, bark cracking |
| `moth-seer.ogg` | Moth Seer | blue | **Keep.** A thousand soft wings, dry papery flutter swelling and fading |
| `idol-wraith.ogg` | Idol Wraith | blue | **Keep.** Gold lifted off stone, then a cold rush of air and a whisper |
| `blood-orchid.ogg` | Blood Orchid | green | **Keep.** A wet unfurling bloom, a soft organic pulse like a slow heartbeat |
| `river-titan.ogg` | The River Titan | blue | **Keep.** A subsonic groan under deep water, the river displaced |
| `sleeping-god.ogg` | The Sleeping God | blue | **Keep.** One slow breath in a vast stone chamber, dust sifting |

**Summary: 11 to redo, all of them people.** The 13 animals and 9 others already sound like what
they are, and 7 of the 18 humanoids already lead with a voice.
