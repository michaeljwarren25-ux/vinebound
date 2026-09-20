import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS } from '../src/cards.js';
import {
  baseCampaignStats, campaignStats, cardProgress, levelFor, awardDeckXp, spendPoint, trailStats, totalPoints,
  LEVEL_XP, MAX_LEVEL, MAX_XP, STOP_BONUS,
} from '../src/campaign.js';
import {
  defaultProfile, sanitizeProfile, toggleDeckCard, isDeckReady, choosePack, DECK_SIZE,
} from '../src/profile.js';
import { STARTER_PACKS } from '../src/packs.js';
import { TRAIL } from '../src/trail.js';

// A profile that has taken a starter pack, so both decks are full.
const started = (id = STARTER_PACKS[0].id) => choosePack(defaultProfile(), id).profile;

const sum = (list) => list.reduce((s, v) => s + v, 0);

test('campaign cards start about a quarter weaker than their Duel numbers, never below 1', () => {
  for (const card of CARDS) {
    const base = baseCampaignStats(card.id);
    assert.ok(base[0] >= 1 && base[0] <= card.atk && base[1] >= 1 && base[1] <= card.def, card.id);
    const ratio = sum(base) / (card.atk + card.def);
    assert.ok(ratio > 0.6 && ratio < 0.86, `${card.id} ratio ${ratio.toFixed(2)}`);
  }
});

test('levels follow the XP table and stop at the max', () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(LEVEL_XP[1] - 1), 1);
  assert.equal(levelFor(LEVEL_XP[1]), 2);
  assert.equal(levelFor(MAX_XP + 5000), MAX_LEVEL);
});

test('a win gives XP to every campaign deck card, and reports level-ups', () => {
  const start = started('blackwater'); // its deck has no Bone Beetle to spare
  assert.ok(!start.campaign.deck.includes('howler-monkey'));
  const { profile, levelUps } = awardDeckXp(start, LEVEL_XP[1]);
  assert.equal(levelUps.length, start.campaign.deck.length);
  for (const id of start.campaign.deck) assert.equal(cardProgress(profile, id).level, 2);
  assert.equal(profile.campaign.cards['howler-monkey'], undefined, 'cards outside the deck get nothing');
  assert.deepEqual(start.campaign.cards, {}, 'input profile untouched');
  assert.deepEqual(awardDeckXp(profile, 10).levelUps, []);
  assert.equal(awardDeckXp(profile, 999999).profile.campaign.cards[start.campaign.deck[0]].xp, MAX_XP);
});

test('upgrade points raise Attack or Defense by 1, need points, and stop at 10', () => {
  let p = started();
  const id = p.campaign.deck[0];
  assert.equal(spendPoint(p, id, 0).error, 'No upgrade points');

  ({ profile: p } = awardDeckXp(p, LEVEL_XP[2])); // level 3: two points each
  const before = campaignStats(p, id);
  const spent = spendPoint(p, id, 1);
  assert.equal(spent.error, null);
  p = spent.profile;
  assert.equal(campaignStats(p, id)[1], before[1] + 1);
  assert.equal(cardProgress(p, id).points, 1);
  assert.equal(totalPoints(p), p.campaign.deck.length * 2 - 1);
  assert.equal(spendPoint(p, 'jaguar-king', 0).error, "You don't own this card");
  assert.equal(spendPoint(p, id, 2).error, 'Unknown stat');

  // The Sleeping God starts at Attack 8 in the campaign: two points max it out.
  let god = { ...started(), owned: [...started().owned, 'sleeping-god'] };
  god = { ...god, campaign: { ...god.campaign, cards: { 'sleeping-god': { xp: MAX_XP, spent: [0, 0] } } } };
  assert.equal(campaignStats(god, 'sleeping-god')[0], 8);
  for (let i = 0; i < 2; i++) god = spendPoint(god, 'sleeping-god', 0).profile;
  assert.equal(campaignStats(god, 'sleeping-god')[0], 10);
  assert.equal(spendPoint(god, 'sleeping-god', 0).error, 'That number is maxed');
});

test('Trail opponents get more bonus points at later stops', () => {
  const hand = TRAIL[0].hand;
  assert.deepEqual(trailStats(0, hand), Object.fromEntries(hand.map((id) => [id, baseCampaignStats(id)])));
  const last = TRAIL.length - 1;
  for (const id of TRAIL[last].hand) {
    assert.equal(sum(trailStats(last, TRAIL[last].hand)[id]), sum(baseCampaignStats(id)) + STOP_BONUS[last]);
  }
});

test('the campaign deck is separate from the Duel deck', () => {
  const p = started();
  const removed = toggleDeckCard(p, p.campaign.deck[0], { campaign: true }).profile;
  assert.equal(removed.campaign.deck.length, DECK_SIZE - 1);
  assert.equal(removed.deck.length, DECK_SIZE);
  assert.ok(isDeckReady(removed));
  assert.ok(!isDeckReady(removed, { campaign: true }));
});

test('sanitize: old profiles copy their Duel deck; bad or outdated campaign data is repaired', () => {
  const old = sanitizeProfile({ owned: [...started().owned, 'bone-beetle'], deck: ['bone-beetle', 'mire-leech'] });
  assert.deepEqual(old.campaign, { deck: ['bone-beetle', 'mire-leech'], cards: {} });

  const tampered = sanitizeProfile({
    ...started(),
    campaign: {
      deck: ['mire-leech', 'fake-card', 'jaguar-king'],
      cards: {
        'mire-leech': { xp: 60, spent: [5, 0] }, // level 2 can't have spent 5
        'vine-thief': { xp: 10 ** 9, spent: [2, 1] },
        'snake-handler': { xp: 200, spent: [1, 0, 0, 0] }, // four-number upgrades from the old rules
        'jaguar-king': { xp: 50, spent: [0, 0] }, // not owned
      },
    },
  });
  assert.deepEqual(tampered.campaign.deck, ['mire-leech']);
  assert.deepEqual(tampered.campaign.cards, {
    'mire-leech': { xp: 60, spent: [0, 0] },
    'vine-thief': { xp: MAX_XP, spent: [2, 1] },
    'snake-handler': { xp: 200, spent: [0, 0] },
  });
});
