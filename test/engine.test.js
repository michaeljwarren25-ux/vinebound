import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, applyMove, legalMoves, isOver, score, outcome, normalizeRules, statValue, slotStats,
  CELLS, PLAYER, OPPONENT, MATCH_CARDS, OPENING_HAND,
} from '../src/engine.js';
import { chooseMove } from '../src/ai.js';
import { CARDS, RARITIES, cardPower } from '../src/cards.js';
import { DIRS, DIR_INDEX, NEIGHBOR, SIZE, ZONES } from '../src/board.js';
import { mulberry32 } from '../src/rng.js';
import {
  parseChallenge, challengeUrl, dailyNumber, emojiGrid, shiftKey, encodeHands, decodeHands, buildShareText,
} from '../src/share.js';

const emptyBoard = () => Array(CELLS).fill(null);
const at = (cardId, owner) => ({ cardId, owner, side: owner });
// Squares by row and column. The battle tests care about which square is above or beside
// which, not about any particular index, so they say so rather than hard-coding a numbering.
const cell = (row, col) => row * SIZE + col;
const [TOP, MID, LOW] = [cell(0, 1), cell(1, 1), cell(2, 1)]; // one column, three rows down

function makeState({ board = emptyBoard(), hands, decks = [[], []], tiles = Array(CELLS).fill(0), blocked = Array(CELLS).fill(false), rules = null, turn = PLAYER }) {
  return { seed: 'test', board, hands, decks, tiles, blocked, rules: normalizeRules(rules), turn, lastMove: null };
}

// Plays one card for the player onto `cell` of the given board.
const place = (board, cardId, cell, extra = {}) => applyMove(makeState({ board, hands: [[cardId], []], ...extra }), { handIndex: 0, cell });

test('roster: unique ids, stats and arrows in range, power fits the rarity budget', () => {
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
  const budget = { common: [12, 13], rare: [15, 17], epic: [18, 20], legendary: [21, 24] };
  for (const card of CARDS) {
    assert.ok(RARITIES.includes(card.rarity), `${card.id} rarity`);
    for (const stat of [card.atk, card.def]) assert.ok(Number.isInteger(stat) && stat >= 1 && stat <= 10, `${card.id} stats`);
    assert.ok(card.arrows.length >= 1 && card.arrows.length <= 8, `${card.id} arrow count`);
    assert.equal(new Set(card.arrows).size, card.arrows.length, `${card.id} duplicate arrows`);
    assert.ok(card.arrows.every((d) => DIRS.includes(d)), `${card.id} arrow names`);
    const [min, max] = budget[card.rarity];
    assert.ok(cardPower(card.id) >= min && cardPower(card.id) <= max, `${card.id} power ${cardPower(card.id)} outside ${min}-${max}`);
    assert.ok(card.flavor && card.sigil && card.tone, `${card.id} missing flavor/sigil/tone`);
  }
  assert.ok(CARDS.some((c) => c.arrows.length === 1), 'some cards attack in only one direction');
  assert.ok(CARDS.some((c) => c.arrows.length === 8), 'some cards attack in every direction');
});

test('board geometry: 5×5 neighbors in eight directions, and zones', () => {
  assert.equal(CELLS, 25);
  assert.deepEqual(NEIGHBOR[0], [-1, -1, 1, 6, 5, -1, -1, -1]);
  assert.ok(NEIGHBOR[6].every((n) => n >= 0), 'an inner square has all eight neighbors');
  assert.deepEqual([ZONES.corners.length, ZONES.edges.length, ZONES.center.length, ZONES.all.length], [4, 12, 9, 25]);
  assert.deepEqual(ZONES.corners, [0, 4, 20, 24]);
  // The three zones tile the board exactly, with nothing counted twice.
  const zoned = [...ZONES.corners, ...ZONES.edges, ...ZONES.center].sort((a, b) => a - b);
  assert.deepEqual(zoned, ZONES.all);
});

test('same seed produces the same game; different seeds differ', () => {
  assert.deepEqual(createGame('abc'), createGame('abc'));
  assert.notDeepEqual(createGame('abc').dealt, createGame('xyz').dealt);
});

