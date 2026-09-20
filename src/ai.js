// Opponent AI: negamax with alpha-beta pruning over the pure engine rules.
// It searches with both hands and both draw piles known.
import { placeCard, score } from './engine.js';
import { riteTargets, useRite, RITES_BY_ID } from './rites.js';

const LEVELS = {
  easy: { depth: 1, noise: 3 },
  normal: { depth: 2, noise: 0.75 },
  hard: { depth: 3, noise: 0 },
};

// Once this few plays remain, hard mode searches to the end of the game.
const FULL_SEARCH_PLAYS = 5;

/**
 * Whether to spend the Rite this turn, and on what. Rather than hand-written advice per Rite, this
 * plays out every legal target and scores the position it leads to with the same search that picks
 * moves, then compares it against not using the Rite at all. It only runs once a match, and only
 * over a handful of targets, so a shallow look is affordable and it never has to be taught what a
 * new Rite does.
 *
 * `bias` is what the Rite has to beat to be worth spending: a small margin on Easy so the opponent
 * hoards it, none on Hard.
 */
const RITE_BIAS = { easy: 1.5, normal: 0.5, hard: 0 };

export function chooseRite(state, level = 'normal') {
  const targets = riteTargets(state, state.turn);
  if (targets.length === 0) return null;
  const depth = level === 'easy' ? 1 : 2;

  const value = (next) => {
    const pos = snapshot(next);
    return -negamax(pos, 1 - next.turn, depth - 1, -Infinity, Infinity);
  };

  const hold = value(state) - (RITE_BIAS[level] ?? RITE_BIAS.normal);
  let best = null;
  for (const target of targets) {
    const after = value(useRite(state, state.turn, target));
    if (after > hold && (best === null || after > best.value)) best = { target, value: after };
  }
  // Uproot takes one of its own cards off the board, which the search happily does for tempo even
  // when it is behind on cards; hold it back unless the position genuinely improves.
  if (best && RITES_BY_ID[state.rites[state.turn]].target === 'placed' && best.value <= hold + 1) return null;
  return best && { target: best.target };
}

function snapshot(state) {
  return {
    board: state.board.map((slot) => slot && { ...slot }),
    hands: state.hands.map((h) => [...h]),
    decks: (state.decks ?? [[], []]).map((d) => [...d]),
    tiles: state.tiles,
    blocked: state.blocked ?? [],
    rules: state.rules ?? null,
  };
}

export function chooseMove(state, level = 'normal', rand = Math.random) {
  const cfg = LEVELS[level] ?? LEVELS.normal;
  const pos = snapshot(state);
  const me = state.turn;

  const playsLeft = pos.hands.flat().length + pos.decks.flat().length;
  const depth = level === 'hard' && playsLeft <= FULL_SEARCH_PLAYS ? playsLeft : cfg.depth;

  let best = null;
  let bestValue = -Infinity;
  for (const move of orderedMoves(pos, me)) {
    const undo = doMove(pos, me, move);
    const value = -negamax(pos, 1 - me, depth - 1, -Infinity, Infinity) + cfg.noise * (rand() * 2 - 1);
    undoMove(pos, me, move, undo);

    if (value > bestValue) {
      bestValue = value;
      best = { handIndex: move.handIndex, cell: move.cell };
    }
  }
  return best;
}

function negamax(pos, turn, depth, alpha, beta) {
  // A side out of cards is skipped rather than ending the line: the other may still have plays
  // left (see nextTurn in engine.js), and those plays decide the board.
  if (pos.hands[turn].length === 0) {
    if (pos.hands[1 - turn].length === 0 || depth <= 0) return evaluate(pos.board, turn);
    return -negamax(pos, 1 - turn, depth - 1, -beta, -alpha);
  }
  if (depth <= 0) return evaluate(pos.board, turn);

  let best = -Infinity;
  for (const move of orderedMoves(pos, turn)) {
    const undo = doMove(pos, turn, move);
    const value = -negamax(pos, 1 - turn, depth - 1, -beta, -alpha);
    undoMove(pos, turn, move, undo);

    if (value > best) best = value;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? evaluate(pos.board, turn) : best;
}

function doMove(pos, turn, { handIndex, cell }) {
  const hand = pos.hands[turn];
  const cardId = hand[handIndex];
  const flipped = placeCard(pos.board, pos.tiles, cell, cardId, turn, pos.rules);
  hand.splice(handIndex, 1);
  const drew = pos.decks[turn].length > 0;
  if (drew) hand.push(pos.decks[turn].shift());
  return { cardId, flipped, drew };
}

function undoMove(pos, turn, { handIndex, cell }, { cardId, flipped, drew }) {
  const hand = pos.hands[turn];
  if (drew) pos.decks[turn].unshift(hand.pop());
  hand.splice(handIndex, 0, cardId);
  unplace(pos.board, cell, flipped, turn);
}

// Trying high-capture moves first makes alpha-beta prune far more.
function orderedMoves(pos, owner) {
  const { board, tiles, blocked, rules } = pos;
  const moves = [];
  pos.hands[owner].forEach((cardId, handIndex) => {
    board.forEach((slot, cell) => {
      if (slot || blocked[cell]) return;
      const flipped = placeCard(board, tiles, cell, cardId, owner, rules);
      unplace(board, cell, flipped, owner);
      moves.push({ handIndex, cell, flips: flipped.length });
    });
  });
  return moves.sort((a, b) => b.flips - a.flips);
}

function unplace(board, cell, flipped, mover) {
  board[cell] = null;
  for (const f of flipped) board[f].owner = 1 - mover;
}

function evaluate(board, turn) {
  const totals = score(board);
  return totals[turn] - totals[1 - turn];
}
