import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, applyMove, isOver, legalMoves, normalizeRules, CELLS, MATCH_CARDS, PLAYER, OPPONENT,
} from '../src/engine.js';
import { SIZE } from '../src/board.js';
import { chooseMove } from '../src/ai.js';
import { computeModifiers } from '../src/abilities.js';
import { CARDS_BY_ID } from '../src/cards.js';
import { TRAIL, TWISTS, twistRules } from '../src/trail.js';
import { ACHIEVEMENTS, checkAchievements } from '../src/achievements.js';
import { defaultProfile, sanitizeProfile, recordTrailWin, choosePack, PRICES } from '../src/profile.js';
import { STARTER_PACKS } from '../src/packs.js';
import { challengeUrl, parseChallenge } from '../src/share.js';
import { mulberry32 } from '../src/rng.js';

const emptyBoard = () => Array(CELLS).fill(null);
const cell = (row, col) => row * SIZE + col;
// Sanitizing only keeps a profile that owns cards, so start from a taken pack.
const started = (id = STARTER_PACKS[0].id) => choosePack(defaultProfile(), id).profile;

test('rules: defaults match the standard game; twists change tiles and blocked squares', () => {
  assert.deepEqual(createGame('same').tiles, createGame('same', { rules: {} }).tiles);
  assert.deepEqual(createGame('same').blocked, createGame('same', { rules: {} }).blocked);

  const shade = createGame('shade', { rules: twistRules(['deep-shade']) });
  assert.equal(shade.tiles.filter((t) => t === 1).length, 0);
  assert.equal(shade.tiles.filter((t) => t === -1).length, 5);

  // Rockslide adds more stone than the roll has room for, so it pins the board at the most
  // it can take while still leaving every card a square.
  for (let i = 0; i < 10; i++) {
    const blocked = createGame(`rock-${i}`, { rules: twistRules(['rockslide']) }).blocked.filter(Boolean).length;
    assert.ok(blocked >= 7 && blocked <= CELLS - MATCH_CARDS * 2, `Rockslide board ${i}: ${blocked} blocked`);
  }

  assert.deepEqual(normalizeRules({ sun: 99, colorBoost: { red: 1, purple: 4 } }), {
    sun: 6, shade: 2, blockedMin: 4, blockedMax: 8, extraBlocked: 0, colorBoost: { red: 1 }, stats: [{}, {}],
  });
});

test('color boosts from twists raise every card of that color', () => {
  const board = emptyBoard();
  const red = cell(1, 1);
  board[red] = { cardId: 'venom-brewer', owner: PLAYER, side: PLAYER };
  board[0] = { cardId: 'bone-beetle', owner: OPPONENT, side: OPPONENT };
  const mods = computeModifiers(board, undefined, normalizeRules(twistRules(['wildfire'])));
  assert.deepEqual([...mods.subarray(red * 2, red * 2 + 2)], [1, 1]);
  assert.deepEqual([...mods.subarray(0, 2)], [0, 0]);
});

test('AI plays legal moves under every Trail stop\'s rules', () => {
  const player = [
    'jaguar-king', 'sun-priestess', 'were-jaguar', 'blood-orchid', 'river-titan',
    'idol-wraith', 'ant-queen', 'fire-salamander',
  ];
  for (const stop of TRAIL) {
    let game = createGame(`trail-${stop.id}`, { hands: [player, stop.hand], rules: twistRules(stop.twists) });
    while (!isOver(game)) {
      const move = chooseMove(game, stop.level, mulberry32(3));
      assert.ok(legalMoves(game).some((m) => m.handIndex === move.handIndex && m.cell === move.cell));
      game = applyMove(game, move);
    }
  }
});

test('the Jungle Trail is well formed', () => {
  assert.equal(new Set(TRAIL.map((s) => s.id)).size, TRAIL.length);
  for (const stop of TRAIL) {
    assert.equal(stop.hand.length, MATCH_CARDS, stop.id);
    assert.equal(new Set(stop.hand).size, MATCH_CARDS, `${stop.id} duplicate cards`);
    assert.ok(stop.hand.every((id) => CARDS_BY_ID[id]), `${stop.id} unknown card`);
    assert.ok(stop.twists.every((id) => TWISTS[id]), `${stop.id} unknown twist`);
    assert.ok(['easy', 'normal', 'hard'].includes(stop.level));
    assert.ok(stop.reward.amber > 0 || CARDS_BY_ID[stop.reward.card], `${stop.id} reward`);
  }
  assert.deepEqual(twistRules(['rockslide', 'flood']), { extraBlocked: 3, colorBoost: { blue: 1 } });
});

test('trail wins: the next stop pays once and unlocks the one after; others pay nothing extra', () => {
  let p = defaultProfile();
  assert.equal(recordTrailWin(p, 1).rewards.trailCleared, null, "can't skip ahead");

  let rewards;
  ({ profile: p, rewards } = recordTrailWin(p, 0));
  assert.equal(p.trail, 1);
  assert.equal(rewards.amber, TRAIL[0].reward.amber);

  ({ profile: p, rewards } = recordTrailWin(p, 1));
  assert.equal(p.trail, 2);
  assert.deepEqual(rewards.cards, [TRAIL[1].reward.card]);

  const replay = recordTrailWin(p, 0);
  assert.equal(replay.profile, p);
  assert.equal(replay.rewards.amber, 0);

  const owns = { ...defaultProfile(), trail: 1, owned: [...defaultProfile().owned, TRAIL[1].reward.card] };
  const paid = recordTrailWin(owns, 1).rewards;
  assert.deepEqual(paid.cards, []);
  assert.equal(paid.amber, PRICES[CARDS_BY_ID[TRAIL[1].reward.card].rarity]);
});

test('achievements unlock once, pay amber, and survive sanitizing', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const won = { ...started(), stats: { wins: 1, losses: 0 } };
  const match = {
    won: true, mode: 'quick', level: 'hard', score: [11, 5], bestCapture: 4, maxAdvantaged: 1,
    colors: Array(MATCH_CARDS).fill('red'), beatChallenge: false,
  };
  const { profile, unlocked } = checkAchievements(won, match);
  const ids = unlocked.map((a) => a.id);
  assert.deepEqual(ids, ['first-win', 'apex', 'overgrown', 'ambush', 'true-colors']);
  assert.equal(profile.amber, won.amber + unlocked.reduce((s, a) => s + a.amber, 0));

  assert.deepEqual(checkAchievements(profile, match).unlocked, []);
  assert.deepEqual(sanitizeProfile({ ...profile, achievements: [...profile.achievements, 'made-up'] }).achievements, ids);
  assert.equal(sanitizeProfile({ ...profile, trail: 999 }).trail, TRAIL.length);
});

test('new-card highlights only keep owned, known cards', () => {
  assert.deepEqual(defaultProfile().newCards, []);
  const raw = { ...started(), newCards: ['mire-leech', 'jaguar-king', 'fake-card', 'mire-leech'] };
  assert.deepEqual(sanitizeProfile(raw).newCards, ['mire-leech']);
});

test('challenge links carry twists and ignore unknown ones', () => {
  const url = challengeUrl('https://example.com/', { seed: 's', level: 'hard', score: 5, twists: ['rockslide', 'flood'] });
  assert.deepEqual(parseChallenge(new URL(url).search).twists, ['rockslide', 'flood']);
  assert.deepEqual(parseChallenge('?seed=s&tw=rockslide.nonsense.__proto__').twists, ['rockslide']);
});