test('new game: 8 cards each (3 in hand), 4-8 blocked squares, tiles only on open squares', () => {
  for (const seed of ['a', 'b', 'c', 'daily-2026-09-13']) {
    const g = createGame(seed);
    for (const p of [PLAYER, OPPONENT]) {
      assert.equal(g.dealt[p].length, MATCH_CARDS);
      assert.equal(g.hands[p].length, OPENING_HAND);
      assert.deepEqual([...g.hands[p], ...g.decks[p]], g.dealt[p]);
    }
    assert.equal(new Set(g.dealt.flat()).size, MATCH_CARDS * 2);
    const blocked = g.blocked.filter(Boolean).length;
    assert.ok(blocked >= 4 && blocked <= 8, `${seed}: ${blocked} blocked`);
    assert.equal(g.tiles.filter((t) => t === 1).length, 2);
    assert.equal(g.tiles.filter((t) => t === -1).length, 2);
    assert.ok(g.tiles.every((t, i) => t === 0 || !g.blocked[i]));
    // Every card must have somewhere to go, however the stone fell.
    assert.ok(CELLS - blocked >= MATCH_CARDS * 2, `${seed}: no room for every card`);
  }
});

test('the coin toss comes from the seed and both sides win it sometimes', () => {
  const firsts = Array.from({ length: 40 }, (_, i) => createGame(`coin-${i}`).first);
  assert.ok(firsts.includes(PLAYER) && firsts.includes(OPPONENT));
});

test('deck-based game: opponent cards are unique, disjoint, and near the target power', () => {
  const playerHand = [
    'mire-leech', 'vine-thief', 'ruin-digger', 'temple-guardian', 'blind-jaguar',
    'dart-frog', 'river-priest', 'machete-bandit',
  ];
  const playerPower = playerHand.reduce((s, id) => s + cardPower(id), 0);
  for (const offset of [-8, 0, 4]) {
    for (let i = 0; i < 20; i++) {
      const g = createGame(`deck-${offset}-${i}`, { playerHand, powerOffset: offset });
      const opp = g.dealt[OPPONENT];
      assert.deepEqual(g.dealt[PLAYER], playerHand);
      assert.equal(new Set(opp).size, MATCH_CARDS);
      assert.ok(opp.every((id) => !playerHand.includes(id)));
      const diff = opp.reduce((s, id) => s + cardPower(id), 0) - (playerPower + offset);
      assert.ok(Math.abs(diff) <= 2, `offset ${offset}: off by ${diff}`);
    }
  }
});

test('field, coin toss, and draw order depend only on the seed and cards, so challenge replays match', () => {
  const original = createGame('replay', {
    playerHand: [
      'mire-leech', 'vine-thief', 'ruin-digger', 'temple-guardian', 'blind-jaguar',
      'dart-frog', 'river-priest', 'machete-bandit',
    ],
  });
  const replay = createGame('replay', { hands: original.dealt });
  assert.deepEqual(replay.blocked, original.blocked);
  assert.deepEqual(replay.tiles, original.tiles);
  assert.equal(replay.first, original.first);
  assert.deepEqual(replay.hands, original.hands);
  assert.deepEqual(replay.decks, original.decks);
});

test('playing a card draws the next one from your pile, until it runs out', () => {
  const state = makeState({ hands: [['bone-beetle', 'mire-leech'], []], decks: [['vine-thief'], []] });
  const next = applyMove(state, { handIndex: 0, cell: 0 });
  assert.deepEqual(next.hands[PLAYER], ['mire-leech', 'vine-thief']);
  assert.equal(next.lastMove.drew, 'vine-thief');
  const after = applyMove({ ...next, turn: PLAYER }, { handIndex: 0, cell: 3 });
  assert.deepEqual(after.hands[PLAYER], ['vine-thief']);
  assert.equal(after.lastMove.drew, null);
});

test('battle: when the target points back, Attack must beat Defense', () => {
  // Headhunter (Attack 10, arrow up) below a Blind Jaguar (Defense 6, arrows all four sides).
  const board = emptyBoard();
  board[MID] = at('blind-jaguar', OPPONENT);
  const won = place(board, 'headhunter', LOW);
  assert.deepEqual(won.lastMove.flipped, [MID]);
  assert.equal(won.board[MID].owner, PLAYER);

  // Firefly Guide (Attack 4) attacks up into a Temple Guardian (Defense 8) that points back.
  const wall = emptyBoard();
  wall[MID] = at('temple-guardian', OPPONENT);
  const lost = place(wall, 'firefly-guide', LOW);
  assert.deepEqual(lost.lastMove.flipped, []);
  assert.equal(lost.board[MID].owner, OPPONENT);
});

