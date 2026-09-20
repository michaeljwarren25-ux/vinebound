// Deck packs: themed bundles of cards.
//
// Starter packs are the choice the game opens on — pick one and it hands you a full playable
// deck plus spares. The rest are bought with amber in the Collection, and only ever
// charge for the cards you don't already own (at a discount on buying them one by one).
//
// A pack's first DECK_SIZE cards are the deck it sets up; anything after that is a spare to
// swap in. Every card in the roster belongs to at least one pack.
import { CARDS_BY_ID, PRICES } from './cards.js';

// Buying a themed pack is cheaper than buying its cards one at a time.
export const PACK_DISCOUNT = 0.75;

export const PACKS = [
  // ---- Starter packs: one dominant color, plus the splash its abilities want next to them.
  {
    id: 'overgrowth',
    name: 'Overgrowth',
    color: 'green',
    tagline: 'The green things that swallow everything else',
    about: 'Cards that grow into one another. Most of them want green company, so keep them touching, ' +
      'and let the smuggler and the firefly cover the colors the rest are thirsty for.',
    starter: true,
    cards: [
      'vine-thief', 'mire-leech', 'snake-handler', 'mud-caiman', 'dart-frog',
      'silent-tracker', 'firefly-guide', 'river-smuggler', 'strangler-fig', 'canopy-oracle',
      'howler-monkey', 'swamp-witch', 'ash-shaman', 'moth-seer',
      'bone-beetle', 'carrion-vulture',
    ],
  },
  {
    id: 'blackwater',
    name: 'Blackwater',
    color: 'blue',
    tagline: 'The river, and everything it kept',
    about: 'Patient, heavy defenses out of the drowned ruins. A few red raiders ride along, because ' +
      'half this pack only wakes up with red beside it.',
    starter: true,
    cards: [
      'bone-beetle', 'ruin-digger', 'river-smuggler', 'drowned-explorer', 'mist-wraith',
      'carrion-vulture', 'machete-bandit', 'temple-guardian', 'river-priest', 'rusted-conquistador',
      'firefly-guide', 'mud-caiman', 'ash-shaman', 'moth-seer',
      'vine-thief', 'snake-handler',
    ],
  },
  {
    id: 'emberfall',
    name: 'Emberfall',
    color: 'red',
    tagline: 'Fire, ash, and the people who hunt by it',
    about: 'The aggressive pack: big Attack numbers and abilities that shrink whatever stands next ' +
      'to them. The green cards are bait — every red card here is hungry for one.',
    starter: true,
    cards: [
      'firefly-guide', 'ash-shaman', 'machete-bandit', 'carrion-vulture', 'mire-leech',
      'vine-thief', 'drowned-explorer', 'blind-jaguar', 'headhunter', 'bone-drummer',
      'howler-monkey', 'snake-handler', 'venom-brewer', 'mud-caiman',
      'mist-wraith', 'silent-tracker',
    ],
  },

  // ---- Bought with amber. Smaller, rarer, built around one legend or one idea.
  {
    id: 'lost-city',
    name: 'The Lost City',
    color: 'blue',
    tagline: 'Stone that remembers being worshipped',
    about: 'Diggers, guardians, and the thing under the temple that everything else was built to ' +
      'keep asleep.',
    cards: ['bone-beetle', 'ruin-digger', 'temple-guardian', 'rusted-conquistador', 'idol-wraith', 'sleeping-god'],
  },
  {
    id: 'deep-venom',
    name: 'Deep Venom',
    color: 'green',
    tagline: 'Small things with eight legs and worse ideas',
    about: 'Nothing here hits hard on its own. Together they cover the whole board with arrows and ' +
      'bleed the numbers out of everything near them.',
    cards: ['dart-frog', 'venom-brewer', 'moth-seer', 'ant-queen', 'goliath-spider', 'blood-orchid'],
  },
  {
    id: 'floodtide',
    name: 'Floodtide',
    color: 'blue',
    tagline: 'The water rises, and it is not empty',
    about: 'Storm and river: wide arrow spreads and abilities that weaken whole edges of the board.',
    cards: ['mist-wraith', 'drowned-explorer', 'river-priest', 'storm-serpent', 'river-titan'],
  },
  {
    id: 'canopy-crown',
    name: 'Canopy Crown',
    color: 'green',
    tagline: 'Everything under the trees answers to something',
    about: 'The green court, up to and including the king himself, who makes every card you own ' +
      'a little braver.',
    cards: ['silent-tracker', 'howler-monkey', 'strangler-fig', 'canopy-oracle', 'were-jaguar', 'jaguar-king'],
  },
  {
    id: 'sun-and-ash',
    name: 'Sun and Ash',
    color: 'red',
    tagline: 'A burned city and the woman who burned it',
    about: 'The heaviest red cards in the jungle. Expensive, and worth it once the warlord and the ' +
      'priestess are on the board together.',
    cards: ['ash-shaman', 'sun-cultist', 'jungle-warlord', 'fire-salamander', 'sun-priestess'],
  },
];

export const PACKS_BY_ID = Object.fromEntries(PACKS.map((pack) => [pack.id, pack]));
export const STARTER_PACKS = PACKS.filter((pack) => pack.starter);

// Profiles from before packs existed. Never offered, only recorded, so the picker stays closed.
export const VETERAN_PACK = 'veteran';

export const packCards = (id) => [...(PACKS_BY_ID[id]?.cards ?? [])];

/** What a pack costs right now: only the cards you're missing, discounted. 0 once you own it all. */
export function packPrice(id, owned = []) {
  const pack = PACKS_BY_ID[id];
  if (!pack) return 0;
  const have = new Set(owned);
  const missing = pack.cards.filter((cardId) => !have.has(cardId));
  const full = missing.reduce((sum, cardId) => sum + PRICES[CARDS_BY_ID[cardId].rarity], 0);
  return Math.round((full * PACK_DISCOUNT) / 10) * 10;
}

/** The cards in the pack the player doesn't own yet. */
export function packMissing(id, owned = []) {
  const have = new Set(owned);
  return packCards(id).filter((cardId) => !have.has(cardId));
}

/** "9 Common · 3 Rare", strongest first. */
export function packRarities(id) {
  const counts = {};
  for (const cardId of packCards(id)) {
    const { rarity } = CARDS_BY_ID[cardId];
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }
  return counts;
}
