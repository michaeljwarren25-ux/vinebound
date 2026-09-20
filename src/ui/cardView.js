// Renders a card: color-themed frame, attack arrows, Attack and Defense, rarity, and artwork.
import { CARDS_BY_ID } from '../cards.js';
import { statValue, ATK, DEF } from '../engine.js';
import { DIRS, hasArrow } from '../board.js';
import { COLOR_NAMES, describeAbility } from '../abilities.js';
import { setCardCues } from './sound.js';

export const RARITY_LABELS = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

const RARITY_MARKS = { common: 1, rare: 2, epic: 3, legendary: 4 };
const DIR_WORDS = { N: 'up', NE: 'up-right', E: 'right', SE: 'down-right', S: 'down', SW: 'down-left', W: 'left', NW: 'up-left' };
const TEXT_STYLE = '︎'; // forces symbol glyphs to render as text, not colored emoji

// Card id -> filename in art/cards/, and Rite id -> filename in art/rites/. Both are generated
// by `npm run art`; anything without a file falls back to a carved sigil.
let artFiles = {};
let riteFiles = {};

export async function loadArtManifest() {
  try {
    const res = await fetch('art/manifest.json', { cache: 'no-cache' });
    if (res.ok) {
      const manifest = await res.json();
      artFiles = manifest.cards ?? {};
      riteFiles = manifest.rites ?? {};
      setCardCues(manifest.sounds ?? {});
    }
  } catch {
    artFiles = {};
    riteFiles = {};
  }
}

/**
 * A Rite's face: its painting if there is one, otherwise the sigil carved in pale stone. The
 * name sits on a scrim underneath, because at hand size a mark alone isn't enough to go on.
 */
export function riteFaceEl(rite) {
  const face = node('div', 'rite-face');
  if (riteFiles[rite.id]) {
    const img = document.createElement('img');
    img.src = `art/rites/${riteFiles[rite.id]}`;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    face.append(img);
  } else {
    face.append(node('span', 'rite-sigil', rite.sigil + TEXT_STYLE));
  }
  face.append(node('span', 'rite-label', rite.name));
  return face;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

/**
 * On the board, `mods` holds the ability changes to [Attack, Defense] and `advantage` says
 * whether its own ability is on. Campaign cards pass their own `stats` and `level` (a badge).
 */
export function cardEl(cardId, { owner = null, tile = 0, mods = null, advantage = false, stats = null, level = null } = {}) {
  const card = CARDS_BY_ID[cardId];
  const { when } = card.ability;
  const el = node('div', [
    'card', `rarity-${card.rarity}`, `color-${card.color}`, `want-${when.color}`,
    owner === null ? 'neutral' : `owner-${owner}`, advantage ? 'advantaged' : '',
  ].join(' ').trim());
  el.dataset.cardId = cardId;

  const art = node('div', 'card-art');
  if (artFiles[cardId]) {
    const img = document.createElement('img');
    img.src = `art/cards/${artFiles[cardId]}`;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    art.append(img);
  } else {
    art.append(node('span', 'sigil', card.sigil + TEXT_STYLE));
  }

  const marks = node('span', 'rarity-marks');
  for (let i = 0; i < RARITY_MARKS[card.rarity]; i++) marks.append(node('i', ''));
  // A line on the frame in the wanted color shows where the card wants that color.
  el.append(art, marks, node('span', `want-mark side-${when.side}`));

  // Arrows sit on the frame, pointing the ways the card attacks.
  DIRS.forEach((dir, i) => {
    if (hasArrow(card.arrowMask, i)) el.append(node('span', `arrow dir-${dir}`));
  });

  const plaque = node('span', 'stats');
  for (const stat of [ATK, DEF]) {
    const mod = mods ? mods[stat] : 0;
    const shift = tile + mod;
    const value = statValue(cardId, stat, tile, mod, stats);
    const cls = `stat ${stat === ATK ? 'atk' : 'def'}${shift > 0 ? ' buff' : shift < 0 ? ' debuff' : ''}`;
    plaque.append(node('span', cls, String(value)));
  }
  el.append(plaque);

  if (level) el.append(node('span', 'level-badge', `Lv ${level}`));
  return el;
}

// A face-down card, for the opponent's hand.
export function cardBackEl() {
  return node('div', 'card-back');
}

export function cardLabel(cardId, customStats = null) {
  const card = CARDS_BY_ID[cardId];
  const [atk, def] = customStats ?? [card.atk, card.def];
  const { want, effect } = describeAbility(cardId);
  const arrows = card.arrows.length === 8 ? 'every direction' : card.arrows.map((d) => DIR_WORDS[d]).join(', ');
  return `${card.name}, ${COLOR_NAMES[card.color]}: Attack ${atk}, Defense ${def}, attacks ${arrows}. Advantage: ${want}. ${effect}`;
}

// The ability as a small panel. Pass `advantage` as true or false to show whether it's on now.
export function abilityBlock(cardId, advantage = null) {
  const { want, effect } = describeAbility(cardId);
  const box = node('div', `ability want-${CARDS_BY_ID[cardId].ability.when.color}${advantage ? ' is-active' : ''}`);
  const head = node('p', 'ability-want');
  head.append(node('span', 'ability-tag', 'Advantage'), want);
  box.append(head, node('p', 'ability-effect', effect), node('p', 'ability-note', 'Yours or theirs — any card of that color counts.'));
  if (advantage !== null) {
    box.append(node('p', 'ability-state', advantage ? 'Advantage: active now' : 'No advantage'));
  }
  return box;
}
