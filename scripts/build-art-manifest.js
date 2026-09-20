// Scans the asset folders and writes art/manifest.json, so the game knows what has artwork and
// what has a sound. Name every file after its id:
//
//   art/cards/grave-rat.webp     card artwork        (see art/README.md)
//   art/rites/uproot.webp        Rite emblem         (see art/rites/README.md)
//   audio/cards/grave-rat.ogg    the card's play cue (see audio/README.md)
//
// Anything without a file falls back: cards and Rites to a carved sigil, sounds to the plain
// wooden knock every placement makes.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { CARDS, CARDS_BY_ID } from '../src/cards.js';
import { RITES, RITES_BY_ID } from '../src/rites.js';

const IMAGES = /\.(webp|png|jpe?g|avif)$/i;
const SOUNDS = /\.(ogg|mp3|m4a|wav|webm)$/i;

const manifestFile = new URL('../art/manifest.json', import.meta.url);
const ignored = [];

// Everything in `dir` whose file name matches a known id.
async function scan(dir, known, label, match) {
  const url = new URL(`../${dir}/`, import.meta.url);
  await mkdir(url, { recursive: true });
  const files = (await readdir(url)).filter((f) => match.test(f)).sort();
  const found = {};
  for (const file of files) {
    const id = file.replace(/\.[^.]+$/, '');
    if (!known[id]) ignored.push(`${dir}/${file} (no such ${label})`);
    else if (found[id]) ignored.push(`${dir}/${file} (duplicate of ${found[id]})`);
    else found[id] = file;
  }
  return found;
}

const cards = await scan('art/cards', CARDS_BY_ID, 'card', IMAGES);
const rites = await scan('art/rites', RITES_BY_ID, 'Rite', IMAGES);
const sounds = await scan('audio/cards', CARDS_BY_ID, 'card', SOUNDS);

await writeFile(manifestFile, JSON.stringify({ cards, rites, sounds }, null, 2) + '\n');

const count = (found, total) => `${Object.keys(found).length}/${total}`;
console.log(`Manifest written: ${count(cards, CARDS.length)} cards painted, `
  + `${count(rites, RITES.length)} Rites drawn, ${count(sounds, CARDS.length)} cards voiced.`);
if (ignored.length) console.warn(`Ignored: ${ignored.join(', ')}`);

const missing = {
  'card art': CARDS.filter((c) => !cards[c.id]).map((c) => c.id),
  'Rite art': RITES.filter((r) => !rites[r.id]).map((r) => r.id),
  'card audio': CARDS.filter((c) => !sounds[c.id]).map((c) => c.id),
};
for (const [what, list] of Object.entries(missing)) {
  if (list.length) console.log(`Missing ${what} (${list.length}): ${list.join(', ')}`);
}
