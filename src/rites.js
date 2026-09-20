// Rites: the one-shot power each side brings to a match, on top of its deck.
//
// You equip one Rite to your deck in the Collection; your opponent brings one too, picked from the
// match seed so a replay of the same seed is the same fight. Each side may use its Rite once, on
// its own turn, and using it is free: it doesn't cost you the card you play that turn.
//
// Everything here is pure, like engine.js: `useRite` returns a new state and never mutates the one
// it is given, so the AI can try a Rite out the same way it tries a move, and the tests can too.
//
// Deliberately, no Rite reaches into how a placement resolves. A card that lands still fights with
// the numbers frozen the moment it landed (see engine.js), so Rites either change the state before
// the card is played (stats, tiles, stone, hand) or move cards around. That keeps placeCard, and
// therefore the AI's search, exactly as it was.
import { CARDS_BY_ID, PRICES } from './cards.js';
import { COLORS } from './abilities.js';

// What a Rite needs you to pick before it can be used.
// - none:    nothing to choose
// - hand:    one of the cards in your hand (by hand index)
// - empty:   an open square (by cell)
// - blocked: a square under stone (by cell)
// - placed:  one of the cards you played, still yours (by cell)
export const RITE_TARGETS = ['none', 'hand', 'empty', 'blocked', 'placed'];

/**
 * The catalogue. ORDER MATTERS: challenge links encode Rites by index, so only ever append.
 *
 * `sigil` is the carved mark shown until `art/rites/<id>.webp` exists (see art/rites/README.md).
 * `pack` marks the three that come free with a starter pack, one per color's temperament. The
 * rest are bought with amber in the Collection, and are priced by how much they bend a match
 * rather than by how big a number they add — none of them is simply a better Kindle.
 */
export const RITES = [
  {
    id: 'stow',
    sigil: '↧',
    name: 'Stow',
    pack: 'blackwater',
    price: 0,
    target: 'hand',
    text: 'Put a card from your hand under your pile and draw the next one.',
    flavor: 'The river keeps what it is given, and gives back something else.',
  },
  {
    id: 'kindle',
    sigil: '✸',
    name: 'Kindle',
    pack: 'emberfall',
    price: 0,
    target: 'none',
    text: '+1 Attack to every card you hold or have played, for the rest of the match.',
    flavor: 'It catches, and then it does not stop.',
  },
  {
    id: 'thicket',
    sigil: '⚘',
    name: 'Thicket',
    pack: 'overgrowth',
    price: 0,
    target: 'none',
    text: '+1 Defense to every card you hold or have played, for the rest of the match.',
    flavor: 'Everything here grows toward everything else.',
  },
  {
    id: 'second-look',
    sigil: '⇄',
    name: 'Second Look',
    price: 150,
    target: 'hand',
    text: 'Swap a card in your hand with the next card in your pile.',
    flavor: 'Look again. It was never what you thought.',
  },
  {
    id: 'forage',
    sigil: '❖',
    name: 'Forage',
    price: 200,
    target: 'none',
    text: 'Draw a card straight away, and hold it on top of your hand.',
    flavor: 'There is always more than you were looking for.',
  },
  {
    id: 'sunbreak',
    sigil: '☼',
    name: 'Sunbreak',
    price: 250,
    target: 'empty',
    text: 'Open the canopy over an empty square: it becomes Sunlit, +1 to whatever lands there.',
    flavor: 'A gap in the leaves, and for an hour the floor remembers the sun.',
  },
  {
    id: 'smother',
    sigil: '✽',
    name: 'Smother',
    price: 250,
    target: 'empty',
    text: 'Close the canopy over an empty square: it becomes Undergrowth, −1 to whatever lands there.',
    flavor: 'Give it a season. Give it a week.',
  },
  {
    id: 'rockfall',
    sigil: '▲',
    name: 'Rockfall',
    price: 350,
    target: 'empty',
    text: 'Bury an empty square under fallen stone. Nothing can be played there again.',
    flavor: 'The temple has been coming down for six hundred years. It is in no hurry.',
  },
  {
    id: 'clearing',
    sigil: '◇',
    name: 'Clearing',
    price: 350,
    target: 'blocked',
    text: 'Haul the stone off a blocked square and open it up to play.',
    flavor: 'Somebody built a road here once.',
  },
  {
    id: 'uproot',
    sigil: '↥',
    name: 'Uproot',
    price: 500,
    target: 'placed',
    text: 'Take one of the cards you played back off the board and into your hand.',
    flavor: 'Pull it up whole, roots and all, before the ground closes over it.',
  },
];

export const RITES_BY_ID = Object.fromEntries(RITES.map((rite) => [rite.id, rite]));
export const RITE_INDEX = Object.fromEntries(RITES.map((rite, i) => [rite.id, i]));
export const STARTER_RITES = RITES.filter((rite) => rite.pack);
export const DEFAULT_RITE = 'stow';

export const isRite = (id) => Object.hasOwn(RITES_BY_ID, id);
export const riteFor = (packId) => STARTER_RITES.find((rite) => rite.pack === packId)?.id ?? DEFAULT_RITE;

/** Has this side still got its Rite? */
export function riteReady(state, side) {
  return Boolean(state.rites?.[side]) && !state.ritesUsed?.[side];
}

