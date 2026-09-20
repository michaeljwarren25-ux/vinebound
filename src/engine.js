// Pure game rules. No DOM access, so the AI and tests can use it directly.
//
// The board is 5×5 with a few blocked stone squares. Every card has Attack, Defense, and
// 1-8 arrows. A placed card attacks each enemy card its arrows point at: if that card
// points back, Attack must beat Defense (ties hold); if it doesn't, it's captured for free.
// Every captured card then attacks along its own arrows, until nothing more falls. The whole
// chain is settled with the numbers as they stood the moment the card landed.
import { CARDS, CARDS_BY_ID, cardPower } from './cards.js';
import { hashString, mulberry32, shuffle } from './rng.js';
import { computeModifiers, COLORS } from './abilities.js';
import { CELLS, NEIGHBOR, opposite, hasArrow } from './board.js';
import { RITES, isRite, DEFAULT_RITE } from './rites.js';

export { CELLS } from './board.js';
export const PLAYER = 0;
export const OPPONENT = 1;
export const MATCH_CARDS = 8; // cards each side brings to a match
export const OPENING_HAND = 3; // cards held at once; you draw after every play
export const ATK = 0;
export const DEF = 1;
const MAX_BLOCKED = CELLS - MATCH_CARDS * 2; // always leave room for every card

// `mod` is the change from Advantage abilities and rule twists (see abilities.js).
// `stats` overrides the printed [Attack, Defense] (campaign cards); null uses the printed ones.
export function statValue(cardId, stat, tile = 0, mod = 0, stats = null) {
  const card = CARDS_BY_ID[cardId];
  const base = stats ? stats[stat] : stat === ATK ? card.atk : card.def;
  return Math.max(1, Math.min(10, base + tile + mod));
}

// A board card's own numbers. They belong to the side that played it, even after a capture.
export function slotStats(slot, rules) {
  return rules?.stats?.[slot.side]?.[slot.cardId] ?? null;
}

const handPower = (hand) => hand.reduce((sum, id) => sum + cardPower(id), 0);
const clampInt = (value, min, max, fallback) => (Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback);

/**
 * Match rules. Defaults are the standard game; Jungle Trail twists change them.
 * - sun / shade: how many Sunlit (+1) and Undergrowth (−1) squares
 * - blockedMin / blockedMax: range for random blocked squares; extraBlocked adds more (Rockslide)
 * - colorBoost: e.g. { red: 1 } gives every Red card +1
 * - stats: per side, card id -> [Attack, Defense] replacing printed numbers (campaign)
 */
export function normalizeRules(rules = null) {
  const colorBoost = {};
  for (const color of COLORS) {
    const amount = clampInt(rules?.colorBoost?.[color], -3, 3, 0);
    if (amount) colorBoost[color] = amount;
  }
  const stats = [PLAYER, OPPONENT].map((side) => {
    const byCard = {};
    for (const [id, values] of Object.entries(rules?.stats?.[side] ?? {})) {
      if (CARDS_BY_ID[id] && Array.isArray(values) && values.length === 2 && values.every(Number.isInteger)) {
        byCard[id] = values.map((v) => Math.max(1, Math.min(10, v)));
      }
    }
    return byCard;
  });
  const blockedMin = clampInt(rules?.blockedMin, 0, MAX_BLOCKED, 4);
  return {
    sun: clampInt(rules?.sun, 0, 6, 2),
    shade: clampInt(rules?.shade, 0, 6, 2),
    blockedMin,
    blockedMax: clampInt(rules?.blockedMax, blockedMin, MAX_BLOCKED, Math.max(blockedMin, 8)),
    extraBlocked: clampInt(rules?.extraBlocked, 0, MAX_BLOCKED, 0),
    colorBoost,
    stats,
  };
}

/**
 * Creates a new game. The seed always decides the blocked squares, tiles, and who plays first.
 * Each side's MATCH_CARDS cards (in draw order) come from:
 * `rites` is the one-shot power each side brings (see rites.js); the opponent's is drawn from
 * the seed when it isn't given, so the same seed is always the same fight.
 * - `hands`: both given explicitly (replaying a challenge link, or a Trail opponent), or
 * - `playerHand`: the player's cards from their deck; the opponent gets cards
 *   whose total power is close to the player's, shifted by `powerOffset`, or
 * - neither: both are drafted from the full roster (Daily Duel).
 */
