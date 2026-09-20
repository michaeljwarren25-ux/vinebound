# Card artwork

Until a card has a painting, it shows placeholder art: a carved sigil in a shadowy jungle frame.

## Adding art

1. Save the image in `art/cards/`, named after the card id, for example `art/cards/temple-guardian.webp`.
   Card ids are listed in `src/cards.js`.
2. Run `npm run art` to update `art/manifest.json`.
3. Reload the game.

## Image spec

- **Aspect ratio 4:5, portrait.** 800×1000 px is plenty.
- **WebP** preferred (PNG, JPG, and AVIF also work). Aim for under 150 KB each.
- **Keep the subject centered.** The four number tablets cover the middle of each edge,
  and the frame covers a thin border.
- **No text, borders, or frames in the image.** The game draws those.

## Style direction

Hyper-realistic 2D dark fantasy painting in the spirit of Gwent card art, set in a dark,
dangerous jungle: overgrown ruins, humid mist, shafts of light through the canopy,
predators and poison. Dramatic chiaroscuro lighting, muted earthy greens and browns with
one strong accent color, painterly detail, a single character or creature as the focal point.

Cards are themed by their `color` in `src/cards.js`, so let the painting's accent follow it:
green (moss and canopy), red (firelight and blood), blue (cold river teal and mist).

See `card-list.md` for every card with its file name, rarity, color, and a subject description.
