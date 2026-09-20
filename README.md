# 🌿 Vinebound

Card duels in a forgotten jungle. A grid-capture card game (in the spirit of Triple Triad / Tetra Master, with Gwent-style card art) that runs entirely in the browser.

## Play locally

```sh
npm start        # http://localhost:5173 (picks the next free port if busy)
npm test         # rules, AI, progression, and share-link tests
npm run art      # rebuild art/manifest.json after adding card artwork
```

No dependencies and no build step. It's plain HTML, CSS, and ES modules. Open it through `npm start`; double-clicking `index.html` won't work.

## Rules

- Each side brings 8 cards. You hold 3 at a time and draw one after each play; the opponent's hand is hidden. A coin toss (decided by the match seed) picks who goes first.
- Take turns placing a card on the 5×5 board. Each board starts with 4–8 blocked stone squares, 2 Sunlit
  and 2 Undergrowth. Blocked squares are boulders lying *on* the slab — pale, rounded and casting a
  shadow — while a playable square is a dark recess cut into it.
- Every card has **Attack**, **Defense**, and **1–8 arrows** (corners included) showing where it attacks. A placed card attacks each enemy card its arrows point at: if that card points back, Attack must beat Defense (ties hold); if not, it's captured for free.
- **Chains:** every captured card attacks again along its own arrows, until nothing more falls. The
  numbers are locked in when your card lands, so the whole chain plays out with what the board showed
  at that moment: a card switching sides part-way through can't quietly change what the next battle costs.
- ☀ Sunlit squares give +1 to every number, ❦ Undergrowth squares give −1. `A` = 10.
- Every card is **Green, Red, or Blue** and wants a color next to it: on one side, or on any side (some need two). While that's true the card has **Advantage** and its ability is on: boosting its own numbers, weakening nearby enemies, or boosting cards in the corners, on edge squares, or in the center. **Any** card of that color grants it, yours or your opponent's — ownership never matters, only the color — and a captured card's ability works for its new owner.
- On the board, *ownership* is the color of a card's attack arrows (green yours, red theirs); the
  card's frame keeps its own Green, Red or Blue, so it looks the same on the board as in your hand.
  They are separate signals on purpose: Advantage is decided by a card's color, never by who holds it.
- Once all 16 cards are played, whoever owns more cards wins; equal is a draw.
- **Rites** (`src/rites.js`): each deck carries one one-shot power, usable once a match on your turn.
  It is free — it doesn't cost you that turn's card. Your opponent brings one too, drawn from the
  match seed so the same seed is the same fight, and challenge links carry both (`r=`). No Rite
  reaches into how a placement resolves, so a card that lands still fights with the numbers frozen
  when it landed: Rites change the state around the play instead.

## Progression

- **40 cards** across four rarities: Common, Rare, Epic, Legendary.
- **Starter pack**: the game opens on a choice of three themed packs (`src/packs.js`). Each is 16 cards
  — a ready 14-card deck plus two spares — built so its abilities feed each other: **Overgrowth**
  (green, the jungle closing in), **Blackwater** (blue, the river and the drowned ruins), **Emberfall**
  (red, fire and the hunt). They're within a few points of each other in power, and picking one sets up
  both the Duel and Campaign decks.
- **Card Packs**: five more themed bundles (the lost city, venom, the flood, the canopy court, the sun
  cult) and the two starters you passed over, on sale for amber in the Collection. A pack only charges
  for the cards you're missing, a quarter under the single-card price. Every card in the roster comes in
  at least one pack.
- **Rites**: 10 in all. The three plain ones (Stow, Kindle, Thicket) come with any starter pack; the
  other seven are unlocked with amber (150–500) and are each unique in kind rather than just bigger:
  Second Look, Forage, Sunbreak, Smother, Rockfall, Clearing, Uproot. You equip one to the Duel deck
  and one to the Campaign deck, separately.
- **Deck**: 14 cards from your collection. Quick Matches deal you 8 of them, and the opponent gets a hand of similar total power (a bit weaker on Easy, stronger on Hard).
- **Amber**: earned from every match (more on harder difficulties) and traded for cards in the Collection. It can't be bought.
- **Daily Duel**: fixed hands from the full roster, same for everyone. The first play each day pays bonus amber and builds a streak: a Rare card at 3 days, Epic at 7, Legendary at 14 and every 30 days after.
- Progress is saved in the browser (`localStorage`).