test('battle: a tie holds, and a Sunlit square on the attacker breaks it', () => {
  const rules = { stats: [{ headhunter: [6, 5] }, { 'blind-jaguar': [6, 6] }] };
  const board = () => {
    const b = emptyBoard();
    b[MID] = at('blind-jaguar', OPPONENT);
    return b;
  };
  assert.deepEqual(place(board(), 'headhunter', LOW, { rules }).lastMove.flipped, []);
  const tiles = Array(CELLS).fill(0);
  tiles[LOW] = 1;
  assert.deepEqual(place(board(), 'headhunter', LOW, { rules, tiles }).lastMove.flipped, [MID]);
});

test('an enemy that does not point back is captured for free, even with higher numbers', () => {
  // Blind Jaguar (Attack 6) points up at a Headhunter (Defense 5, but only an up arrow).
  const board = emptyBoard();
  board[MID] = at('headhunter', OPPONENT);
  const rules = { stats: [{ 'blind-jaguar': [1, 1] }, { headhunter: [10, 10] }] };
  assert.deepEqual(place(board, 'blind-jaguar', LOW, { rules }).lastMove.flipped, [MID]);
});

test('no arrow, no attack; diagonals attack too', () => {
  const board = emptyBoard();
  board[MID] = at('blind-jaguar', OPPONENT);
  // Headhunter only points up; the Jaguar is to its left.
  assert.deepEqual(place(board, 'headhunter', cell(1, 2)).lastMove.flipped, []);

  // Carrion Vulture points up-left and up-right, so it reaches the square diagonally above.
  const diagonal = emptyBoard();
  const upLeft = cell(1, 0);
  diagonal[upLeft] = at('headhunter', OPPONENT);
  assert.deepEqual(place(diagonal, 'carrion-vulture', LOW).lastMove.flipped, [upLeft]);
});

test('captured cards attack again along their own arrows', () => {
  // Jaguar takes the Headhunter for free; the captured Headhunter (Attack 10) then beats the
  // Ruin Digger above it, whose arrow points back down (Defense 5).
  const board = emptyBoard();
  board[MID] = at('headhunter', OPPONENT);
  board[TOP] = at('ruin-digger', OPPONENT);
  const next = place(board, 'blind-jaguar', LOW);
  assert.deepEqual(next.lastMove.flipped, [MID, TOP]);
  assert.deepEqual(score(next.board), [3, 0]);
});

test('every attack is logged for the animations, whether it lands or is turned aside', () => {
  // Same chain as above: the Jaguar takes the Headhunter for free, and the Headhunter then beats
  // the Ruin Digger, which does point back. Two attacks, on two links of the chain.
  const board = emptyBoard();
  board[MID] = at('headhunter', OPPONENT);
  board[TOP] = at('ruin-digger', OPPONENT);
  assert.deepEqual(place(board, 'blind-jaguar', LOW).lastMove.strikes, [
    { from: LOW, to: MID, dir: DIR_INDEX.N, round: 0, contested: false, won: true },
    { from: MID, to: TOP, dir: DIR_INDEX.N, round: 1, contested: true, won: true },
  ]);

  // An attack that the defender turns aside is still an attack, and still gets drawn.
  const wall = emptyBoard();
  wall[MID] = at('temple-guardian', OPPONENT);
  const held = place(wall, 'firefly-guide', LOW);
  assert.deepEqual(held.lastMove.flipped, []);
  assert.deepEqual(held.lastMove.strikes, [
    { from: LOW, to: MID, dir: DIR_INDEX.N, round: 0, contested: true, won: false },
  ]);

  // Arrows into empty squares, off the board, or at your own cards are not attacks.
  const alone = emptyBoard();
  alone[MID] = at('headhunter', PLAYER);
  assert.deepEqual(place(alone, 'blind-jaguar', LOW).lastMove.strikes, []);
});

