// Player progression: collection, deck, amber currency, daily streaks.
// All functions are pure (they return a new profile) so they are easy to test.
import { CARDS, CARDS_BY_ID, PRICES } from './cards.js';
import { hashString, mulberry32 } from './rng.js';
import { shiftKey } from './share.js';
import { TRAIL } from './trail.js';
import { ACHIEVEMENTS_BY_ID } from './achievements.js';
import { sanitizeCampaignCards } from './campaign.js';
import { PACKS_BY_ID, STARTER_PACKS, VETERAN_PACK, packCards, packMissing, packPrice } from './packs.js';
import { RITES_BY_ID, STARTER_RITES, DEFAULT_RITE, isRite, riteFor, ritePrice } from './rites.js';

export const PROFILE_KEY = 'vinebound:profile';
export const PROFILE_VERSION = 1;
export const DECK_SIZE = 14;
export const STARTING_AMBER = 100;

// Card prices live with the cards; re-exported here because this is the module that spends amber.
export { PRICES };
export const MATCH_REWARDS = {
  easy: { win: 10, loss: 3 },
  normal: { win: 20, loss: 5 },
  hard: { win: 35, loss: 8 },
};
export const DAILY_REWARDS = { win: 50, loss: 15 };
export const STREAK_MILESTONES = [
  { days: 3, rarity: 'rare' },
  { days: 7, rarity: 'epic' },
  { days: 14, rarity: 'legendary' },
  { days: 30, rarity: 'legendary' },
];
// After the last milestone, every 30 days awards another legendary.
const STREAK_REPEAT = { every: 30, rarity: 'legendary' };

// A new player owns nothing until they pick a starter pack (see choosePack).
export function defaultProfile() {
  return {
    version: PROFILE_VERSION,
    pack: null, // the starter pack they chose; null means the game hasn't started yet
    amber: STARTING_AMBER,
    owned: [],
    deck: [],
    dailyResults: {},
    streak: { last: null, count: 0 },
    stats: { wins: 0, losses: 0 },
    trail: 0, // Jungle Trail stops cleared, in order
    achievements: [],
    newCards: [], // unlocked cards the player hasn't looked at yet, highlighted in the Collection
    // Rites: the one-shot powers you own, and the one equipped to each deck (see rites.js).
    rites: [],
    rite: DEFAULT_RITE,
    campaignRite: DEFAULT_RITE,
    // Jungle Trail only: its own deck, plus XP and spent upgrade points per card (see campaign.js).
    campaign: { deck: [], cards: {} },
  };
}

export function loadProfile(storage) {
  let raw = null;
  try {
    raw = JSON.parse(storage.getItem(PROFILE_KEY));
  } catch {}
  return sanitizeProfile(raw);
}

export function saveProfile(storage, profile) {
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// Stored data is user-editable, so rebuild it from known-good pieces.
export function sanitizeProfile(raw) {
  const base = defaultProfile();
  if (!raw || typeof raw !== 'object') return base;

  const owned = uniqueKnownIds(raw.owned);
  if (owned.length === 0) return base; // nothing to keep: back to the pack picker
  const ownedSet = new Set(owned);

  const dailyResults = {};
  if (raw.dailyResults && typeof raw.dailyResults === 'object') {
    for (const [key, result] of Object.entries(raw.dailyResults)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isInteger(result?.p) && Number.isInteger(result?.o)) {
        dailyResults[key] = { p: result.p, o: result.o };
      }
    }
  }

  return {
    version: PROFILE_VERSION,
    // Profiles saved before packs existed already have cards, so they count as started.
    pack: PACKS_BY_ID[raw.pack] ? raw.pack : VETERAN_PACK,
    amber: toCount(raw.amber, base.amber),
    owned,
    deck: uniqueKnownIds(raw.deck).filter((id) => ownedSet.has(id)).slice(0, DECK_SIZE),
    dailyResults,
    streak: typeof raw.streak?.last === 'string'
      ? { last: raw.streak.last, count: toCount(raw.streak.count) }
      : base.streak,
    stats: { wins: toCount(raw.stats?.wins), losses: toCount(raw.stats?.losses) },
    trail: Math.min(toCount(raw.trail), TRAIL.length),
    achievements: Array.isArray(raw.achievements)
      ? [...new Set(raw.achievements.filter((id) => typeof id === 'string' && ACHIEVEMENTS_BY_ID[id]))]
      : [],
    newCards: uniqueKnownIds(raw.newCards).filter((id) => ownedSet.has(id)),
    ...sanitizeRites(raw),
    campaign: {
      // Profiles from before the campaign start with a copy of their Duel deck.
      deck: uniqueKnownIds(raw.campaign ? raw.campaign.deck : raw.deck).filter((id) => ownedSet.has(id)).slice(0, DECK_SIZE),
      cards: sanitizeCampaignCards(raw.campaign?.cards, ownedSet),
    },
  };
}

