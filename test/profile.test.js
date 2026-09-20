import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, CARDS_BY_ID } from '../src/cards.js';
import {
  defaultProfile, sanitizeProfile, loadProfile, saveProfile, recordMatch, buyCard, toggleDeckCard,
  isDeckReady, currentStreak, nextMilestone, choosePack, buyPack, hasStarted, DECK_SIZE, PRICES,
  DAILY_REWARDS, MATCH_REWARDS, STARTING_AMBER,
} from '../src/profile.js';
import { PACKS, STARTER_PACKS, VETERAN_PACK, packCards, packPrice, packMissing } from '../src/packs.js';

// A profile part-way through the opening: pack taken, nothing played yet.
const started = (id = STARTER_PACKS[0].id) => choosePack(defaultProfile(), id).profile;

const quick = (level, won) => ({ mode: 'quick', level, won, score: won ? [5, 4] : [4, 5] });
const daily = (dailyKey, won = true) => ({ mode: 'daily', level: 'normal', won, score: won ? [6, 3] : [3, 6], dailyKey });

test('a new profile owns nothing until a starter pack is picked', () => {
  const p = defaultProfile();
  assert.equal(p.amber, STARTING_AMBER);
  assert.equal(p.pack, null);
  assert.ok(!hasStarted(p));
  assert.deepEqual(p.owned, []);
  assert.deepEqual(p.deck, []);
  assert.deepEqual(p.campaign.deck, []);
  assert.ok(!isDeckReady(p));
});

test('every starter pack hands over a full, playable deck', () => {
  for (const pack of STARTER_PACKS) {
    const p = started(pack.id);
    assert.equal(p.pack, pack.id);
    assert.ok(hasStarted(p));
    assert.deepEqual(p.owned, pack.cards);
    assert.equal(p.deck.length, DECK_SIZE);
    assert.equal(new Set(p.deck).size, DECK_SIZE);
    assert.ok(p.deck.every((id) => p.owned.includes(id)));
    assert.deepEqual(p.campaign.deck, p.deck);
    assert.ok(isDeckReady(p) && isDeckReady(p, { campaign: true }));
    assert.equal(p.amber, STARTING_AMBER, 'the pack itself is free');
  }
});

test('packs are well formed, and between them cover the whole roster', () => {
  const covered = new Set();
  for (const pack of PACKS) {
    assert.ok(pack.cards.every((id) => CARDS_BY_ID[id]), `${pack.id} has an unknown card`);
    assert.equal(new Set(pack.cards).size, pack.cards.length, `${pack.id} repeats a card`);
    assert.ok(pack.cards.length >= (pack.starter ? DECK_SIZE : 1), `${pack.id} is too small`);
    for (const id of pack.cards) covered.add(id);
  }
  assert.equal(covered.size, CARDS.length, 'every card should come in some pack');
  assert.equal(STARTER_PACKS.length, 3);
});

test('starter packs are close to each other in power', () => {
  const power = (pack) => pack.cards.slice(0, DECK_SIZE)
    .reduce((sum, id) => sum + CARDS_BY_ID[id].atk + CARDS_BY_ID[id].def + CARDS_BY_ID[id].arrows.length, 0);
  const totals = STARTER_PACKS.map(power);
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 10, `starter decks drift too far apart: ${totals}`);
});

test('a pack can only be chosen once, and only from the starters', () => {
  const p = started();
  assert.equal(choosePack(p, STARTER_PACKS[1].id).error, 'You already have a pack');
  assert.equal(choosePack(defaultProfile(), 'lost-city').error, 'Unknown starter pack');
  assert.equal(choosePack(defaultProfile(), 'nope').error, 'Unknown starter pack');
});