test('a chain fights with the numbers frozen when the card landed, not ones that shift mid-chain', () => {
  // Temple Guardian (Blue) lands below the Poison Dart Frog, which has only a North arrow, so it
  // falls for free. The Frog wants Blue next to it, so it has Advantage and is weakening enemies.
  // It then swings North at the River Priest: Attack 7 against Defense 7, a tie, which holds.
  // The Frog changing sides must not drag the Priest's Defense down to 6 first.
  const board = emptyBoard();
  board[MID] = at('dart-frog', OPPONENT);
  board[TOP] = at('river-priest', OPPONENT);
  const next = place(board, 'temple-guardian', LOW);
  assert.deepEqual(next.lastMove.flipped, [MID], 'only the Frog falls');
  assert.equal(next.board[TOP].owner, OPPONENT);
  assert.deepEqual(score(next.board), [2, 1]);
});

test('campaign numbers belong to the side that played the card, even after a capture', () => {
  const board = emptyBoard();
  board[MID] = at('headhunter', OPPONENT);
  const rules = { stats: [{}, { headhunter: [3, 2] }] };
  const next = place(board, 'blind-jaguar', LOW, { rules });
  assert.equal(next.board[MID].owner, PLAYER);
  assert.deepEqual(slotStats(next.board[MID], next.rules), [3, 2]);
  assert.equal(statValue('sleeping-god', 0, 1, 5), 10);
  assert.equal(statValue('mist-wraith', 0, -1, -5), 1);
});

test('a side with no cards left is skipped, so the other can finish the board', () => {
  // Uproot hands a card back, so the sides do not always have the same number of plays left.
  const state = makeState({ hands: [['headhunter', 'mire-leech'], ['vine-thief']], turn: OPPONENT });
  const afterTheirs = applyMove(state, { handIndex: 0, cell: 0 });
  assert.equal(afterTheirs.turn, PLAYER);
  const afterMine = applyMove(afterTheirs, { handIndex: 0, cell: 1 });
  assert.equal(afterMine.turn, PLAYER, 'they have nothing left, so it comes back to you');
  assert.ok(legalMoves(afterMine).length > 0, 'and you have a legal move');
  const last = applyMove(afterMine, { handIndex: 0, cell: 2 });
  assert.ok(isOver(last), 'once both hands are empty the match is over');
});

test('blocked squares cannot be played', () => {
  const g = createGame('blocked-test');
  const stone = g.blocked.indexOf(true);
  assert.throws(() => applyMove(g, { handIndex: 0, cell: stone }), /blocked/);
  assert.ok(legalMoves(g).every((m) => !g.blocked[m.cell]));
});

test('applyMove does not mutate the previous state', () => {
  const board = emptyBoard();
  board[MID] = at('blind-jaguar', OPPONENT);
  const state = makeState({ board, hands: [['headhunter'], []], decks: [['vine-thief'], []] });
  applyMove(state, { handIndex: 0, cell: LOW });
  assert.equal(state.board[MID].owner, OPPONENT);
  assert.equal(state.board[LOW], null);
  assert.deepEqual(state.hands[PLAYER], ['headhunter']);
});

test('a full game ends once every card has been played', () => {
  const rand = mulberry32(42);
  let state = createGame('full-game');
  let plays = 0;
  while (!isOver(state)) {
    const moves = legalMoves(state);
    state = applyMove(state, moves[Math.floor(rand() * moves.length)]);
    plays++;
  }
  assert.equal(plays, MATCH_CARDS * 2);
  const [p, o] = score(state.board);
  assert.equal(p + o, MATCH_CARDS * 2);
  assert.ok(state.hands.every((h) => h.length === 0) && state.decks.every((d) => d.length === 0));
  assert.equal(outcome([5, 5]), 'draw');
});

test('AI always returns a legal move at every level', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    let state = createGame(`legal-${level}`);
    while (!isOver(state)) {
      const move = chooseMove(state, level, mulberry32(7));
      assert.ok(legalMoves(state).some((m) => m.handIndex === move.handIndex && m.cell === move.cell));
      state = applyMove(state, move);
    }
  }
});

