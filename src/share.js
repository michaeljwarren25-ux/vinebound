// Daily numbering, shareable result text, and challenge links.
import { PLAYER, MATCH_CARDS } from './engine.js';
import { CARDS, CARD_INDEX } from './cards.js';
import { RITES, RITE_INDEX, isRite } from './rites.js';
import { SIZE, CELLS } from './board.js';
import { TWISTS } from './trail.js';

export const GAME_NAME = 'Vinebound';
export const LAUNCH_DATE = '2026-09-13';
export const LEVELS = ['easy', 'normal', 'hard'];

const pad = (n) => String(n).padStart(2, '0');

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function dailyNumber(key) {
  const toUtc = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(key) - toUtc(LAUNCH_DATE)) / 86_400_000) + 1;
}

// Yours, theirs, blocked stone, and empty squares, row by row.
export function emojiGrid(board, blocked = []) {
  const rows = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) {
      const cell = r * SIZE + c;
      const slot = board[cell];
      row.push(blocked[cell] ? '⬛' : !slot ? '⬜' : slot.owner === PLAYER ? '🟩' : '🟥');
    }
    rows.push(row.join(''));
  }
  return rows.join('\n');
}

// Both hands as 2 base-36 characters per card index (player hand first).
export function encodeHands(hands) {
  return hands.flat().map((id) => CARD_INDEX[id].toString(36).padStart(2, '0')).join('');
}

export function decodeHands(code) {
  if (typeof code !== 'string' || !/^[0-9a-z]+$/.test(code) || code.length !== MATCH_CARDS * 4) return null;
  const ids = [];
  for (let i = 0; i < code.length; i += 2) {
    const card = CARDS[Number.parseInt(code.slice(i, i + 2), 36)];
    if (!card) return null;
    ids.push(card.id);
  }
  if (new Set(ids).size !== ids.length) return null;
  return [ids.slice(0, MATCH_CARDS), ids.slice(MATCH_CARDS)];
}

// Both sides' Rites, as one base-36 character each, so a challenge is the same fight and not
// just the same board.
export function encodeRites(rites) {
  return rites.map((id) => RITE_INDEX[id].toString(36)).join('');
}

export function decodeRites(code) {
  if (typeof code !== 'string' || code.length !== 2) return null;
  const ids = [...code].map((c) => RITES[Number.parseInt(c, 36)]?.id);
  return ids.every(isRite) ? ids : null;
}

export function challengeUrl(base, { seed, level, score, name, hands = null, twists = [], rites = null }) {
  const params = new URLSearchParams({ seed, lvl: level, beat: String(score) });
  if (hands) params.set('h', encodeHands(hands));
  if (rites) params.set('r', encodeRites(rites));
  if (twists.length) params.set('tw', twists.join('.'));
  if (name) params.set('from', name);
  return `${base}?${params}`;
}

export function parseChallenge(search) {
  const params = new URLSearchParams(search);
  const seed = params.get('seed');
  if (!seed || seed.length > 40 || !/^[\w-]+$/.test(seed)) return null;

  let hands = null;
  if (params.has('h')) {
    hands = decodeHands(params.get('h'));
    if (!hands) return null; // a tampered hand code can't reproduce the board
  }
  let rites = null;
  if (params.has('r')) {
    rites = decodeRites(params.get('r'));
    if (!rites) return null; // likewise: a tampered Rite code isn't the same fight
  }
  const level = LEVELS.includes(params.get('lvl')) ? params.get('lvl') : 'normal';
  const beat = Number.parseInt(params.get('beat') ?? '', 10);
  return {
    seed,
    level,
    hands,
    rites,
    beat: Number.isInteger(beat) && beat >= 0 && beat <= CELLS ? beat : null,
    from: (params.get('from') ?? '').trim().slice(0, 20),
    twists: [...new Set((params.get('tw') ?? '').split('.').filter((id) => Object.hasOwn(TWISTS, id)))],
  };
}

// `challenge: false` is for campaign matches, whose leveled cards can't be replayed by a friend.
export function buildShareText({ title, playerScore, opponentScore, grid, url, challenge = true }) {
  const result = playerScore > opponentScore ? 'Won' : playerScore < opponentScore ? 'Lost' : 'Drew';
  const invite = challenge ? 'Can you beat me on the same board?' : 'Walk the Jungle Trail:';
  return `${GAME_NAME} ${title} 🌿\n${result} ${playerScore}–${opponentScore}\n${grid}\n${invite}\n${url}`;
}
