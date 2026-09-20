// Achievements: long-term goals that each pay amber once. Pure, like profile.js.
//
// `check` gets the profile (after the match is recorded) and, right after a match,
// facts about it: { won, mode, level, score, bestCapture, maxAdvantaged, colors, beatChallenge }.
import { CARDS } from './cards.js';
import { MATCH_CARDS } from './engine.js';
import { TRAIL } from './trail.js';
import { levelFor, MAX_LEVEL } from './campaign.js';

const campaignCards = (profile) => Object.values(profile.campaign?.cards ?? {});

export const ACHIEVEMENTS = [
  { id: 'first-win', name: 'First Blood', text: 'Win a match.', amber: 25,
    check: ({ profile }) => profile.stats.wins >= 1 },
  { id: 'seasoned', name: 'Seasoned', text: 'Win 10 matches.', amber: 60,
    check: ({ profile }) => profile.stats.wins >= 10 },
  { id: 'veteran', name: 'Jungle Veteran', text: 'Win 50 matches.', amber: 200,
    check: ({ profile }) => profile.stats.wins >= 50 },
  { id: 'apex', name: 'Apex Predator', text: 'Win on Hard.', amber: 60,
    check: ({ match }) => Boolean(match?.won && match.level === 'hard') },
  { id: 'overgrown', name: 'Overgrown', text: 'Win holding 11 or more squares.', amber: 50,
    check: ({ match }) => Boolean(match?.won && match.score[0] >= 11) },
  { id: 'ambush', name: 'Ambush', text: 'Capture 4 or more cards with a single play.', amber: 40,
    check: ({ match }) => (match?.bestCapture ?? 0) >= 4 },
  { id: 'symbiosis', name: 'Symbiosis', text: 'Have 3 of your cards with Advantage at the same time.', amber: 40,
    check: ({ match }) => (match?.maxAdvantaged ?? 0) >= 3 },
  { id: 'true-colors', name: 'True Colors', text: 'Win with every card you brought the same color.', amber: 60,
    check: ({ match }) =>
      Boolean(match?.won && match.colors?.length === MATCH_CARDS && new Set(match.colors).size === 1) },
  { id: 'called-out', name: 'Called Out', text: "Beat a friend's challenge score.", amber: 40,
    check: ({ match }) => Boolean(match?.beatChallenge) },
  { id: 'devoted', name: 'Devoted', text: 'Reach a 7-day Daily Duel streak.', amber: 100,
    check: ({ profile }) => profile.streak.count >= 7 },
  { id: 'collector', name: 'Collector', text: 'Own 20 cards.', amber: 80,
    check: ({ profile }) => profile.owned.length >= 20 },
  { id: 'keeper', name: 'Keeper of the Jungle', text: 'Own every card.', amber: 500,
    check: ({ profile }) => profile.owned.length >= CARDS.length },
  { id: 'pathfinder', name: 'Pathfinder', text: 'Clear 4 stops on the Jungle Trail.', amber: 80,
    check: ({ profile }) => profile.trail >= 4 },
  { id: 'trailblazer', name: 'Trailblazer', text: 'Clear the whole Jungle Trail.', amber: 300,
    check: ({ profile }) => profile.trail >= TRAIL.length },
  { id: 'tempered', name: 'Tempered', text: 'Raise a campaign card to level 4.', amber: 60,
    check: ({ profile }) => campaignCards(profile).some((c) => levelFor(c.xp) >= 4) },
  { id: 'masterwork', name: 'Masterwork', text: 'Bring a campaign card to max level and spend all its points.', amber: 150,
    check: ({ profile }) => campaignCards(profile).some((c) =>
      levelFor(c.xp) === MAX_LEVEL && c.spent.reduce((s, v) => s + v, 0) === MAX_LEVEL - 1) },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Unlocks every newly met achievement and pays its amber. Returns the unlocked achievements.
export function checkAchievements(profile, match = null) {
  const have = new Set(profile.achievements);
  const unlocked = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check({ profile, match }));
  if (unlocked.length === 0) return { profile, unlocked };
  return {
    profile: {
      ...profile,
      achievements: [...profile.achievements, ...unlocked.map((a) => a.id)],
      amber: profile.amber + unlocked.reduce((sum, a) => sum + a.amber, 0),
    },
    unlocked,
  };
}
