import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyMove, isOver, legalMoves, score, statValue, slotStats, CELLS, PLAYER, OPPONENT, MATCH_CARDS, ATK, DEF } from '../src/engine.js';
import { chooseMove, chooseRite } from '../src/ai.js';
import { CARDS_BY_ID } from '../src/cards.js';
import {
  RITES, RITES_BY_ID, RITE_INDEX, STARTER_RITES, DEFAULT_RITE, RITE_TARGETS,
  riteTargets, canUseRite, riteReady, useRite, riteFor, isRite,
} from '../src/rites.js';
import { defaultProfile, sanitizeProfile, choosePack, buyRite, equipRite, lockedRites, equippedRite } from '../src/profile.js';
import { STARTER_PACKS } from '../src/packs.js';
import { mulberry32 } from '../src/rng.js';

const started = (id = STARTER_PACKS[0].id) => choosePack(defaultProfile(), id).profile;
// A game where the player holds a known Rite, so each one can be exercised on demand.
const gameWith = (rite, seed = 'rite-test') => createGame(seed, { rites: [rite, 'kindle'] });

test('the Rite catalogue is well formed and every starter pack brings one', () => {
  assert.equal(new Set(RITES.map((r) => r.id)).size, RITES.length);
  for (const rite of RITES) {
    assert.ok(RITE_TARGETS.includes(rite.target), `${rite.id} target`);
    assert.ok(rite.name && rite.text && rite.flavor, `${rite.id} copy`);
    assert.ok(Number.isInteger(rite.price) && rite.price >= 0, `${rite.id} price`);
    assert.equal(rite.price === 0, Boolean(rite.pack), `${rite.id}: free exactly when it comes with a pack`);
    assert.equal(RITES[RITE_INDEX[rite.id]].id, rite.id, `${rite.id} index`);
  }
  // One per starter pack, so whichever you pick you start with something to use.
  assert.equal(STARTER_RITES.length, STARTER_PACKS.length);
  for (const pack of STARTER_PACKS) assert.ok(isRite(riteFor(pack.id)), `${pack.id} has a Rite`);
  assert.ok(RITES.some((r) => r.price > 0), 'some Rites are unlocks');
});

test('a new game gives both sides a Rite, and the same seed gives the same one', () => {
  const g = createGame('seeded', { rites: ['uproot', null] });
  assert.equal(g.rites[PLAYER], 'uproot');
  assert.ok(isRite(g.rites[OPPONENT]), 'the opponent is dealt one from the seed');
  assert.deepEqual(g.ritesUsed, [false, false]);
  assert.equal(createGame('seeded').rites[OPPONENT], g.rites[OPPONENT], 'same seed, same opponent Rite');
  // Over many seeds the opponent should not always draw the same one.
  const drawn = new Set(Array.from({ length: 40 }, (_, i) => createGame(`r-${i}`).rites[OPPONENT]));
  assert.ok(drawn.size > 1, 'the opponent Rite varies by seed');
  // An unknown id falls back rather than breaking the match.
  assert.equal(createGame('x', { rites: ['not-a-rite', null] }).rites[PLAYER], DEFAULT_RITE);
});

test('a Rite can only be used once, and only on a legal target', () => {
  const g = gameWith('kindle');
  assert.ok(riteReady(g, PLAYER));
  const after = useRite(g, PLAYER, null);
  assert.deepEqual(after.ritesUsed, [true, false]);
  assert.equal(riteReady(after, PLAYER), false);
  assert.throws(() => useRite(after, PLAYER, null), /No Rite left/);
  assert.deepEqual(riteTargets(after, PLAYER), []);

  // The opponent's is untouched by the player spending theirs.
  assert.ok(riteReady(after, OPPONENT));

  const rockfall = gameWith('rockfall');
  const stone = rockfall.blocked.indexOf(true);
  assert.throws(() => useRite(rockfall, PLAYER, stone), /cannot be used/);
});

