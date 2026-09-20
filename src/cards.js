// Every card has Attack and Defense (1-10) and 1-8 arrows: the directions it attacks in.
// Fewer arrows isn't weaker, it's a different job: a 1-arrow card hits hard in one direction,
// an 8-arrow card covers everything with smaller numbers.
// Power budget (Attack + Defense + arrow count): common 12-13, rare 15-17, epic 18-20, legendary 21-24.
// ORDER MATTERS: challenge links encode cards by index, so only ever append new cards.
//
// Each card is Green, Red, or Blue and has an Advantage ability (rules in abilities.js):
// `when` is the color it wants next to it, `effect` is what happens while that's true.
// `sigil` and `tone` drive the placeholder art for cards without artwork in art/cards/.
import { arrowMask } from './board.js';

export const RARITIES = ['common', 'rare', 'epic', 'legendary'];

// What a card costs in the Collection. Amber is earned by playing; it can never be bought.
export const PRICES = { common: 40, rare: 100, epic: 250, legendary: 600 };

// Advantage conditions: a color in one direction, or anywhere around the card (optionally several).
// The neighbour's owner never matters: an enemy card of the right color counts.
const want = (color, side = 'any', count = 1) => ({ color, side, count });

// Effects change Attack and Defense, or only the one named.
const boost = (amount, stat) => ({ kind: 'boost', amount, ...(stat && { stat }) });
const boostEach = (amount) => ({ kind: 'boost', amount, perSource: true });
const weaken = (amount, target = 'adjacent') => ({ kind: 'weaken', amount, target });
const rally = (amount, target) => ({ kind: 'rally', amount, target });
const rallyColor = (amount, color) => ({ kind: 'rally', amount, target: 'all', color });
const partner = (amount) => ({ kind: 'partner', amount });

const ALL = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const CROSS = ['N', 'E', 'S', 'W'];
const DIAGONALS = ['NE', 'SE', 'SW', 'NW'];

