# Rite artwork

A Rite is the one-shot power a deck carries (`src/rites.js`). Until a Rite has art it shows a
carved sigil placeholder, the same way a card without a painting does.

## Adding art

1. Save the image in `art/rites/`, named after the Rite id, e.g. `art/rites/uproot.webp`.
2. Run `npm run art` to update `art/manifest.json`.
3. Reload the game.

## Image spec

These are **not** card paintings. They are emblems, and the game needs to light, tint, grey and
animate them, which a full-bleed painting can't survive.

| | |
| --- | --- |
| **Shape** | Square, 1:1 |
| **Size** | 512 × 512 px |
| **Format** | **WebP with alpha**, or PNG with alpha. Under 60 KB each |
| **Background** | **Fully transparent.** No plate, no card, no vignette |
| **Padding** | Subject fills ~84% of the canvas; leave ~8% clear on every side |
| **Colour** | Near-monochrome pale stone: highlights around `#e8e3cf`, mid `#a89e82`, shadow `#4a4433`. At most a whisper of colour |
| **Text** | None. The game draws the name underneath |
| **Effects** | No drop shadow, glow, frame or border baked in. The game adds all of those |

**Why transparent and near-monochrome:** the token is tinted amber when armed, pulses, and is
desaturated and struck through once spent. A flat colour image fights every one of those states,
and a detailed painting turns to mud — the opponent's token renders at about **62 px** on a phone.

**The real test:** does it read in silhouette at 60 px? If the shape isn't clear that small, it's
too detailed. One motif, big, centred.

## Style direction

A shallow **carved stone relief**, as if cut into the temple walls the board is made of: chisel
marks, worn edges, lichen in the crevices, lit from the upper left so the relief reads through
light and shadow rather than through colour. Matte, not polished. Think a single glyph on a
weathered stele, not an icon set.

## The ten Rites

Each is listed with its file name, what it does in play, and the subject to carve. The subject
should say what the Rite *does*, since that is what a player has to read at a glance.

| File | Rite | What it does | Subject to carve |
| --- | --- | --- | --- |
| `stow.webp` | **Stow** | Put a card from hand under your pile, draw the next | A hand pressing a flat tablet down into still water, rings spreading from it |
| `kindle.webp` | **Kindle** | +1 Attack to all your cards, rest of match | A single flame catching on a bundle of dry twigs, the fire the only warm note |
| `thicket.webp` | **Thicket** | +1 Defense to all your cards, rest of match | Thorned vines woven into a dense shield-wall, growing across the frame |
| `second-look.webp` | **Second Look** | Swap a hand card with the next in your pile | Two tablets crossing as they trade places, one face up, one face down |
| `forage.webp` | **Forage** | Draw an extra card now | A cupped hand lifting seed pods and fruit out of leaf litter |
| `sunbreak.webp` | **Sunbreak** | Turn an empty square Sunlit | A parting in a canopy, one hard shaft of light falling through the gap |
| `smother.webp` | **Smother** | Turn an empty square Undergrowth | Broad leaves closing over and sealing a gap, light squeezed to nothing |
| `rockfall.webp` | **Rockfall** | Bury an empty square under stone | Blocks tumbling from a cracked lintel, dust trailing behind them |
| `clearing.webp` | **Clearing** | Open a blocked square | A slab levered aside, an open dark doorway behind where it sat |
| `uproot.webp` | **Uproot** | Take one of your played cards back to hand | A plant pulled up whole, root ball intact, soil falling away beneath |

Keep the ten consistent: same chisel depth, same light direction, same stone. They sit next to
each other on the Collection shelf, so they should look like one set of carvings by one hand.