## Jungle Trail & Trophies

- **Jungle Trail**: 8 opponents in order, each with a fixed hand and rule twists (Wildfire / Overgrowth / Flood: a color gets +1; Deep Shade: no Sunlit squares, five Undergrowth; Rockslide: extra stone, up to as much as the board can take while still leaving every card a square). Clearing a stop unlocks the next and pays amber or a specific card once.
- **Campaign cards** (`src/campaign.js`): the Trail uses a separate campaign deck. Campaign copies start at 75% of their printed numbers. Every Trail win gives all 14 deck cards XP (20/30/45 by difficulty); each level up to 7 is a point that raises Attack or Defense by 1 (max 10). Trail opponents' cards are scaled the same way, plus bonus points at later stops. Quick Match, Daily Duel, and challenges always use printed numbers.
- **AI pacing**: the opponent waits a random 0.5–1.5 seconds before each move, and never plays
  over the attacks of the move it's answering.
- **Trophies**: 16 long-term goals that pay amber once (`src/achievements.js`).
- **Attacks**: every attack a move throws is drawn on the board — a rake of claws out of the
  attacker, along the arrow it used, into the card that arrow points at. The card it reaches
  stands in its old colours until the blow lands, so a chain reads as one blow after another.
  An attack that fails stops short and breaks on a shield of stone the defender raises on the
  side it came from.
- **Capture preview**: with a card selected, hovering a square shows the card there with its final numbers and marks every card it would capture.
- **Sound**: synthesized with Web Audio in `src/ui/sound.js`. Each card can also carry a recorded
  play cue in `audio/cards/<id>.ogg`, layered 60ms after the knock of it landing; a card without
  one just gets the knock. See `audio/README.md` for the spec and all 40 cues.
- **Draw pile**: the cards you have not drawn yet, stacked beside the board on wide screens.
- **Sound toggle**: Mute button on the menu and in matches.

## Viral loop

- **Result image**: a 1200×630 picture of the final board, shared as a file where the device supports it, or saved with "Save image".

- **Share & challenge** shares an emoji result grid plus a link that drops a friend onto the exact same board, with the same hands and tiles, and your score to beat. Deck-based boards encode both hands in the link (`h=`), so friends don't need your cards.

## Layout

| File | Purpose |
| --- | --- |
| `src/cards.js` | Card roster and prices. Append only, since links encode cards by index |
| `src/packs.js` | Themed packs: the three starters and the ones bought with amber |
| `src/engine.js` | Pure game rules and hand building |
| `src/abilities.js` | Card colors, Advantage conditions, ability effects, and rules text |
| `src/rites.js` | The one-shot Rites: catalogue, legal targets, and how each changes the game |
| `src/ui/preview.js` | Hover / press-and-hold card preview |
| `src/ai.js` | Negamax + alpha-beta opponent (easy / normal / hard) |
| `src/profile.js` | Collection, deck, amber, streak rewards |
| `src/share.js` | Daily numbering, share text, challenge links |
| `src/ui/cardView.js` | Card rendering and the artwork manifest |
| `src/main.js` | Screens and game flow |
| `art/` | Card artwork, Rite emblems, and the manifest. See `art/README.md`, `art/rites/README.md` |
| `audio/` | Per-card play cues. See `audio/README.md` |
| `scripts/` | Dev server and art manifest builder |

## Deploying

Live at **https://michaeljwarren25-ux.github.io/vinebound/**, served straight from `main` by GitHub
Pages. There's no build step, so every push to `main` redeploys in about 30 seconds.

It's a plain static site, so Netlify, Cloudflare Pages or Vercel would work the same way. Every path
in the source is relative, which is what lets it live under a `/vinebound/` subpath.

## Testing on a phone

Two ways in, and they're useful for different things:

- **The Pages URL** above. Works on mobile data, survives the PC being off, and is the link to share.
  Shows whatever was last pushed.
- **The dev server over wifi**: run `npm start`, then open `http://<your-lan-ip>:5173` on the phone.
  `scripts/serve.js` binds every interface already, so this needs only a firewall rule allowing
  inbound TCP 5173. This one picks up uncommitted local edits, which is what you want mid-change.

Progress lives in `localStorage`, so it's per-device *and* per-origin: the phone starts with an empty
collection, and the LAN and Pages URLs keep separate saves. That's expected, not a bug.