export const CARDS = [
  // Common
  { id: 'bone-beetle', name: 'Bone Beetle', rarity: 'common', color: 'blue', sigil: '☠', tone: 'ruin',
    atk: 4, def: 4, arrows: DIAGONALS,
    ability: { when: want('blue', 'N'), effect: boost(2) },
    flavor: 'It picks the temple steps clean, one visitor at a time.' },
  { id: 'firefly-guide', name: 'Firefly Guide', rarity: 'common', color: 'red', sigil: '✦', tone: 'ember',
    atk: 4, def: 5, arrows: ['NW', 'N', 'NE'],
    ability: { when: want('green', 'W'), effect: boost(2) },
    flavor: 'Follow the lights. They do know the way, just not to anywhere you want to go.' },
  { id: 'mire-leech', name: 'Mire Leech', rarity: 'common', color: 'green', sigil: 'ᛉ', tone: 'mire',
    atk: 5, def: 5, arrows: ['S', 'SW'],
    ability: { when: want('red'), effect: boost(2, 'atk') },
    flavor: 'Patient. Thirsty. Everywhere.' },
  { id: 'vine-thief', name: 'Vine Thief', rarity: 'common', color: 'green', sigil: '❧', tone: 'canopy',
    atk: 5, def: 4, arrows: ['NE', 'E', 'SE'],
    ability: { when: want('green'), effect: boostEach(1) },
    flavor: 'Takes whatever glitters and vanishes into the green.' },
  { id: 'ruin-digger', name: 'Ruin Digger', rarity: 'common', color: 'blue', sigil: '⚒', tone: 'ruin',
    atk: 7, def: 5, arrows: ['S'],
    ability: { when: want('blue'), effect: boostEach(1) },
    flavor: 'Digs for gold. Finds bones. Keeps digging.' },
  { id: 'carrion-vulture', name: 'Carrion Vulture', rarity: 'common', color: 'red', sigil: '✥', tone: 'ruin',
    atk: 6, def: 4, arrows: ['NW', 'NE'],
    ability: { when: want('red'), effect: weaken(1, 'corners') },
    flavor: 'It starts circling long before anything dies.' },
  { id: 'river-smuggler', name: 'River Smuggler', rarity: 'common', color: 'blue', sigil: '≋', tone: 'river',
    atk: 5, def: 5, arrows: ['W', 'E'],
    ability: { when: want('red', 'W'), effect: boost(3, 'def') },
    flavor: 'Moves cargo nobody asks about, on water nobody drinks.' },
  { id: 'ash-shaman', name: 'Ash Shaman', rarity: 'common', color: 'red', sigil: '♨', tone: 'ember',
    atk: 4, def: 5, arrows: ['SW', 'S', 'SE'],
    ability: { when: want('green'), effect: boostEach(1) },
    flavor: 'Reads the future in the smoke of burning leaves.' },
  { id: 'drowned-explorer', name: 'Drowned Explorer', rarity: 'common', color: 'blue', sigil: '⚓', tone: 'river',
    atk: 5, def: 4, arrows: ['SW', 'S', 'SE'],
    ability: { when: want('red', 'S'), effect: boost(2) },
    flavor: 'His map ended at the rapids. So did he.' },
  { id: 'snake-handler', name: 'Snake Handler', rarity: 'common', color: 'green', sigil: '⚕', tone: 'mire',
    atk: 6, def: 4, arrows: ['N', 'NE'],
    ability: { when: want('green', 'N'), effect: boost(2) },
    flavor: 'Bitten eleven times. Either immune or already dead.' },
  { id: 'dart-frog', name: 'Poison Dart Frog', rarity: 'common', color: 'green', sigil: '✿', tone: 'venom',
    atk: 7, def: 4, arrows: ['N'],
    ability: { when: want('blue'), effect: weaken(1) },
    flavor: 'Bright colors mean stay away.' },
  { id: 'silent-tracker', name: 'Silent Tracker', rarity: 'common', color: 'green', sigil: '☾', tone: 'canopy',
    atk: 8, def: 3, arrows: ['E'],
    ability: { when: want('blue', 'E'), effect: boost(2) },
    flavor: "You won't hear him coming. That's the point." },
  { id: 'machete-bandit', name: 'Machete Bandit', rarity: 'common', color: 'red', sigil: '⚔', tone: 'ember',
    atk: 8, def: 4, arrows: ['E'],
    ability: { when: want('red', 'W'), effect: weaken(1) },
    flavor: 'Clears a path through the jungle, and through travelers.' },
  { id: 'howler-monkey', name: 'Howler Monkey', rarity: 'common', color: 'green', sigil: 'ᚦ', tone: 'canopy',
    atk: 3, def: 5, arrows: CROSS,
    ability: { when: want('green'), effect: weaken(1) },
    flavor: 'Now the whole jungle knows you are here.' },
  { id: 'mist-wraith', name: 'Mist Wraith', rarity: 'common', color: 'blue', sigil: '☁', tone: 'river',
    atk: 3, def: 4, arrows: ['W', 'NW', 'N', 'NE', 'E'],
    ability: { when: want('blue', 'E'), effect: weaken(1) },
    flavor: 'It rises from the river at dusk, looking for the lost.' },
  { id: 'mud-caiman', name: 'Mud Caiman', rarity: 'common', color: 'green', sigil: 'ᛝ', tone: 'mire',
    atk: 5, def: 6, arrows: ['W', 'E'],
    ability: { when: want('blue', 'S'), effect: boost(2) },
    flavor: "Just a log. Until it isn't." },

  // Rare
  { id: 'venom-brewer', name: 'Venom Brewer', rarity: 'rare', color: 'red', sigil: '⚗', tone: 'venom',
    atk: 7, def: 5, arrows: ['NE', 'E', 'SE'],
    ability: { when: want('green'), effect: weaken(1, 'edges') },
    flavor: 'Every cure has a price. Most have a side effect.' },
  { id: 'temple-guardian', name: 'Temple Guardian', rarity: 'rare', color: 'blue', sigil: '⌬', tone: 'ruin',
    atk: 5, def: 8, arrows: CROSS,
    ability: { when: want('red'), effect: rally(1, 'edges') },
    flavor: 'Carved from stone. Woken by trespassers.' },
  { id: 'canopy-oracle', name: 'Canopy Oracle', rarity: 'rare', color: 'green', sigil: '☉', tone: 'canopy',
    atk: 6, def: 6, arrows: ['SW', 'S', 'SE'],
    ability: { when: want('green', 'W'), effect: rally(1, 'corners') },
    flavor: 'She hangs in the treetops and sees everything below.' },
  { id: 'rusted-conquistador', name: 'Rusted Conquistador', rarity: 'rare', color: 'blue', sigil: '✠', tone: 'ruin',
    atk: 8, def: 6, arrows: ['E', 'SE'],
    ability: { when: want('red', 'E'), effect: boost(2) },
    flavor: 'He came for gold. He stayed forever.' },
  { id: 'bone-drummer', name: 'Bone Drummer', rarity: 'rare', color: 'red', sigil: '❂', tone: 'ember',
    atk: 5, def: 5, arrows: ['W', 'NW', 'N', 'NE', 'E', 'S'],
    ability: { when: want('red'), effect: rallyColor(1, 'red') },
    flavor: 'The beat carries for miles. So do the screams.' },
  { id: 'swamp-witch', name: 'Swamp Witch', rarity: 'rare', color: 'green', sigil: '⛧', tone: 'mire',
    atk: 5, def: 6, arrows: DIAGONALS,
    ability: { when: want('blue'), effect: weaken(2, 'center') },
    flavor: 'Ask her for anything. She will ask for something back.' },
  { id: 'strangler-fig', name: 'Strangler Fig', rarity: 'rare', color: 'green', sigil: '❦', tone: 'canopy',
    atk: 6, def: 9, arrows: ['N', 'S'],
    ability: { when: want('green', 'any', 2), effect: boost(3) },
    flavor: 'It grows around a tree for a century, until only the fig remains.' },
  { id: 'blind-jaguar', name: 'Blind Jaguar', rarity: 'rare', color: 'red', sigil: '✹', tone: 'ember',
    atk: 6, def: 6, arrows: CROSS,
    ability: { when: want('green', 'S'), effect: boost(2) },
    flavor: 'Hunts by scent, by sound, and by the fear in your breath.' },
  { id: 'sun-cultist', name: 'Sun Cultist', rarity: 'rare', color: 'red', sigil: '☀', tone: 'ember',
    atk: 8, def: 7, arrows: ['N', 'S'],
    ability: { when: want('red', 'S'), effect: rally(2, 'center') },
    flavor: 'Offers hearts to a sun that never answers.' },
  { id: 'river-priest', name: 'River Priest', rarity: 'rare', color: 'blue', sigil: '♆', tone: 'river',
    atk: 5, def: 7, arrows: ['SW', 'S', 'SE'],
    ability: { when: want('blue'), effect: rallyColor(1, 'blue') },
    flavor: 'Gives the river one boat a month, to keep the peace.' },
  { id: 'moth-seer', name: 'Moth Seer', rarity: 'rare', color: 'blue', sigil: '☥', tone: 'venom',
    atk: 5, def: 5, arrows: ['W', 'NW', 'N', 'NE', 'E'],
    ability: { when: want('red', 'N'), effect: partner(2) },
    flavor: 'A thousand wings whisper what the fire will do next.' },
  { id: 'headhunter', name: 'Headhunter', rarity: 'rare', color: 'red', sigil: '⚱', tone: 'ember',
    atk: 10, def: 5, arrows: ['N'],
    ability: { when: want('green', 'E'), effect: weaken(2) },
    flavor: 'He collects trophies. Yours would do nicely.' },

  // Epic
  { id: 'were-jaguar', name: 'Were-Jaguar', rarity: 'epic', color: 'green', sigil: '☽', tone: 'canopy',
    atk: 7, def: 6, arrows: ['W', 'NW', 'N', 'NE', 'E'],
    ability: { when: want('red', 'E'), effect: boost(3, 'atk') },
    flavor: 'By day, a village elder. Under the full moon, the reason for the curfew.' },
  { id: 'storm-serpent', name: 'Storm Serpent', rarity: 'epic', color: 'blue', sigil: 'ᛊ', tone: 'river',
    atk: 8, def: 6, arrows: ['N', 'E', 'SE', 'S', 'W'],
    ability: { when: want('blue', 'any', 2), effect: weaken(2) },
    flavor: 'Its coils churn the monsoon.' },
  { id: 'ant-queen', name: 'Army Ant Queen', rarity: 'epic', color: 'red', sigil: '⁂', tone: 'venom',
    atk: 5, def: 6, arrows: ALL,
    ability: { when: want('red'), effect: boostEach(2) },
    flavor: 'Her colony strips a jaguar to the bone in an hour.' },
  { id: 'jungle-warlord', name: 'Jungle Warlord', rarity: 'epic', color: 'red', sigil: '♜', tone: 'ember',
    atk: 7, def: 7, arrows: ['W', 'NW', 'N', 'NE', 'E', 'S'],
    ability: { when: want('red', 'any', 2), effect: weaken(2) },
    flavor: 'He rules every village from here to the river, by fear alone.' },
  { id: 'fire-salamander', name: 'Fire Salamander', rarity: 'epic', color: 'red', sigil: 'ᛞ', tone: 'ember',
    atk: 9, def: 7, arrows: ['W', 'SW', 'S'],
    ability: { when: want('green', 'W'), effect: boost(3, 'atk') },
    flavor: 'Smaller than a dragon. Angrier, too.' },
  { id: 'goliath-spider', name: 'Goliath Spider', rarity: 'epic', color: 'blue', sigil: '☩', tone: 'venom',
    atk: 5, def: 6, arrows: ALL,
    ability: { when: want('red', 'W'), effect: boost(3, 'def') },
    flavor: 'Its web catches birds, and the people who come looking for them.' },
  { id: 'idol-wraith', name: 'Idol Wraith', rarity: 'epic', color: 'blue', sigil: '⚜', tone: 'ruin',
    atk: 8, def: 8, arrows: DIAGONALS,
    ability: { when: want('red'), effect: rally(2, 'corners') },
    flavor: 'Touch the golden idol. Just once.' },
  { id: 'blood-orchid', name: 'Blood Orchid', rarity: 'epic', color: 'green', sigil: '✾', tone: 'venom',
    atk: 6, def: 8, arrows: CROSS,
    ability: { when: want('blue', 'N'), effect: rallyColor(1, 'green') },
    flavor: 'It blooms once a century, and it blooms red.' },

  // Legendary
  { id: 'jaguar-king', name: 'The Jaguar King', rarity: 'legendary', color: 'green', sigil: '♛', tone: 'canopy',
    atk: 8, def: 7, arrows: ALL,
    ability: { when: want('green'), effect: rally(1, 'all') },
    flavor: 'Every creature in the jungle bows to him, or is eaten.' },
  { id: 'sun-priestess', name: 'The Sun Priestess', rarity: 'legendary', color: 'red', sigil: '☀', tone: 'ember',
    atk: 8, def: 8, arrows: ALL,
    ability: { when: want('green'), effect: weaken(2) },
    flavor: 'She burned the city to keep it from the invaders. She rules the ashes still.' },
  { id: 'river-titan', name: 'The River Titan', rarity: 'legendary', color: 'blue', sigil: '♆', tone: 'river',
    atk: 9, def: 9, arrows: ['N', 'E', 'SE', 'S', 'SW', 'W'],
    ability: { when: want('blue'), effect: weaken(2, 'edges') },
    flavor: 'Older than the river. The river is afraid of it.' },
  { id: 'sleeping-god', name: 'The Sleeping God', rarity: 'legendary', color: 'blue', sigil: '☉', tone: 'ruin',
    atk: 10, def: 10, arrows: ['S'],
    ability: { when: want('red'), effect: weaken(1, 'all') },
    flavor: 'The temple was built to keep it asleep.' },
];

for (const card of CARDS) card.arrowMask = arrowMask(card.arrows);

export const CARDS_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));
export const CARD_INDEX = Object.fromEntries(CARDS.map((card, i) => [card.id, i]));

export function cardPower(id) {
  const card = CARDS_BY_ID[id];
  return card.atk + card.def + card.arrows.length;
}
