// Campaign (Jungle Trail) card progression. Pure, like profile.js.
//
// Campaign copies of cards start about a quarter weaker than their fixed Duel numbers.
// Every Trail win gives each card in the campaign deck XP; each level gained is one
// upgrade point, spent to raise the card's Attack or Defense by 1.
// Duel modes (Quick Match, Daily Duel, challenges) never use any of this.
import { CARDS_BY_ID } from './cards.js';

export const CAMPAIGN_SCALE = 0.75;
export const MAX_STAT = 10;
export const MAX_LEVEL = 7; // so a card can earn 6 upgrade points
// Total XP needed to reach level 1, 2, 3, ...
export const LEVEL_XP = [0, 50, 150, 300, 500, 750, 1050];
export const MAX_XP = LEVEL_XP[MAX_LEVEL - 1];
// XP each campaign deck card earns for a Trail win, by the stop's difficulty.
export const WIN_XP = { easy: 20, normal: 30, hard: 45 };
// Extra points on each Trail opponent card, by stop, so later stops keep pace with leveled decks.
export const STOP_BONUS = [0, 1, 1, 2, 2, 3, 4, 5];

const NO_PROGRESS = { xp: 0, spent: [0, 0] };
const sum = (list) => list.reduce((total, v) => total + v, 0);

// Scales [Attack, Defense] to 75% of their total (rounded): each is rounded down (never below 1),
// then the leftover point goes to whichever lost more.
export function baseCampaignStats(cardId) {
  const { atk, def } = CARDS_BY_ID[cardId];
  const scaled = [atk * CAMPAIGN_SCALE, def * CAMPAIGN_SCALE];
  const stats = scaled.map((v) => Math.max(1, Math.floor(v)));
  const target = Math.round(sum(scaled));
  const byRemainder = [0, 1].sort((a, b) => (scaled[b] - stats[b]) - (scaled[a] - stats[a]));
  for (let i = 0; sum(stats) < target && i < 2; i++) stats[byRemainder[i]] += 1;
  return stats;
}

export function levelFor(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= LEVEL_XP[level]) level++;
  return level;
}

export function cardProgress(profile, cardId) {
  const entry = profile.campaign.cards[cardId] ?? NO_PROGRESS;
  const level = levelFor(entry.xp);
  return {
    xp: entry.xp,
    level,
    spent: entry.spent,
    points: level - 1 - sum(entry.spent),
    levelStartXp: LEVEL_XP[level - 1],
    nextLevelXp: level < MAX_LEVEL ? LEVEL_XP[level] : null,
  };
}

export function campaignStats(profile, cardId) {
  const { spent } = profile.campaign.cards[cardId] ?? NO_PROGRESS;
  return baseCampaignStats(cardId).map((v, stat) => Math.min(MAX_STAT, v + spent[stat]));
}

export function totalPoints(profile) {
  return Object.keys(profile.campaign.cards).reduce((total, id) => total + Math.max(0, cardProgress(profile, id).points), 0);
}

// Gives every campaign deck card `amount` XP. Returns the new profile and any level-ups.
export function awardDeckXp(profile, amount) {
  const cards = { ...profile.campaign.cards };
  const levelUps = [];
  for (const id of profile.campaign.deck) {
    const before = cards[id] ?? NO_PROGRESS;
    const xp = Math.min(MAX_XP, before.xp + amount);
    cards[id] = { xp, spent: [...before.spent] };
    const level = levelFor(xp);
    if (level > levelFor(before.xp)) levelUps.push({ cardId: id, level });
  }
  return { profile: { ...profile, campaign: { ...profile.campaign, cards } }, levelUps };
}

// Spends one upgrade point on Attack (0) or Defense (1).
export function spendPoint(profile, cardId, stat) {
  if (!profile.owned.includes(cardId)) return { profile, error: "You don't own this card" };
  if (stat !== 0 && stat !== 1) return { profile, error: 'Unknown stat' };
  const progress = cardProgress(profile, cardId);
  if (progress.points <= 0) return { profile, error: 'No upgrade points' };
  if (campaignStats(profile, cardId)[stat] >= MAX_STAT) return { profile, error: 'That number is maxed' };

  const spent = [...progress.spent];
  spent[stat] += 1;
  const cards = { ...profile.campaign.cards, [cardId]: { xp: progress.xp, spent } };
  return { profile: { ...profile, campaign: { ...profile.campaign, cards } }, error: null };
}

// Numbers for a Trail opponent's hand: campaign base plus the stop's bonus, always on the lower stat.
export function trailStats(stopIndex, hand) {
  const bonus = STOP_BONUS[stopIndex] ?? 0;
  return Object.fromEntries(hand.map((id) => {
    const stats = baseCampaignStats(id);
    for (let i = 0; i < bonus; i++) {
      const low = stats[1] < stats[0] ? 1 : 0;
      if (stats[low] >= MAX_STAT) break;
      stats[low] += 1;
    }
    return [id, stats];
  }));
}

// Rebuilds stored campaign data: owned cards only, XP capped, impossible or outdated spending reset.
export function sanitizeCampaignCards(rawCards, ownedSet) {
  const cards = {};
  if (!rawCards || typeof rawCards !== 'object') return cards;
  for (const [id, entry] of Object.entries(rawCards)) {
    if (!ownedSet.has(id)) continue;
    const xp = Number.isInteger(entry?.xp) && entry.xp > 0 ? Math.min(MAX_XP, entry.xp) : 0;
    const valid = Array.isArray(entry?.spent) && entry.spent.length === 2 &&
      entry.spent.every((v) => Number.isInteger(v) && v >= 0) && sum(entry.spent) <= levelFor(xp) - 1;
    cards[id] = { xp, spent: valid ? [...entry.spent] : [0, 0] };
  }
  return cards;
}
