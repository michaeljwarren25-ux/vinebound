import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CELLS, PLAYER, OPPONENT } from '../src/engine.js';
import { CARDS } from '../src/cards.js';
import { DIRS, SIZE, ZONES } from '../src/board.js';
import {
  COLORS, EFFECT_KINDS, computeModifiers, advantagedCells, wouldHaveAdvantage, describeAbility,
} from '../src/abilities.js';

const emptyBoard = () => Array(CELLS).fill(null);
const at = (cardId, owner) => ({ cardId, owner, side: owner });
const mods = (board, cell) => [...computeModifiers(board).subarray(cell * 2, cell * 2 + 2)];
// These tests are about which square sits above or beside which, not about any numbering.
const cell = (row, col) => row * SIZE + col;
const HERE = cell(1, 1);
const ABOVE = cell(0, 1);
const UP_LEFT = cell(0, 0);
const RIGHT = cell(1, 2);

test('every card has a color, a valid ability, and rules text', () => {
  const perColor = Object.fromEntries(COLORS.map((c) => [c, 0]));
  for (const card of CARDS) {
    assert.ok(COLORS.includes(card.color), `${card.id} color`);
    perColor[card.color]++;
    const { when, effect } = card.ability;
    assert.ok(COLORS.includes(when.color), `${card.id} wants a color`);
    assert.ok(when.side === 'any' || DIRS.includes(when.side), `${card.id} side`);
    assert.ok(EFFECT_KINDS.includes(effect.kind), `${card.id} effect kind`);
    assert.ok(effect.stat === undefined || effect.stat === 'atk' || effect.stat === 'def', `${card.id} stat`);
    assert.ok(Number.isInteger(effect.amount) && effect.amount >= 1 && effect.amount <= 4, `${card.id} amount`);
    if (effect.kind === 'weaken' || effect.kind === 'rally') {
      assert.ok(effect.target === 'adjacent' || ZONES[effect.target], `${card.id} target`);
    }
    const text = describeAbility(card.id);
    assert.ok(text.want && text.effect, `${card.id} text`);
  }
  for (const color of COLORS) assert.ok(perColor[color] >= 12 && perColor[color] <= 15, `${color}: ${perColor[color]} cards`);
});

test('rules text reads naturally', () => {
  assert.deepEqual(describeAbility('silent-tracker'), { want: 'A Blue card to its right', effect: '+2 to its Attack and Defense.' });
  assert.deepEqual(describeAbility('strangler-fig'), { want: 'Next to 2 or more Green cards', effect: '+3 to its Attack and Defense.' });
  assert.deepEqual(describeAbility('vine-thief'), { want: 'Next to Green cards', effect: '+1 to its Attack and Defense for each one.' });
  assert.equal(describeAbility('were-jaguar').effect, '+3 to its Attack.');
  assert.equal(describeAbility('swamp-witch').effect, 'Enemy cards in the center get −2.');
  assert.equal(describeAbility('blood-orchid').effect, 'All allied Green cards get +1.');
});

test('a card wanting a color in one direction gets Advantage only from that color there', () => {
  // Silent Tracker wants Blue to its right.
  const board = emptyBoard();
  board[5] = at('silent-tracker', PLAYER);
  assert.deepEqual(mods(board, 5), [0, 0]);
  board[6] = at('river-smuggler', OPPONENT);
  assert.deepEqual(mods(board, 5), [2, 2]);

  const open = emptyBoard();
  open[6] = at('river-smuggler', OPPONENT);
  assert.equal(wouldHaveAdvantage(open, 5, 'silent-tracker'), true);
  assert.equal(wouldHaveAdvantage(open, 2, 'silent-tracker'), false, 'blue is below square 2, not to its right');
});

test("an enemy card grants Advantage, and the effect follows the card's current owner", () => {
  // Headhunter wants Green to its right and gives enemy cards around it −2. The Green card that
  // gives it Advantage belongs to the other side, which is exactly the point: only color counts.
  const board = emptyBoard();
  board[HERE] = at('headhunter', OPPONENT);
  board[RIGHT] = at('vine-thief', PLAYER);
  assert.deepEqual(mods(board, RIGHT), [-2, -2]);
  assert.deepEqual(advantagedCells(board).map((on, i) => (on ? i : null)).filter((i) => i !== null), [HERE]);

  board[HERE] = { ...board[HERE], owner: PLAYER }; // captured: the Vine Thief is now an ally
  assert.ok(advantagedCells(board)[HERE], 'an allied card of that color grants it just the same');
  assert.deepEqual(mods(board, RIGHT), [0, 0], 'but weaken only bites enemies');
});

test('Advantage ignores ownership entirely: the same neighbour works from either side', () => {
  // Were-Jaguar wants a Red card to its right. Put one there as each side in turn.
  for (const owner of [PLAYER, OPPONENT]) {
    const board = emptyBoard();
    board[HERE] = at('were-jaguar', PLAYER);
    board[RIGHT] = at('headhunter', owner); // Headhunter is Red
    assert.ok(advantagedCells(board)[HERE], `Red neighbour owned by ${owner}`);
    assert.deepEqual(mods(board, HERE), [3, 0], `boost applies with a ${owner} neighbour`);
    assert.equal(wouldHaveAdvantage(board, HERE, 'were-jaguar'), true);
  }
  // A neighbour of the wrong color gives nothing, whoever owns it.
  for (const owner of [PLAYER, OPPONENT]) {
    const board = emptyBoard();
    board[HERE] = at('were-jaguar', PLAYER);
    board[RIGHT] = at('mist-wraith', owner); // Blue
    assert.ok(!advantagedCells(board)[HERE], `Blue neighbour owned by ${owner}`);
  }
});

test('rally by color, count requirements, partner boosts, and single-stat boosts', () => {
  // Blood Orchid wants Blue above and gives allied Green cards +1, itself included. The two
  // Green cards sit in far corners, so nothing but the rally can reach them.
  const board = emptyBoard();
  const [ally, foe] = [cell(SIZE - 1, SIZE - 1), cell(SIZE - 1, 0)];
  board[ABOVE] = at('bone-beetle', OPPONENT);
  board[HERE] = at('blood-orchid', PLAYER);
  board[ally] = at('snake-handler', PLAYER);
  board[foe] = at('dart-frog', OPPONENT);
  assert.deepEqual(mods(board, HERE), [1, 1]);
  assert.deepEqual(mods(board, ally), [1, 1]);
  assert.deepEqual(mods(board, foe), [0, 0], 'enemy Green cards are not rallied');

  // Strangler Fig needs two Green neighbors (diagonals count).
  const fig = emptyBoard();
  fig[HERE] = at('strangler-fig', PLAYER);
  fig[ABOVE] = at('mud-caiman', PLAYER);
  assert.deepEqual(mods(fig, HERE), [0, 0]);
  fig[UP_LEFT] = at('snake-handler', OPPONENT);
  assert.deepEqual(mods(fig, HERE), [3, 3]);

  // Moth Seer wants Red above and boosts that Red card.
  const moth = emptyBoard();
  moth[HERE] = at('moth-seer', PLAYER);
  moth[ABOVE] = at('headhunter', PLAYER);
  assert.deepEqual(mods(moth, ABOVE), [2, 2]);

  // Were-Jaguar wants Red to its right and boosts only its Attack.
  const were = emptyBoard();
  were[HERE] = at('were-jaguar', PLAYER);
  were[RIGHT] = at('headhunter', OPPONENT);
  assert.deepEqual(mods(were, HERE), [3, 0]);
});