test('buying a pack charges only for the missing cards, at a discount', () => {
  const full = packCards('lost-city').reduce((sum, id) => sum + PRICES[CARDS_BY_ID[id].rarity], 0);
  const price = packPrice('lost-city');
  assert.ok(price < full * 0.8 && price > full * 0.7, `${price} should be about a quarter off ${full}`);

  // A starter pack may already cover part of this one, so the bill is only for what's missing.
  const base = started();
  const owed = packPrice('lost-city', base.owned);
  const p = { ...base, amber: owed };
  const bought = buyPack(p, 'lost-city');
  assert.equal(bought.error, null);
  assert.equal(bought.profile.amber, 0);
  assert.deepEqual(bought.cards, packMissing('lost-city', base.owned));
  assert.ok(packCards('lost-city').every((id) => bought.profile.owned.includes(id)));

  // Cards you already own drop out of the price and out of the reveal.
  const partial = { ...started(), owned: [...started().owned, 'sleeping-god'], amber: 10000 };
  const second = buyPack(partial, 'lost-city');
  assert.ok(!second.cards.includes('sleeping-god'));
  assert.equal(10000 - second.profile.amber, packPrice('lost-city', partial.owned));
  assert.equal(new Set(second.profile.owned).size, second.profile.owned.length);

  assert.equal(buyPack(second.profile, 'lost-city').error, 'You own every card in this pack');
  assert.equal(packPrice('lost-city', second.profile.owned), 0);
  assert.deepEqual(packMissing('lost-city', second.profile.owned), []);
  assert.equal(buyPack({ ...started(), amber: 0 }, 'lost-city').error, 'Not enough amber');
  assert.equal(buyPack(started(), 'nope').error, 'Unknown pack');
});

test('profiles from before packs existed keep their cards and skip the picker', () => {
  const old = sanitizeProfile({ owned: ['bone-beetle', 'mire-leech'], deck: ['bone-beetle'] });
  assert.equal(old.pack, VETERAN_PACK);
  assert.ok(hasStarted(old));
  assert.equal(sanitizeProfile({ owned: ['bone-beetle'], pack: 'made-up' }).pack, VETERAN_PACK);
  assert.equal(sanitizeProfile({ owned: ['bone-beetle'], pack: 'emberfall' }).pack, 'emberfall');
});

test('sanitizeProfile rebuilds bad or tampered data', () => {
  assert.deepEqual(sanitizeProfile(null), defaultProfile());
  assert.deepEqual(sanitizeProfile('nope'), defaultProfile());
  assert.deepEqual(sanitizeProfile({ owned: [] }), defaultProfile());

  const cleaned = sanitizeProfile({
    amber: -50,
    owned: ['bone-beetle', 'fake-card', 'bone-beetle', 'mire-leech'],
    deck: ['bone-beetle', 'jaguar-king', 'fake-card'],
    dailyResults: { '2026-09-13': { p: 6, o: 3 }, junk: { p: 1, o: 1 }, '2026-09-14': { p: 'x' } },
    streak: { last: '2026-09-13', count: 2 },
  });
  assert.equal(cleaned.amber, STARTING_AMBER);
  assert.deepEqual(cleaned.owned, ['bone-beetle', 'mire-leech']);
  assert.deepEqual(cleaned.deck, ['bone-beetle']); // unowned legendary removed
  assert.deepEqual(cleaned.dailyResults, { '2026-09-13': { p: 6, o: 3 } });
  assert.deepEqual(cleaned.streak, { last: '2026-09-13', count: 2 });
});

test('profiles survive a save/load round trip, and broken JSON falls back to default', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const { profile } = recordMatch(started(), quick('hard', true));
  saveProfile(storage, profile);
  assert.deepEqual(loadProfile(storage), profile);

  store.set('vinebound:profile', '{not json');
  assert.deepEqual(loadProfile(storage), defaultProfile());
});

test('quick matches pay by difficulty and track stats', () => {
  let p = defaultProfile();
  ({ profile: p } = recordMatch(p, quick('hard', true)));
  ({ profile: p } = recordMatch(p, quick('normal', false)));
  assert.equal(p.amber, STARTING_AMBER + MATCH_REWARDS.hard.win + MATCH_REWARDS.normal.loss);
  assert.deepEqual(p.stats, { wins: 1, losses: 1 });
});

test('recordMatch does not mutate the input profile', () => {
  const p = defaultProfile();
  recordMatch(p, daily('2026-09-13'));
  assert.deepEqual(p, defaultProfile());
});