test('Kindle and Thicket raise every card that side brought, on top of campaign numbers', () => {
  const g = gameWith('kindle');
  const mine = g.dealt[PLAYER];
  const kindled = useRite(g, PLAYER, null);
  for (const id of mine) {
    const card = CARDS_BY_ID[id];
    assert.deepEqual(slotStats({ side: PLAYER, cardId: id }, kindled.rules),
      [Math.min(10, card.atk + 1), card.def], id);
  }
  // The opponent's cards are untouched.
  assert.equal(slotStats({ side: OPPONENT, cardId: g.dealt[OPPONENT][0] }, kindled.rules), null);

  // On a campaign card it builds on the scaled numbers rather than the printed ones.
  const scaled = createGame('camp', { rites: ['thicket', 'kindle'], rules: { stats: [{ headhunter: [3, 2] }, {}] } });
  const thick = useRite(scaled, PLAYER, null);
  if (scaled.dealt[PLAYER].includes('headhunter')) {
    assert.deepEqual(thick.rules.stats[PLAYER].headhunter, [3, 3]);
  }
  // A 10 cannot be pushed past the cap.
  const capped = createGame('cap', { rites: ['kindle', 'kindle'], rules: { stats: [{ headhunter: [10, 4] }, {}] } });
  const hot = useRite(capped, PLAYER, null);
  if (capped.dealt[PLAYER].includes('headhunter')) assert.deepEqual(hot.rules.stats[PLAYER].headhunter, [10, 4]);
});

test('Stow buries a card under the pile and draws the next; Second Look puts it back on top', () => {
  const g = gameWith('stow');
  const held = g.hands[PLAYER][0];
  const next = g.decks[PLAYER][0];
  const stowed = useRite(g, PLAYER, 0);
  assert.equal(stowed.hands[PLAYER][0], next, 'you draw the next card');
  assert.equal(stowed.decks[PLAYER].at(-1), held, 'the stowed card goes under the pile');
  assert.equal(stowed.decks[PLAYER].length, g.decks[PLAYER].length, 'the pile is the same size');
  assert.deepEqual([...stowed.hands[PLAYER], ...stowed.decks[PLAYER]].sort(),
    [...g.hands[PLAYER], ...g.decks[PLAYER]].sort(), 'no card is lost or gained');

  const look = useRite(gameWith('second-look'), PLAYER, 0);
  const start = gameWith('second-look');
  assert.equal(look.hands[PLAYER][0], start.decks[PLAYER][0]);
  assert.equal(look.decks[PLAYER][0], start.hands[PLAYER][0], 'the swapped card is the next one you draw');
});

test('Forage draws an extra card, and cannot be used with an empty pile', () => {
  const g = gameWith('forage');
  const drawn = useRite(g, PLAYER, null);
  assert.equal(drawn.hands[PLAYER].length, g.hands[PLAYER].length + 1);
  assert.equal(drawn.decks[PLAYER].length, g.decks[PLAYER].length - 1);
  assert.equal(drawn.hands[PLAYER].at(-1), g.decks[PLAYER][0]);

  const empty = { ...g, decks: [[], g.decks[OPPONENT]] };
  assert.deepEqual(riteTargets(empty, PLAYER), [], 'nothing left to draw');
  assert.equal(canUseRite(empty, PLAYER), false);
  // The hand Rites need the pile too, since they trade against it.
  assert.deepEqual(riteTargets({ ...gameWith('stow'), decks: [[], []] }, PLAYER), []);
});

test('Sunbreak, Smother and Rockfall reshape a square; Rockfall buries whatever was there', () => {
  const g = gameWith('sunbreak');
  const open = riteTargets(g, PLAYER)[0];
  assert.equal(useRite(g, PLAYER, open).tiles[open], 1);
  assert.equal(useRite(gameWith('smother'), PLAYER, riteTargets(gameWith('smother'), PLAYER)[0]).tiles[
    riteTargets(gameWith('smother'), PLAYER)[0]], -1);

  const rock = gameWith('rockfall');
  const sunlit = rock.tiles.findIndex((t, i) => t === 1 && !rock.blocked[i] && !rock.board[i]);
  const buried = useRite(rock, PLAYER, sunlit);
  assert.equal(buried.blocked[sunlit], true);
  assert.equal(buried.tiles[sunlit], 0, 'stone covers the sunlight too');
  assert.ok(legalMoves(buried).every((m) => m.cell !== sunlit), 'and nothing can be played there');
});

