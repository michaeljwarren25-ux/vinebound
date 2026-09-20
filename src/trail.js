// The Jungle Trail: a fixed run of opponents, each with their own hand and a twist on the rules.
// Clearing a stop unlocks the next one and pays its reward once.

export const TWISTS = {
  wildfire: {
    name: 'Wildfire',
    text: 'Red cards get +1 to every number.',
    rules: { colorBoost: { red: 1 } },
  },
  overgrowth: {
    name: 'Overgrowth',
    text: 'Green cards get +1 to every number.',
    rules: { colorBoost: { green: 1 } },
  },
  flood: {
    name: 'Flood',
    text: 'Blue cards get +1 to every number.',
    rules: { colorBoost: { blue: 1 } },
  },
  'deep-shade': {
    name: 'Deep Shade',
    text: 'No Sunlit squares, and five squares of Undergrowth.',
    rules: { sun: 0, shade: 5 },
  },
  rockslide: {
    name: 'Rockslide',
    text: 'Fallen stone blocks three extra squares.',
    rules: { extraBlocked: 3 },
  },
};

// Combines twists into one rules object for createGame.
export function twistRules(ids = []) {
  let rules = {};
  for (const id of ids) {
    const twist = TWISTS[id];
    if (!twist) continue;
    rules = { ...rules, ...twist.rules, colorBoost: { ...rules.colorBoost, ...twist.rules.colorBoost } };
  }
  return rules;
}

export const TRAIL = [
  {
    id: 'drowned-crossing', place: 'The Drowned Crossing', foe: 'River Smuggler', level: 'easy', twists: [],
    hand: [
      'river-smuggler', 'drowned-explorer', 'mist-wraith', 'bone-beetle',
      'ruin-digger', 'mud-caiman', 'carrion-vulture', 'vine-thief',
    ],
    reward: { amber: 60 },
  },
  {
    id: 'firefly-hollow', place: 'Firefly Hollow', foe: 'Firefly Guide', level: 'easy', twists: ['wildfire'],
    hand: [
      'firefly-guide', 'ash-shaman', 'machete-bandit', 'carrion-vulture',
      'blind-jaguar', 'mire-leech', 'snake-handler', 'venom-brewer',
    ],
    reward: { card: 'sun-cultist' },
  },
  {
    id: 'the-mire', place: 'The Mire', foe: 'Swamp Witch', level: 'normal', twists: ['deep-shade'],
    hand: [
      'mire-leech', 'snake-handler', 'mud-caiman', 'dart-frog',
      'swamp-witch', 'moth-seer', 'venom-brewer', 'howler-monkey',
    ],
    reward: { amber: 100 },
  },
  {
    id: 'canopy-road', place: 'Canopy Road', foe: 'Canopy Oracle', level: 'normal', twists: ['overgrowth'],
    hand: [
      'vine-thief', 'silent-tracker', 'howler-monkey', 'canopy-oracle',
      'strangler-fig', 'were-jaguar', 'mire-leech', 'dart-frog',
    ],
    reward: { card: 'blood-orchid' },
  },
  {
    id: 'temple-steps', place: 'The Temple Steps', foe: 'Temple Guardian', level: 'normal', twists: ['rockslide'],
    hand: [
      'temple-guardian', 'rusted-conquistador', 'bone-drummer', 'idol-wraith',
      'headhunter', 'bone-beetle', 'ruin-digger', 'carrion-vulture',
    ],
    reward: { amber: 150 },
  },
  {
    id: 'storm-delta', place: 'The Storm Delta', foe: 'Storm Serpent', level: 'hard', twists: ['flood'],
    hand: [
      'storm-serpent', 'river-priest', 'moth-seer', 'goliath-spider',
      'mist-wraith', 'drowned-explorer', 'rusted-conquistador', 'temple-guardian',
    ],
    reward: { card: 'goliath-spider' },
  },
  {
    id: 'warlords-camp', place: "The Warlord's Camp", foe: 'Jungle Warlord', level: 'hard', twists: ['rockslide'],
    hand: [
      'jungle-warlord', 'fire-salamander', 'ant-queen', 'sun-cultist',
      'headhunter', 'blind-jaguar', 'machete-bandit', 'bone-drummer',
    ],
    reward: { amber: 200 },
  },
  {
    id: 'sleeping-temple', place: 'The Sleeping Temple', foe: 'The Sleeping God', level: 'normal', twists: ['rockslide', 'flood'],
    hand: [
      'sleeping-god', 'river-priest', 'idol-wraith', 'storm-serpent',
      'moth-seer', 'river-titan', 'temple-guardian', 'goliath-spider',
    ],
    reward: { card: 'sleeping-god' },
  },
];