export function createGame(seed, { hands = null, playerHand = null, powerOffset = 0, rules = null, rites = null } = {}) {
  const rand = mulberry32(hashString(String(seed)));
  const matchRules = normalizeRules(rules);

  // The field and the coin toss are rolled first so they match no matter how the cards were chosen.
  const spread = matchRules.blockedMax - matchRules.blockedMin + 1;
  const blockedCount = Math.min(MAX_BLOCKED, matchRules.blockedMin + Math.floor(rand() * spread) + matchRules.extraBlocked);
  const order = shuffle([...Array(CELLS).keys()], rand);
  const blocked = Array(CELLS).fill(false);
  const tiles = Array(CELLS).fill(0);
  let next = 0;
  for (let i = 0; i < blockedCount; i++) blocked[order[next++]] = true;
  for (let i = 0; i < matchRules.sun; i++) tiles[order[next++]] = 1;
  for (let i = 0; i < matchRules.shade; i++) tiles[order[next++]] = -1;
  const first = rand() < 0.5 ? PLAYER : OPPONENT;
  // Rolled here, with the field, so it doesn't shift with however the cards were chosen.
  const seededRite = RITES[Math.floor(rand() * RITES.length)].id;
  const matchRites = [
    isRite(rites?.[PLAYER]) ? rites[PLAYER] : DEFAULT_RITE,
    isRite(rites?.[OPPONENT]) ? rites[OPPONENT] : seededRite,
  ];

  let dealt;
  if (hands) {
    dealt = hands.map((h) => [...h]);
  } else if (playerHand) {
    dealt = [[...playerHand], buildOpponentHand(playerHand, powerOffset, rand)];
  } else {
    dealt = draftHands(rand);
  }

  return {
    seed: String(seed),
    board: Array(CELLS).fill(null),
    blocked,
    dealt, // each side's cards in draw order, used for challenge links
    hands: dealt.map((cards) => cards.slice(0, OPENING_HAND)),
    decks: dealt.map((cards) => cards.slice(OPENING_HAND)),
    tiles,
    rules: matchRules,
    rites: matchRites,
    ritesUsed: [false, false],
    first,
    turn: first,
    lastMove: null,
    lastRite: null,
  };
}

function draftHands(rand) {
  const drawn = shuffle(CARDS.map((c) => c.id), rand).slice(0, MATCH_CARDS * 2);
  drawn.sort((a, b) => cardPower(b) - cardPower(a));
  // Snake draft (P O O P P O O P P O) keeps both hands close in total power.
  const hands = [[], []];
  const pattern = [PLAYER, OPPONENT, OPPONENT, PLAYER];
  drawn.forEach((id, i) => hands[pattern[i % 4]].push(id));
  hands.forEach((hand) => shuffle(hand, rand));
  return hands;
}

// Hill-climbs toward a hand whose total power is the player's plus `powerOffset`.
export function buildOpponentHand(playerHand, powerOffset, rand) {
  const pool = shuffle(CARDS.map((c) => c.id).filter((id) => !playerHand.includes(id)), rand);
  const hand = pool.slice(0, MATCH_CARDS);
  const bench = pool.slice(MATCH_CARDS);
  const target = handPower(playerHand) + powerOffset;
  let total = handPower(hand);

  for (let i = 0; i < 500 && total !== target; i++) {
    const h = Math.floor(rand() * hand.length);
    const b = Math.floor(rand() * bench.length);
    const next = total - cardPower(hand[h]) + cardPower(bench[b]);
    if (Math.abs(next - target) < Math.abs(total - target)) {
      [hand[h], bench[b]] = [bench[b], hand[h]];
      total = next;
    }
  }
  return hand;
}

// Reused by placeCard, which the AI calls many thousands of times per move.
const mods = new Int8Array(CELLS * 2);

/**
 * Places a card and resolves every capture it causes, chains included. Mutates `board`;
 * returns the captured cells in the order they fell.
 *
 * Pass `log` to also collect every attack that was thrown, for the UI's strike animations:
 * `{ from, to, dir, round, contested, won }`, where `round` is 0 for the placed card's own
 * attacks and counts up once per link of the chain. The AI never passes one, so its millions
 * of calls allocate nothing extra.
 */