test('Clearing opens a blocked square for both sides', () => {
  const g = gameWith('clearing');
  const stone = riteTargets(g, PLAYER)[0];
  assert.ok(g.blocked[stone]);
  const opened = useRite(g, PLAYER, stone);
  assert.equal(opened.blocked[stone], false);
  assert.ok(legalMoves(opened).some((m) => m.cell === stone));
  // Only stone is a legal target.
  assert.ok(riteTargets(g, PLAYER).every((cell) => g.blocked[cell]));
});

test('Uproot lifts back a card you played, and only one of those', () => {
  let g = gameWith('uproot');
  g = applyMove({ ...g, turn: PLAYER }, { handIndex: 0, cell: legalMoves({ ...g, turn: PLAYER })[0].cell });
  const cell = g.lastMove.cell;
  const cardId = g.lastMove.cardId;
  const before = score(g.board);

  const mine = { ...g, turn: PLAYER };
  assert.deepEqual(riteTargets(mine, PLAYER), [cell]);
  const lifted = useRite(mine, PLAYER, cell);
  assert.equal(lifted.board[cell], null, 'the square is open again');
  assert.ok(lifted.hands[PLAYER].includes(cardId), 'and the card is back in hand');
  assert.equal(score(lifted.board)[PLAYER], before[PLAYER] - 1, 'so you are a card down until you replay it');

  // A card you captured was never yours to pull up.
  const captured = { ...mine, board: mine.board.map((s, i) => (i === cell ? { ...s, side: OPPONENT } : s)) };
  assert.deepEqual(riteTargets(captured, PLAYER), []);
});

test('using a Rite does not cost you your turn, and a move clears the banner', () => {
  const g = gameWith('kindle');
  const after = useRite(g, PLAYER, null);
  assert.equal(after.turn, g.turn, 'still your turn');
  assert.deepEqual(after.hands, g.hands, 'and you still hold every card');
  assert.equal(after.lastRite.rite, 'kindle');
  const played = applyMove({ ...after, turn: PLAYER }, legalMoves({ ...after, turn: PLAYER })[0]);
  assert.equal(played.lastRite, null, 'the banner belongs to the turn it was used on');
});

test('useRite never mutates the state it is given', () => {
  for (const id of RITES.map((r) => r.id)) {
    let g = gameWith(id);
    // Uproot needs something on the board first.
    if (RITES_BY_ID[id].target === 'placed') {
      g = { ...applyMove({ ...g, turn: PLAYER }, legalMoves({ ...g, turn: PLAYER })[0]), turn: PLAYER };
    }
    const targets = riteTargets(g, PLAYER);
    assert.ok(targets.length > 0, `${id} has a legal target on a fresh board`);
    const snapshot = structuredClone({ ...g, rules: g.rules });
    useRite(g, PLAYER, targets[0]);
    assert.deepEqual(structuredClone({ ...g, rules: g.rules }), snapshot, `${id} mutated the state`);
  }
});

test('every Rite leaves a playable game that still ends properly', () => {
  for (const id of RITES.map((r) => r.id)) {
    let g = createGame(`play-${id}`, { rites: [id, id] });
    const rand = mulberry32(7);
    let usedPlayer = false;
    let plays = 0;
    while (!isOver(g)) {
      if (!usedPlayer && g.turn === PLAYER) {
        const targets = riteTargets(g, PLAYER);
        if (targets.length) {
          g = useRite(g, PLAYER, targets[Math.floor(rand() * targets.length)]);
          usedPlayer = true;
          continue;
        }
      }
      const moves = legalMoves(g);
      if (moves.length === 0) break;
      g = applyMove(g, moves[Math.floor(rand() * moves.length)]);
      plays++;
    }
    assert.ok(isOver(g), `${id}: the match reached an end`);
    const [p, o] = score(g.board);
    assert.ok(p + o <= MATCH_CARDS * 2, `${id}: no card was conjured up`);
    assert.ok(plays > 0, `${id}: cards were played`);
  }
});

