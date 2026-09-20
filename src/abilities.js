// Card colors and Advantage abilities. Pure rules, shared by the engine, the AI, and the UI.
//
// Every card wants a color next to it: in one direction, or anywhere around it (sometimes
// two or more). While that want is met the card has Advantage and its effect is on.
// ANY neighbour of that color counts, yours or your opponent's — ownership has nothing to do
// with it. Effects then work for the card's current owner, so a captured card helps its captor.
// Effects change Attack and Defense together unless they name one.
import { CARDS_BY_ID } from './cards.js';
import { CELLS, DIR_INDEX, NEIGHBOR, ZONES } from './board.js';

export const COLORS = ['green', 'red', 'blue'];
export const COLOR_NAMES = { green: 'Green', red: 'Red', blue: 'Blue' };
export const EFFECT_KINDS = ['boost', 'weaken', 'rally', 'partner'];

const EVERY_DIR = [0, 1, 2, 3, 4, 5, 6, 7];

const isColor = (board, cell, color) => cell >= 0 && Boolean(board[cell]) && CARDS_BY_ID[board[cell].cardId].color === color;

// How many neighbors meet the want, or 0 when the want isn't met. `isColor` looks only at the
// card in the square, never at who owns it, so an enemy card gives Advantage just as readily.
function countAdvantage(board, cell, when) {
  const around = NEIGHBOR[cell];
  let found = 0;
  if (when.side === 'any') {
    for (let d = 0; d < 8; d++) if (isColor(board, around[d], when.color)) found++;
  } else if (isColor(board, around[DIR_INDEX[when.side]], when.color)) {
    found = 1;
  }
  return found >= (when.count ?? 1) ? found : 0;
}

// The neighbouring cards that are granting the Advantage.
function advantageSources(board, cell, when) {
  const dirs = when.side === 'any' ? EVERY_DIR : [DIR_INDEX[when.side]];
  return dirs.map((d) => NEIGHBOR[cell][d]).filter((n) => isColor(board, n, when.color));
}

// Modifiers are 2 entries per cell: [Attack, Defense].
const add = (out, cell, amount, stat) => {
  if (stat !== 'def') out[cell * 2] += amount;
  if (stat !== 'atk') out[cell * 2 + 1] += amount;
};

/**
 * Attack and Defense changes from every card with Advantage, plus any color boost from
 * the match rules, as [Attack, Defense] per cell. Tiles aren't included. Pass `out` to reuse a buffer.
 */
export function computeModifiers(board, out = new Int8Array(CELLS * 2), rules = null) {
  out.fill(0);
  const colorBoost = rules?.colorBoost;
  for (let cell = 0; cell < CELLS; cell++) {
    const slot = board[cell];
    if (!slot) continue;
    const card = CARDS_BY_ID[slot.cardId];
    if (colorBoost?.[card.color]) add(out, cell, colorBoost[card.color]);
    const { when, effect } = card.ability;
    const sources = countAdvantage(board, cell, when);
    if (!sources) continue;

    const { kind, amount } = effect;
    if (kind === 'boost') {
      add(out, cell, effect.perSource ? amount * sources : amount, effect.stat);
    } else if (kind === 'partner') {
      for (const p of advantageSources(board, cell, when)) add(out, p, amount);
    } else {
      const targets = effect.target === 'adjacent' ? NEIGHBOR[cell] : ZONES[effect.target];
      for (const t of targets) {
        const other = t >= 0 && board[t];
        if (!other) continue;
        if (kind === 'weaken' && other.owner !== slot.owner) add(out, t, -amount);
        if (kind === 'rally' && other.owner === slot.owner &&
            (!effect.color || CARDS_BY_ID[other.cardId].color === effect.color)) add(out, t, amount);
      }
    }
  }
  return out;
}

// Which cards on the board have Advantage right now.
export function advantagedCells(board) {
  return board.map((slot, cell) =>
    Boolean(slot) && countAdvantage(board, cell, CARDS_BY_ID[slot.cardId].ability.when) > 0);
}

// Whether `cardId` would have Advantage if placed on the (empty) `cell` right now.
export function wouldHaveAdvantage(board, cell, cardId) {
  return countAdvantage(board, cell, CARDS_BY_ID[cardId].ability.when) > 0;
}

// ---------- Rules text ----------

const WHERE = {
  N: 'above it',
  NE: 'above and to its right',
  E: 'to its right',
  SE: 'below and to its right',
  S: 'below it',
  SW: 'below and to its left',
  W: 'to its left',
  NW: 'above and to its left',
};

const STAT_TEXT = { atk: 'Attack', def: 'Defense' };

const TARGET_TEXT = {
  weaken: {
    adjacent: 'Enemy cards around it get',
    corners: 'Enemy cards in the corners get',
    edges: 'Enemy cards on edge squares get',
    center: 'Enemy cards in the center get',
    all: 'All enemy cards get',
  },
  rally: {
    adjacent: 'Allied cards around it get',
    corners: 'Allied cards in the corners get',
    edges: 'Allied cards on edge squares get',
    center: 'Allied cards in the center get',
    all: 'All allied cards get',
  },
};

/** Plain-language ability text: `want` is the Advantage condition, `effect` what it does. */
export function describeAbility(cardId) {
  const { when, effect } = CARDS_BY_ID[cardId].ability;
  const color = COLOR_NAMES[when.color];

  let want;
  if (when.side !== 'any') want = `A ${color} card ${WHERE[when.side]}`;
  else if ((when.count ?? 1) > 1) want = `Next to ${when.count} or more ${color} cards`;
  else if (effect.perSource) want = `Next to ${color} cards`;
  else want = `Next to a ${color} card`;

  const n = effect.amount;
  let text;
  if (effect.kind === 'boost') {
    const which = effect.stat ? STAT_TEXT[effect.stat] : 'Attack and Defense';
    text = `+${n} to its ${which}${effect.perSource ? ' for each one' : ''}.`;
  } else if (effect.kind === 'partner') {
    text = `That card gets +${n}.`;
  } else if (effect.kind === 'rally' && effect.color) {
    text = `All allied ${COLOR_NAMES[effect.color]} cards get +${n}.`;
  } else {
    text = `${TARGET_TEXT[effect.kind][effect.target]} ${effect.kind === 'weaken' ? '−' : '+'}${n}.`;
  }
  return { want, effect: text };
}