export function placeCard(board, tiles, cell, cardId, owner, rules = null, log = null) {
  board[cell] = { cardId, owner, side: owner };
  // Ability modifiers are frozen the moment the card lands, and the whole chain is resolved
  // against them. They used to be recomputed after every round of captures, which meant a card
  // switched sides mid-chain and started weakening its old friends (or drawing its new owner's
  // rally) before it swung: battles then used numbers nobody could see on the board.
  computeModifiers(board, mods, rules);
  const flipped = [];
  let attackers = [cell];
  let round = 0;
  while (attackers.length > 0) {
    const captured = [];
    for (const from of attackers) {
      const attacker = board[from];
      const arrows = CARDS_BY_ID[attacker.cardId].arrowMask;
      for (let dir = 0; dir < 8; dir++) {
        if (!hasArrow(arrows, dir)) continue;
        const to = NEIGHBOR[from][dir];
        const target = to >= 0 ? board[to] : null;
        if (!target || target.owner === owner) continue;

        // Pointing back means a battle; an open side falls for free.
        let wins = true;
        const contested = hasArrow(CARDS_BY_ID[target.cardId].arrowMask, opposite(dir));
        if (contested) {
          const attack = statValue(attacker.cardId, ATK, tiles[from], mods[from * 2], slotStats(attacker, rules));
          const defense = statValue(target.cardId, DEF, tiles[to], mods[to * 2 + 1], slotStats(target, rules));
          wins = attack > defense;
        }
        if (log) log.push({ from, to, dir, round, contested, won: wins });
        if (wins) {
          target.owner = owner;
          flipped.push(to);
          captured.push(to);
        }
      }
    }
    attackers = captured;
    round++;
  }
  return flipped;
}

// Over once every card has been played (or, defensively, when no open square is left).
export function isOver(state) {
  const cardsLeft = state.hands.some((h) => h.length > 0) || (state.decks ?? []).some((d) => d.length > 0);
  return !cardsLeft || !state.board.some((slot, i) => !slot && !state.blocked?.[i]);
}

// Whose turn it is after `mover` plays. Normally the other side, but a side with nothing left to
// play is skipped: Uproot hands a card back, so the sides don't always have the same number of
// plays left, and the one still holding cards finishes the board on its own.
export function nextTurn(hands, mover) {
  const other = 1 - mover;
  return hands[other].length > 0 ? other : mover;
}

export function legalMoves(state) {
  const moves = [];
  state.hands[state.turn].forEach((_, handIndex) => {
    state.board.forEach((slot, cell) => {
      if (!slot && !state.blocked?.[cell]) moves.push({ handIndex, cell });
    });
  });
  return moves;
}

// Plays a card from the mover's hand, then they draw the next card from their pile.
export function applyMove(state, { handIndex, cell }) {
  if (isOver(state)) throw new Error('Game is over');
  if (state.blocked?.[cell]) throw new Error(`Cell ${cell} is blocked`);
  if (state.board[cell]) throw new Error(`Cell ${cell} is occupied`);
  const mover = state.turn;
  const cardId = state.hands[mover][handIndex];
  if (cardId === undefined) throw new Error(`No card at hand index ${handIndex}`);

  const board = state.board.map((slot) => slot && { ...slot });
  const strikes = [];
  const flipped = placeCard(board, state.tiles, cell, cardId, mover, state.rules, strikes);
  const decks = state.decks ?? [[], []];
  const drew = decks[mover][0] ?? null;
  const hands = state.hands.map((h, p) => {
    if (p !== mover) return h;
    const rest = h.filter((_, i) => i !== handIndex);
    return drew ? [...rest, drew] : rest;
  });

  return {
    ...state,
    board,
    hands,
    decks: decks.map((d, p) => (p === mover ? d.slice(1) : d)),
    turn: nextTurn(hands, mover),
    lastMove: { cell, cardId, owner: mover, flipped, drew, strikes },
    lastRite: null, // the Rite banner belongs to the turn it was used on
  };
}

export function score(board) {
  const totals = [0, 0];
  for (const slot of board) if (slot) totals[slot.owner]++;
  return totals;
}

// 'win', 'loss', or 'draw' from the player's side.
export function outcome([p, o]) {
  return p > o ? 'win' : p < o ? 'loss' : 'draw';
}