/**
 * Rites from stored data. The three that come with the starter packs are always yours — they are
 * the plain ones everyone learns on — so a profile can never end up with nothing equipped, and an
 * equipped Rite you don't own falls back to the one your own pack brought.
 */
function sanitizeRites(raw) {
  const free = STARTER_RITES.map((rite) => rite.id);
  const mine = riteFor(PACKS_BY_ID[raw.pack] ? raw.pack : VETERAN_PACK);
  const owned = [...new Set([...free, ...(Array.isArray(raw.rites) ? raw.rites.filter(isRite) : [])])];
  const equipped = (id) => (isRite(id) && owned.includes(id) ? id : mine);
  return { rites: owned, rite: equipped(raw.rite), campaignRite: equipped(raw.campaignRite) };
}

/** Every Rite the player hasn't unlocked yet. */
export function lockedRites(profile) {
  return Object.values(RITES_BY_ID).filter((rite) => !profile.rites.includes(rite.id));
}

export function buyRite(profile, id) {
  const rite = RITES_BY_ID[id];
  if (!rite) return { profile, error: 'Unknown Rite' };
  if (profile.rites.includes(id)) return { profile, error: 'Already yours' };
  const price = ritePrice(id);
  if (profile.amber < price) return { profile, error: 'Not enough amber' };
  return { profile: { ...profile, amber: profile.amber - price, rites: [...profile.rites, id] }, error: null };
}

/** Equips a Rite to the Duel deck, or the Campaign deck with { campaign: true }. */
export function equipRite(profile, id, { campaign = false } = {}) {
  if (!isRite(id)) return { profile, error: 'Unknown Rite' };
  if (!profile.rites.includes(id)) return { profile, error: "You haven't unlocked this Rite" };
  return { profile: { ...profile, [campaign ? 'campaignRite' : 'rite']: id }, error: null };
}

export const equippedRite = (profile, { campaign = false } = {}) =>
  (campaign ? profile.campaignRite : profile.rite);

function uniqueKnownIds(list) {
  return Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === 'string' && CARDS_BY_ID[id]))] : [];
}