/**
 * Every target this side could legally pick for its Rite right now, as an array. A Rite that needs
 * nothing picked returns `[null]`; one that has nothing to pick returns `[]`, which means it
 * cannot be used yet (Clearing with no stone left, Stow with an empty pile).
 */
export function riteTargets(state, side) {
  if (!riteReady(state, side)) return [];
  const rite = RITES_BY_ID[state.rites[side]];
  const cells = (test) => state.board.map((_, cell) => cell).filter(test);

  switch (rite.target) {
    case 'none':
      // Forage needs a card left to draw; the stat Rites are always available.
      return rite.id === 'forage' && state.decks[side].length === 0 ? [] : [null];
    case 'hand':
      // Both hand Rites trade against the pile, so they need one card left in it.
      return state.decks[side].length === 0 ? [] : state.hands[side].map((_, i) => i);
    case 'empty':
      return cells((cell) => !state.board[cell] && !state.blocked[cell]);
    case 'blocked':
      return cells((cell) => state.blocked[cell]);
    case 'placed':
      // Only cards you played and still hold: a card you took off your opponent isn't yours to pull up.
      return cells((cell) => state.board[cell]?.owner === side && state.board[cell]?.side === side);
    default:
      return [];
  }
}

export const canUseRite = (state, side) => riteTargets(state, side).length > 0;

// +1 to one stat on every card this side brought, building on whatever they already use so a
// campaign card's scaled numbers are raised rather than replaced.
function raiseAll(state, side, stat) {
  const raised = { ...state.rules.stats[side] };
  for (const cardId of state.dealt[side]) {
    const card = CARDS_BY_ID[cardId];
    const [atk, def] = raised[cardId] ?? [card.atk, card.def];
    raised[cardId] = stat === 0 ? [Math.min(10, atk + 1), def] : [atk, Math.min(10, def + 1)];
  }
  const stats = state.rules.stats.map((byCard, p) => (p === side ? raised : byCard));
  return { ...state, rules: { ...state.rules, stats } };
}

const replaceAt = (list, index, value) => list.map((item, i) => (i === index ? value : item));

/**
 * Uses `side`'s Rite on `target` and returns the new state. Throws if it isn't legal, the same way
 * applyMove does, so a bad call is a bug rather than a silently wasted Rite.
 */
export function useRite(state, side, target = null) {
  if (!riteReady(state, side)) throw new Error('No Rite left for this side');
  const legal = riteTargets(state, side);
  const ok = legal.some((t) => t === target);
  if (!ok) throw new Error(`${state.rites[side]} cannot be used on ${target}`);

  const rite = RITES_BY_ID[state.rites[side]];
  const spent = { ...state, ritesUsed: replaceAt(state.ritesUsed, side, true), lastRite: { side, rite: rite.id, target } };

  switch (rite.id) {
    case 'kindle':
      return raiseAll(spent, side, 0);
    case 'thicket':
      return raiseAll(spent, side, 1);

    case 'forage': {
      const [drawn, ...rest] = spent.decks[side];
      return {
        ...spent,
        hands: replaceAt(spent.hands, side, [...spent.hands[side], drawn]),
        decks: replaceAt(spent.decks, side, rest),
      };
    }

    case 'stow': {
      // Under the pile, not out of the game: you may still see it again.
      const held = spent.hands[side][target];
      const [drawn, ...rest] = spent.decks[side];
      return {
        ...spent,
        hands: replaceAt(spent.hands, side, replaceAt(spent.hands[side], target, drawn)),
        decks: replaceAt(spent.decks, side, [...rest, held]),
      };
    }

    case 'second-look': {
      // A straight swap: the card you didn't want goes back on top, so it's the next one you draw.
      const held = spent.hands[side][target];
      const [drawn, ...rest] = spent.decks[side];
      return {
        ...spent,
        hands: replaceAt(spent.hands, side, replaceAt(spent.hands[side], target, drawn)),
        decks: replaceAt(spent.decks, side, [held, ...rest]),
      };
    }

    case 'sunbreak':
      return { ...spent, tiles: replaceAt(spent.tiles, target, 1) };
    case 'smother':
      return { ...spent, tiles: replaceAt(spent.tiles, target, -1) };

    case 'rockfall':
      // Stone covers whatever the square was, so a buried Sunlit square stops helping anyone.
      return {
        ...spent,
        blocked: replaceAt(spent.blocked, target, true),
        tiles: replaceAt(spent.tiles, target, 0),
      };
    case 'clearing':
      return { ...spent, blocked: replaceAt(spent.blocked, target, false) };

    case 'uproot': {
      const lifted = spent.board[target];
      return {
        ...spent,
        board: replaceAt(spent.board, target, null),
        hands: replaceAt(spent.hands, side, [...spent.hands[side], lifted.cardId]),
      };
    }

    default:
      throw new Error(`Unknown Rite ${rite.id}`);
  }
}

/** What a Rite costs to unlock, and what the three starter ones are worth if you already have them. */
export const ritePrice = (id) => RITES_BY_ID[id]?.price ?? 0;

// Re-exported so the Collection can price Rites beside cards without importing two modules.
export { PRICES, COLORS };