test('hard AI beats easy AI most of the time and thinks fast enough', () => {
  let hardWins = 0;
  let easyWins = 0;
  let slowest = 0;
  const games = 24;
  for (let g = 0; g < games; g++) {
    let state = createGame(`strength-${g}`);
    const rand = mulberry32(g);
    while (!isOver(state)) {
      const start = performance.now();
      const move = chooseMove(state, state.turn === OPPONENT ? 'hard' : 'easy', rand);
      if (state.turn === OPPONENT) slowest = Math.max(slowest, performance.now() - start);
      state = applyMove(state, move);
    }
    const [easy, hard] = score(state.board);
    if (hard > easy) hardWins++;
    if (easy > hard) easyWins++;
  }
  assert.ok(hardWins >= easyWins * 2, `hard won ${hardWins}, easy won ${easyWins}`);
  assert.ok(slowest < 1500, `slowest hard move took ${slowest.toFixed(0)}ms`);
  console.log(`hard ${hardWins} - easy ${easyWins} (of ${games}); slowest hard move ${slowest.toFixed(0)}ms`);
});

test('hand codes round-trip and reject bad input', () => {
  const hands = [
    CARDS.slice(0, MATCH_CARDS).map((c) => c.id),
    CARDS.slice(-MATCH_CARDS).map((c) => c.id),
  ];
  assert.deepEqual(decodeHands(encodeHands(hands)), hands);
  assert.equal(decodeHands('zz'.repeat(MATCH_CARDS * 2)), null, 'no card at that index');
  assert.equal(decodeHands('00'.repeat(MATCH_CARDS * 2)), null, 'the same card many times');
  assert.equal(decodeHands('abc'), null, 'wrong length');
});

test('challenge links round-trip and reject junk', () => {
  const url = challengeUrl('https://example.com/', { seed: 'daily-2026-09-13', level: 'hard', score: 7, name: 'Mira' });
  assert.deepEqual(parseChallenge(new URL(url).search), {
    seed: 'daily-2026-09-13', level: 'hard', hands: null, rites: null, beat: 7, from: 'Mira', twists: [],
  });
  const hands = createGame('link').dealt;
  const withHands = challengeUrl('https://example.com/', { seed: 'link', level: 'easy', score: 4, hands });
  assert.deepEqual(parseChallenge(new URL(withHands).search).hands, hands);

  assert.equal(parseChallenge('?seed=<script>'), null);
  assert.equal(parseChallenge(''), null);
  assert.equal(parseChallenge('?seed=abc&h=tampered'), null);
  assert.deepEqual(parseChallenge('?seed=abc&lvl=godmode&beat=99'), {
    seed: 'abc', level: 'normal', hands: null, rites: null, beat: null, from: '', twists: [],
  });

  // Rites ride along with the hands, so a challenge is the same fight and not just the same board.
  const fight = challengeUrl('https://example.com/', {
    seed: 'link', level: 'normal', score: 9, hands: createGame('link').dealt, rites: ['uproot', 'kindle'],
  });
  assert.deepEqual(parseChallenge(new URL(fight).search).rites, ['uproot', 'kindle']);
  assert.equal(parseChallenge('?seed=abc&r=zz'), null, 'a tampered Rite code is rejected');
  assert.equal(parseChallenge('?seed=abc&r=0'), null, 'so is a truncated one');
});

test('daily numbering and date shifting', () => {
  assert.equal(dailyNumber('2026-09-13'), 1);
  assert.equal(dailyNumber('2026-10-13'), 31);
  assert.equal(shiftKey('2026-03-01', -1), '2026-02-28');
});

test('emoji grid shows ownership, blocked stone, and empty squares; share text reports draws', () => {
  const board = emptyBoard();
  board[cell(0, 0)] = at('headhunter', PLAYER);
  board[cell(1, 1)] = at('headhunter', OPPONENT);
  const blocked = Array(CELLS).fill(false);
  blocked[CELLS - 1] = true;
  assert.equal(emojiGrid(board, blocked), [
    '🟩⬜⬜⬜⬜',
    '⬜🟥⬜⬜⬜',
    '⬜⬜⬜⬜⬜',
    '⬜⬜⬜⬜⬜',
    '⬜⬜⬜⬜⬛',
  ].join('\n'));
  assert.match(buildShareText({ title: 'Daily #1', playerScore: 5, opponentScore: 5, grid: '', url: 'x' }), /Drew 5–5/);
});