function toCount(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/**
 * Applies a finished match. The first Daily Duel of a day pays the daily reward
 * and advances the streak; everything else (quick, challenge, daily practice)
 * pays by difficulty.
 */
export function recordMatch(profile, { mode, level, won, score, dailyKey = null, practice = false }) {
  const next = structuredClone(profile);
  const rewards = { amber: 0, cards: [], streakMilestone: null };
  next.stats[won ? 'wins' : 'losses'] += 1;

  const firstDailyToday = mode === 'daily' && !practice && dailyKey && !next.dailyResults[dailyKey];
  if (firstDailyToday) {
    next.dailyResults[dailyKey] = { p: score[0], o: score[1] };
    rewards.amber += won ? DAILY_REWARDS.win : DAILY_REWARDS.loss;

    const { streak } = next;
    streak.count = streak.last === shiftKey(dailyKey, -1) ? streak.count + 1 : 1;
    streak.last = dailyKey;
    const milestone = milestoneAt(streak.count);
    if (milestone) {
      rewards.streakMilestone = milestone;
      grantRandomCard(next, rewards, milestone.rarity, `${dailyKey}:${streak.count}`);
    }
  } else {
    const table = MATCH_REWARDS[level] ?? MATCH_REWARDS.normal;
    rewards.amber += won ? table.win : table.loss;
  }

  next.amber += rewards.amber;
  return { profile: next, rewards };
}

function milestoneAt(count) {
  const exact = STREAK_MILESTONES.find((m) => m.days === count);
  if (exact) return exact;
  const last = STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
  if (count > last.days && count % STREAK_REPEAT.every === 0) return { days: count, rarity: STREAK_REPEAT.rarity };
  return null;
}

export function nextMilestone(count) {
  const upcoming = STREAK_MILESTONES.find((m) => m.days > count);
  if (upcoming) return upcoming;
  return { days: (Math.floor(count / STREAK_REPEAT.every) + 1) * STREAK_REPEAT.every, rarity: STREAK_REPEAT.rarity };
}

/**
 * Clearing the next Jungle Trail stop for the first time unlocks the one after it and
 * pays its reward. A reward card the player already owns pays its amber price instead.
 * Replays of cleared stops only earn the normal match amber (see recordMatch).
 */
export function recordTrailWin(profile, index) {
  const rewards = { amber: 0, cards: [], trailCleared: null };
  const stop = TRAIL[index];
  if (!stop || index !== profile.trail) return { profile, rewards };

  const next = structuredClone(profile);
  next.trail += 1;
  rewards.trailCleared = stop.id;
  if (stop.reward.amber) rewards.amber += stop.reward.amber;
  if (stop.reward.card) {
    if (next.owned.includes(stop.reward.card)) {
      rewards.amber += PRICES[CARDS_BY_ID[stop.reward.card].rarity];
    } else {
      next.owned.push(stop.reward.card);
      rewards.cards.push(stop.reward.card);
    }
  }
  next.amber += rewards.amber;
  return { profile: next, rewards };
}

// Grants an unowned card of the rarity, or its amber value if the player has them all.
function grantRandomCard(profile, rewards, rarity, seedKey) {
  const candidates = CARDS.filter((c) => c.rarity === rarity && !profile.owned.includes(c.id));
  if (candidates.length === 0) {
    rewards.amber += PRICES[rarity];
    return;
  }
  const pick = candidates[Math.floor(mulberry32(hashString(seedKey))() * candidates.length)];
  profile.owned.push(pick.id);
  rewards.cards.push(pick.id);
}

export function currentStreak(profile, todayKey) {
  const { last, count } = profile.streak;
  return last === todayKey || last === shiftKey(todayKey, -1) ? count : 0;
}

/** Has the player picked a starter pack yet? Everything else waits on this. */
export const hasStarted = (profile) => Boolean(profile.pack);

/**
 * The opening choice: take a starter pack. It grants every card in the pack and sets both
 * decks to the first DECK_SIZE of them, so the player can play immediately.
 */
export function choosePack(profile, id) {
  const pack = PACKS_BY_ID[id];
  if (!pack || !pack.starter) return { profile, error: 'Unknown starter pack' };
  if (hasStarted(profile)) return { profile, error: 'You already have a pack' };
  const cards = packCards(id);
  const deck = cards.slice(0, DECK_SIZE);
  // The three plain Rites come with any starter pack; the one matching its temperament is equipped.
  const rite = riteFor(id);
  return {
    profile: {
      ...profile,
      pack: id,
      owned: [...new Set([...profile.owned, ...cards])],
      deck: [...deck],
      rites: [...new Set([...profile.rites, ...STARTER_RITES.map((r) => r.id)])],
      rite,
      campaignRite: rite,
      campaign: { ...profile.campaign, deck: [...deck] },
    },
    error: null,
  };
}

/**
 * Buys a themed pack: you only pay for the cards you're missing, at a discount.
 * Returns the cards actually added, for the unlock reveal.
 */
export function buyPack(profile, id) {
  const pack = PACKS_BY_ID[id];
  if (!pack) return { profile, cards: [], error: 'Unknown pack' };
  const missing = packMissing(id, profile.owned);
  if (missing.length === 0) return { profile, cards: [], error: 'You own every card in this pack' };
  const price = packPrice(id, profile.owned);
  if (profile.amber < price) return { profile, cards: [], error: 'Not enough amber' };
  return {
    profile: { ...profile, amber: profile.amber - price, owned: [...profile.owned, ...missing] },
    cards: missing,
    error: null,
  };
}

export function buyCard(profile, id) {
  const card = CARDS_BY_ID[id];
  if (!card) return { profile, error: 'Unknown card' };
  if (profile.owned.includes(id)) return { profile, error: 'Already owned' };
  const price = PRICES[card.rarity];
  if (profile.amber < price) return { profile, error: 'Not enough amber' };
  return {
    profile: { ...profile, amber: profile.amber - price, owned: [...profile.owned, id] },
    error: null,
  };
}

// The Duel deck by default; pass { campaign: true } for the Jungle Trail deck.
const deckOf = (profile, campaign) => (campaign ? profile.campaign.deck : profile.deck);
const withDeck = (profile, deck, campaign) =>
  (campaign ? { ...profile, campaign: { ...profile.campaign, deck } } : { ...profile, deck });

export function toggleDeckCard(profile, id, { campaign = false } = {}) {
  const deck = deckOf(profile, campaign);
  if (deck.includes(id)) return { profile: withDeck(profile, deck.filter((d) => d !== id), campaign), error: null };
  if (!profile.owned.includes(id)) return { profile, error: "You don't own this card" };
  if (deck.length >= DECK_SIZE) return { profile, error: 'Deck is full' };
  return { profile: withDeck(profile, [...deck, id], campaign), error: null };
}

export function isDeckReady(profile, { campaign = false } = {}) {
  return deckOf(profile, campaign).length === DECK_SIZE;
}