test('the AI considers its Rite, spends it at most once, and always picks a legal target', () => {
  for (const id of RITES.map((r) => r.id)) {
    let g = createGame(`ai-${id}`, { rites: ['kindle', id] });
    let spent = 0;
    while (!isOver(g)) {
      if (g.turn === OPPONENT && riteReady(g, OPPONENT)) {
        const pick = chooseRite(g, 'normal');
        if (pick) {
          assert.ok(riteTargets(g, OPPONENT).some((t) => t === pick.target), `${id}: legal target`);
          g = useRite(g, OPPONENT, pick.target);
          spent++;
        }
      }
      const move = chooseMove(g, g.turn === OPPONENT ? 'normal' : 'easy');
      assert.ok(legalMoves(g).some((m) => m.handIndex === move.handIndex && m.cell === move.cell), `${id}: legal move`);
      g = applyMove(g, move);
    }
    assert.ok(spent <= 1, `${id}: spent ${spent} times`);
  }
});

test('profiles: a starter pack brings the plain Rites, and others are bought and equipped', () => {
  const fresh = defaultProfile();
  assert.deepEqual(fresh.rites, [], 'nothing until a pack is picked');

  const p = started('overgrowth');
  const free = riteFor('overgrowth');
  // All three plain Rites come with any pack; the one matching its temperament is the one equipped.
  assert.deepEqual([...p.rites].sort(), STARTER_RITES.map((r) => r.id).sort());
  assert.equal(equippedRite(p), free);
  assert.equal(equippedRite(p, { campaign: true }), free);
  assert.ok(lockedRites(p).every((r) => r.price > 0), 'only paid Rites are left locked');
  assert.equal(lockedRites(p).length, RITES.length - STARTER_RITES.length);

  assert.equal(equipRite(p, 'uproot').error, "You haven't unlocked this Rite");
  assert.equal(buyRite({ ...p, amber: 0 }, 'uproot').error, 'Not enough amber');
  assert.equal(buyRite(p, 'nope').error, 'Unknown Rite');

  const rich = { ...p, amber: 5000 };
  const { profile: bought, error } = buyRite(rich, 'uproot');
  assert.equal(error, null);
  assert.equal(bought.amber, 5000 - RITES_BY_ID.uproot.price);
  assert.ok(bought.rites.includes('uproot'));
  assert.equal(buyRite(bought, 'uproot').error, 'Already yours');
  assert.ok(!lockedRites(bought).some((r) => r.id === 'uproot'));
  assert.equal(buyRite(rich, 'kindle').error, 'Already yours', 'the plain ones are never for sale');

  const equipped = equipRite(bought, 'uproot').profile;
  assert.equal(equippedRite(equipped), 'uproot');
  assert.equal(equippedRite(equipped, { campaign: true }), free, 'the two decks equip separately');
  assert.equal(equipRite(bought, 'uproot', { campaign: true }).profile.campaignRite, 'uproot');
});

test("sanitize: the plain Rites are always kept, and junk falls back to the one your pack brought", () => {
  const p = started('emberfall');
  const free = riteFor('emberfall');
  const plain = STARTER_RITES.map((r) => r.id);
  const tampered = sanitizeProfile({ ...p, rites: ['uproot', 'made-up', 7], rite: 'uproot', campaignRite: 'nonsense' });
  assert.deepEqual([...tampered.rites].sort(), [...plain, 'uproot'].sort(), 'known Rites kept, plain ones never lost');
  assert.equal(tampered.rite, 'uproot');
  assert.equal(tampered.campaignRite, free, "an unknown equip falls back to the one your pack brought");

  const notOwned = sanitizeProfile({ ...p, rites: [], rite: 'uproot' });
  assert.equal(notOwned.rite, free, 'you cannot equip what you do not own');

  // Profiles saved before Rites existed still end up with one.
  const old = sanitizeProfile({ owned: p.owned, deck: p.deck, pack: 'emberfall' });
  assert.ok(isRite(old.rite) && old.rites.includes(old.rite));
});