test('first daily of the day pays the daily reward; replays pay like normal matches', () => {
  let p = defaultProfile();
  let rewards;
  ({ profile: p, rewards } = recordMatch(p, daily('2026-09-13', true)));
  assert.equal(rewards.amber, DAILY_REWARDS.win);
  assert.deepEqual(p.dailyResults['2026-09-13'], { p: 6, o: 3 });

  ({ profile: p, rewards } = recordMatch(p, daily('2026-09-13', true)));
  assert.equal(rewards.amber, MATCH_REWARDS.normal.win);
  assert.deepEqual(p.streak, { last: '2026-09-13', count: 1 });
});

test('streak grows on consecutive days, resets after a gap, and grants a rare card at 3 days', () => {
  let p = started();
  let rewards;
  ({ profile: p } = recordMatch(p, daily('2026-09-13')));
  ({ profile: p } = recordMatch(p, daily('2026-09-14', false)));
  ({ profile: p, rewards } = recordMatch(p, daily('2026-09-15')));

  assert.equal(p.streak.count, 3);
  assert.deepEqual(rewards.streakMilestone, { days: 3, rarity: 'rare' });
  assert.equal(rewards.cards.length, 1);
  const unlocked = CARDS_BY_ID[rewards.cards[0]];
  assert.equal(unlocked.rarity, 'rare');
  assert.ok(p.owned.includes(unlocked.id));
  assert.ok(!started().owned.includes(unlocked.id), 'must unlock a card the player did not own');

  assert.equal(currentStreak(p, '2026-09-16'), 3); // still alive the next day
  assert.equal(currentStreak(p, '2026-09-17'), 0); // missed a day

  ({ profile: p } = recordMatch(p, daily('2026-09-20')));
  assert.equal(p.streak.count, 1);
});

test('streak reward pays amber instead when every card of that rarity is owned', () => {
  const p = { ...defaultProfile(), owned: CARDS.map((c) => c.id), streak: { last: '2026-09-14', count: 2 } };
  const { rewards } = recordMatch(p, daily('2026-09-15'));
  assert.deepEqual(rewards.cards, []);
  assert.equal(rewards.amber, DAILY_REWARDS.win + PRICES.rare);
});

test('next milestone lookup', () => {
  assert.deepEqual(nextMilestone(0), { days: 3, rarity: 'rare' });
  assert.deepEqual(nextMilestone(3), { days: 7, rarity: 'epic' });
  assert.deepEqual(nextMilestone(14), { days: 30, rarity: 'legendary' });
  assert.deepEqual(nextMilestone(30), { days: 60, rarity: 'legendary' });
});

test('buying cards costs amber and respects balance and ownership', () => {
  const p = { ...defaultProfile(), amber: 120 };
  const bought = buyCard(p, 'venom-brewer');
  assert.equal(bought.error, null);
  assert.equal(bought.profile.amber, 120 - PRICES.rare);
  assert.ok(bought.profile.owned.includes('venom-brewer'));

  assert.equal(buyCard(bought.profile, 'venom-brewer').error, 'Already owned');
  assert.equal(buyCard(bought.profile, 'jaguar-king').error, 'Not enough amber');
  assert.equal(buyCard(p, 'nope').error, 'Unknown card');
});

test('deck editing: remove, add, full deck, and unowned cards', () => {
  const p = started('overgrowth'); // a full deck, plus the cards past it as spares
  const spare = packCards('overgrowth')[DECK_SIZE]; // owned, but not in the deck
  const full = toggleDeckCard(p, spare);
  assert.equal(full.error, 'Deck is full');

  const removed = toggleDeckCard(p, 'mire-leech').profile;
  assert.equal(removed.deck.length, DECK_SIZE - 1);
  assert.ok(!isDeckReady(removed));

  const added = toggleDeckCard(removed, spare).profile;
  assert.ok(added.deck.includes(spare));
  assert.ok(isDeckReady(added));

  assert.equal(toggleDeckCard(removed, 'jaguar-king').error, "You don't own this card");
});
