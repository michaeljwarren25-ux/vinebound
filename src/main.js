import { createGame, applyMove, isOver, score, outcome, slotStats, PLAYER, OPPONENT, MATCH_CARDS } from './engine.js';
import { chooseMove, chooseRite } from './ai.js';
import { CARDS, CARDS_BY_ID, RARITIES, cardPower } from './cards.js';
import { shuffle } from './rng.js';
import {
  LEVELS, todayKey, dailyNumber, emojiGrid, challengeUrl, parseChallenge, buildShareText,
} from './share.js';
import {
  loadProfile, saveProfile, recordMatch, recordTrailWin, buyCard, toggleDeckCard, isDeckReady, currentStreak,
  nextMilestone, choosePack, buyPack, hasStarted, PRICES, DECK_SIZE,
  buyRite, equipRite, equippedRite,
} from './profile.js';
import { PACKS, PACKS_BY_ID, STARTER_PACKS, packPrice, packMissing, packRarities } from './packs.js';
import { RITES, RITES_BY_ID, riteTargets, riteReady, useRite, ritePrice } from './rites.js';
import { TRAIL, TWISTS, twistRules } from './trail.js';
import { ACHIEVEMENTS, checkAchievements } from './achievements.js';
import {
  campaignStats, cardProgress, awardDeckXp, spendPoint, trailStats, totalPoints, levelFor,
  WIN_XP, MAX_STAT, LEVEL_XP, MAX_LEVEL,
} from './campaign.js';
import {
  cardEl, cardBackEl, cardLabel, abilityBlock, riteFaceEl, loadArtManifest, RARITY_LABELS,
} from './ui/cardView.js';
import { initCardPreview, refreshCardPreview } from './ui/preview.js';
import { sfx, setMuted, isMuted, warmCardCues } from './ui/sound.js';
import { resultImage } from './ui/shareImage.js';
import { COLORS, COLOR_NAMES, computeModifiers, advantagedCells, wouldHaveAdvantage } from './abilities.js';

const LEVEL_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const STAT_LABELS = ['Attack', 'Defense'];
const DAILY_LEVEL = 'normal';
// The opponent takes a random 0.5–1.5 seconds to "think", so its moves don't feel instant.
const AI_THINK_MS = { min: 500, max: 1500 };
// Attack animation beats, in milliseconds. A card lands, then throws its attacks; every link of
// a capture chain swings one beat later, and each slash takes STRIKE_TRAVEL to reach its target.
const STRIKE_LEAD = 170;
const STRIKE_ROUND = 200;
const STRIKE_TRAVEL = 150;
const STRIKE_SETTLE = 450; // the flip / recoil that follows the last impact
const COIN_MS = 1700;
// Quick Match opponents get a hand near your hand's total power, nudged by difficulty.
const POWER_OFFSET = { easy: -8, normal: 0, hard: 4 };
const SHARE_LABEL = 'Share & challenge';
const TEXT_STYLE = '︎'; // forces symbol glyphs to render as text, not colored emoji

const $ = (id) => document.getElementById(id);
const els = {
  home: $('home'), homeBalance: $('home-balance'),
  dailyBtn: $('daily-btn'), dailyNum: $('daily-num'), dailyStatus: $('daily-status'), streakStatus: $('streak-status'),
  quickBtn: $('quick-btn'), deckWarning: $('deck-warning'), collectionBtn: $('collection-btn'),
  collectionCount: $('collection-count'), howtoBtn: $('howto-btn'),
  trailBtn: $('trail-btn'), trailCount: $('trail-count'), trophiesBtn: $('trophies-btn'), trophiesCount: $('trophies-count'),
  challengeBanner: $('challenge-banner'), challengeText: $('challenge-text'), challengeBtn: $('challenge-btn'),
  game: $('game'), quitBtn: $('quit-btn'), modeLabel: $('mode-label'), scoreP: $('score-p'), scoreO: $('score-o'),
  twistBar: $('twist-bar'), riteBtn: $('rite-btn'), foeRite: $('foe-rite'), ritePanel: $('rite-panel'),
  riteList: $('rite-list'), riteSlotHint: $('rite-slot-hint'),
  boardFx: $('board-fx'), strikeFx: $('strike-fx'), drawPile: $('draw-pile'), handO: $('hand-o'), handP: $('hand-p'), board: $('board'), status: $('status'),
  collectionBack: $('collection-back'), collectionBalance: $('collection-balance'),
  deckTitle: $('deck-title'), deckCount: $('deck-count'), deckHint: $('deck-hint'), deckStrip: $('deck-strip'), cardGrid: $('card-grid'),
  packsBtn: $('packs-btn'), packsCount: $('packs-count'), packsBack: $('packs-back'), packsTitle: $('packs-title'),
  packsBalance: $('packs-balance'), packsIntro: $('packs-intro'), packList: $('pack-list'),
  packsFooter: $('packs-footer'), packConfirm: $('pack-confirm'),
  trailBack: $('trail-back'), trailBalance: $('trail-balance'), trailList: $('trail-list'), trailHint: $('trail-hint'),
  campaignCount: $('campaign-count'), campaignHint: $('campaign-hint'), campaignStrip: $('campaign-strip'), campaignEdit: $('campaign-edit'),
  resultDialog: $('result-dialog'), resultTitle: $('result-title'), resultScore: $('result-score'),
  resultGrid: $('result-grid'), resultChallenge: $('result-challenge'), resultRewards: $('result-rewards'),
  nameInput: $('name-input'), shareBtn: $('share-btn'), imageBtn: $('image-btn'), rematchBtn: $('rematch-btn'), homeBtn: $('home-btn'),
  howtoDialog: $('howto-dialog'), trophiesDialog: $('trophies-dialog'), trophyList: $('trophy-list'), trophySummary: $('trophy-summary'),
  cardDialog: $('card-dialog'), cardDialogCard: $('card-dialog-card'), cardDialogRarity: $('card-dialog-rarity'),
  cardDialogName: $('card-dialog-name'), cardDialogFlavor: $('card-dialog-flavor'), cardDialogAction: $('card-dialog-action'),
  cardDialogAbility: $('card-dialog-ability'), cardDialogUpgrade: $('card-dialog-upgrade'), cardPreview: $('card-preview'),
  coinOverlay: $('coin-overlay'), coinStage: $('coin-stage'), coin: $('coin'), coinResult: $('coin-result'),
  toast: $('toast'),
  unlockDialog: $('unlock-dialog'), unlockEyebrow: $('unlock-eyebrow'), unlockFront: $('unlock-front'),
  unlockRarity: $('unlock-rarity'), unlockName: $('unlock-name'), unlockAbility: $('unlock-ability'),
  unlockSource: $('unlock-source'), unlockNext: $('unlock-next'), unlockDeck: $('unlock-deck'),
};

// localStorage can be unavailable (private mode, blocked storage); never let that break the game.
const storage = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
};
const setting = {
  get(key, fallback) {
    const raw = storage.getItem(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  set(key, value) {
    storage.setItem(key, JSON.stringify(value));
  },
};

const incomingChallenge = parseChallenge(location.search);
let profile = loadProfile(storage);
let quickLevel = LEVELS.includes(setting.get('level')) ? setting.get('level') : 'normal';
let match = null;
let collectionFilter = 'all';
let collectionColor = 'all';
let collectionMode = 'duel'; // which deck the Collection edits: 'duel' or 'campaign'
let collectionReturn = 'home';
let packsMode = 'start'; // 'start' = the opening choice, 'shop' = buying more with amber
let pickedPack = null;
// An incoming challenge is playable without any cards, so it goes first; the pack picker waits.
let challengeFirst = Boolean(incomingChallenge);
let detailCardId = null;
let toastTimer = 0;

function commit(nextProfile) {
  // Cards that just joined the collection stay marked "new" until the player looks at them.
  const added = nextProfile.owned.filter((id) => !profile.owned.includes(id));
  profile = added.length
    ? { ...nextProfile, newCards: [...new Set([...(nextProfile.newCards ?? []), ...added])] }
    : nextProfile;
  saveProfile(storage, profile);
}

const isNewCard = (id) => profile.newCards.includes(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function showScreen(id) {
  for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== id;
  document.body.dataset.screen = id; // lets the game screen use the full window width
  window.scrollTo(0, 0);
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3500);
}

const trophyText = (unlocked) => unlocked.map((a) => `Trophy: ${a.name} · +${a.amber} amber`).join('  ·  ');

function announceAchievements(unlocked) {
  if (unlocked.length === 0) return;
  sfx.unlock();
  showToast(trophyText(unlocked));
}

// Campaign cards show their leveled numbers and a level badge.
function campaignView(id) {
  return {
    stats: campaignStats(profile, id),
    level: profile.owned.includes(id) ? cardProgress(profile, id).level : null,
  };
}

const RESULT_WORDS = { win: 'won', loss: 'lost', draw: 'drew' };

// ---------- Sound ----------

function renderSoundButtons() {
  for (const btn of document.querySelectorAll('[data-sound-toggle]')) {
    btn.classList.toggle('off', isMuted());
    btn.setAttribute('aria-pressed', String(!isMuted()));
    btn.setAttribute('aria-label', isMuted() ? 'Sound off. Turn on' : 'Sound on. Turn off');
  }
}

// ---------- Home ----------

function renderHome() {
  // The game opens on the pack picker: without a pack there is no deck and nothing to spend.
  if (!hasStarted(profile) && !challengeFirst) return openPacks('start');

  const key = todayKey();
  els.homeBalance.textContent = profile.amber;
  els.dailyNum.textContent = `#${dailyNumber(key)}`;

  const record = profile.dailyResults[key];
  els.dailyStatus.textContent = record
    ? `Today: ${RESULT_WORDS[outcome([record.p, record.o])]} ${record.p}–${record.o}`
    : 'A new board every day, the same for everyone.';

  const streak = currentStreak(profile, key);
  const next = nextMilestone(streak);
  els.streakStatus.textContent = streak > 0
    ? `🔥 ${streak}-day streak · ${RARITY_LABELS[next.rarity]} card at ${next.days} days`
    : `Play ${next.days} days in a row to earn a ${RARITY_LABELS[next.rarity]} card`;

  const ready = isDeckReady(profile);
  els.quickBtn.disabled = !ready;
  els.deckWarning.hidden = ready;
  const newCount = profile.newCards.length;
  els.collectionCount.textContent = `${profile.owned.length}/${CARDS.length}${newCount ? ` · ${newCount} new` : ''}`;
  const points = totalPoints(profile);
  els.trailCount.textContent = `${profile.trail}/${TRAIL.length}${points ? ` · ${points} upgrade point${points === 1 ? '' : 's'}` : ''}`;
  els.trophiesCount.textContent = `${profile.achievements.length}/${ACHIEVEMENTS.length}`;

  for (const btn of document.querySelectorAll('.difficulty button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.level === quickLevel));
  }

  if (incomingChallenge) {
    const who = incomingChallenge.from || 'A friend';
    const target = incomingChallenge.beat == null ? '' : ` held ${incomingChallenge.beat} cards`;
    const twists = incomingChallenge.twists.map((id) => TWISTS[id].name).join(' + ');
    els.challengeText.textContent =
      `${who}${target} on a ${LEVEL_LABELS[incomingChallenge.level]} board${twists ? ` with ${twists}` : ''}. Can you beat it?`;
    els.challengeBanner.hidden = false;
  }
  showScreen('home');
}

// ---------- Match flow ----------

function handFrom(deck) {
  return shuffle([...deck], Math.random).slice(0, MATCH_CARDS);
}

function startMatch({ mode, seed, level, challenge = null, dailyKey = null, stopIndex = null }) {
  let options = {};
  let rules = {};
  let twists = [];
  if (mode === 'quick') {
    options = { playerHand: handFrom(profile.deck), powerOffset: POWER_OFFSET[level] };
  } else if (mode === 'trail') {
    // Campaign: leveled numbers for your cards, scaled numbers for the opponent's.
    const stop = TRAIL[stopIndex];
    const hand = handFrom(profile.campaign.deck);
    options = { hands: [hand, shuffle([...stop.hand], Math.random)] };
    twists = stop.twists;
    rules = { stats: [Object.fromEntries(hand.map((id) => [id, campaignStats(profile, id)])), trailStats(stopIndex, stop.hand)] };
  } else if (mode === 'challenge') {
    if (challenge.hands) options = { hands: challenge.hands };
    twists = challenge.twists;
  }
  // Your equipped Rite, except on a challenge, which carries both sides' Rites so the friend
  // fights the same fight rather than just the same board. The opponent's comes from the seed.
  const rites = mode === 'challenge' && challenge.rites
    ? challenge.rites
    : [equippedRite(profile, { campaign: mode === 'trail' }), null];
  const state = createGame(seed, { ...options, rites, rules: { ...twistRules(twists), ...rules } });

  match = {
    mode, seed, level, challenge, dailyKey, stopIndex, twists,
    practice: mode === 'daily' && Boolean(profile.dailyResults[dailyKey]),
    state,
    initialHands: state.dealt.map((cards) => [...cards]),
    selected: null,
    busy: true, // until the coin toss lands
    flipping: true,
    previewCaptures: null,
    riteAiming: false, // picking a target for your Rite
    bestCapture: 0,
    maxAdvantaged: 0,
    animUntil: 0, // when the current move's attacks finish playing out
    rewards: null,
  };
  els.strikeFx.replaceChildren(); // no slashes left hanging over a fresh board
  warmCardCues(state.dealt.flat());
  closeRitePanel();
  els.modeLabel.textContent = modeLabel();
  renderTwistBar();
  renderFieldFx();
  if (els.resultDialog.open) els.resultDialog.close();
  showScreen('game');
  render();
  tossCoin();
}

function renderTwistBar() {
  els.twistBar.replaceChildren(...match.twists.map((id) => {
    const item = el('span', 'twist');
    item.append(el('b', null, TWISTS[id].name), ` ${TWISTS[id].text}`);
    return item;
  }));
  els.twistBar.hidden = match.twists.length === 0;
  els.game.classList.toggle('has-twists', match.twists.length > 0);
}

const rand = (min, max) => min + Math.random() * (max - min);

// Ambient visuals for the match's rule twists. Each twist's painting is layered into the board
// surface (above the slab, under the cards, so it never hides a card's numbers); animated extras
// like embers and dust float over the board.
function renderFieldFx() {
  const surface = [
    ...match.twists.map((id) => `url("art/field/twist-${id}.webp")`),
    'linear-gradient(rgba(8, 10, 7, 0.32), rgba(8, 10, 7, 0.32))',
    'url("art/field/board.webp")',
  ];
  els.board.style.backgroundImage = match.twists.length ? surface.join(', ') : '';
  els.board.style.backgroundSize = match.twists.length ? 'cover' : '';
  els.board.style.backgroundPosition = match.twists.length ? 'center' : '';
  els.board.style.backgroundRepeat = match.twists.length ? 'no-repeat' : '';

  const layers = [];
  const has = (id) => match.twists.includes(id);
  const particles = (className, count, sizes) => {
    for (let i = 0; i < count; i++) {
      const bit = el('span', className);
      bit.style.cssText = `--x:${rand(2, 98)}%;--size:${rand(...sizes)}px;--dur:${rand(3.5, 7)}s;--delay:${rand(-7, 0)}s;--drift:${rand(-30, 30)}px`;
      layers.push(bit);
    }
  };
  if (has('wildfire')) particles('fx-ember', 26, [3, 7]);
  if (has('flood')) layers.push(el('div', 'fx-water back'), el('div', 'fx-water'));
  if (has('rockslide')) particles('fx-dust', 16, [2, 5]);
  els.boardFx.className = `board-fx ${match.twists.map((id) => `fx-${id}`).join(' ')}`;
  els.boardFx.replaceChildren(...layers);
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// When the blow of a given chain link lands, in seconds after the card was played.
const strikeHit = (round) => (STRIKE_LEAD + round * STRIKE_ROUND + STRIKE_TRAVEL) / 1000;

// How long a move's whole exchange takes, so the opponent (and the results screen) can wait it out.
function strikeDuration(strikes) {
  if (!strikes?.length) return 0;
  const last = strikes.reduce((deepest, s) => Math.max(deepest, s.round), 0);
  return STRIKE_LEAD + last * STRIKE_ROUND + STRIKE_TRAVEL + STRIKE_SETTLE;
}

/**
 * Draws every attack the last move threw. A slash rakes out of the attacker along the arrow it
 * used, into the card that arrow points at: one that lands bursts and the card turns behind it,
 * one that fails breaks on a shield the defender raises against it. Each link of a capture chain
 * swings a beat after the one that fed it, so a long chain reads as a sequence of blows.
 */
function renderStrikes(strikes) {
  els.strikeFx.replaceChildren();
  els.strikeFx.classList.toggle('owner-0', match.state.lastMove?.owner === PLAYER);
  els.strikeFx.classList.toggle('owner-1', match.state.lastMove?.owner === OPPONENT);
  if (!strikes?.length || reducedMotion()) return;

  const frame = els.strikeFx.getBoundingClientRect();
  const centerOf = (cell) => {
    const box = els.board.children[cell]?.getBoundingClientRect();
    if (!box) return null;
    return { x: box.left - frame.left + box.width / 2, y: box.top - frame.top + box.height / 2, size: box.width };
  };

  const nodes = [];
  const rung = new Set(); // one shield per card per beat, however many attacks converge on it
  for (const strike of strikes) {
    const from = centerOf(strike.from);
    const to = centerOf(strike.to);
    if (!from || !to) continue;
    const swing = STRIKE_LEAD + strike.round * STRIKE_ROUND;
    const kind = strike.won ? 'lands' : 'held';

    const slash = el('span', `strike ${kind}`);
    slash.style.cssText = `--x:${from.x}px; --y:${from.y}px; --angle:${Math.atan2(to.y - from.y, to.x - from.x)}rad;`
      + ` --len:${Math.hypot(to.x - from.x, to.y - from.y)}px; --thick:${to.size * 0.44}px;`
      + ` --delay:${swing}ms; --travel:${STRIKE_TRAVEL}ms`;
    nodes.push(slash);

    const ring = `${strike.to}:${strike.round}`;
    if (strike.won) {
      const impact = el('span', 'impact');
      impact.style.cssText = `--x:${to.x}px; --y:${to.y}px; --size:${to.size * 0.88}px; --delay:${swing + STRIKE_TRAVEL}ms`;
      nodes.push(impact);
    } else if (!rung.has(ring)) {
      // The defender gets a shield up, facing the way the blow came from. It goes up a little
      // before the claws arrive, so the attack is seen to break on it rather than beside it.
      rung.add(ring);
      const guard = el('span', 'guard');
      guard.style.cssText = `--x:${to.x}px; --y:${to.y}px; --size:${to.size * 0.82}px;`
        + ` --angle:${Math.atan2(from.y - to.y, from.x - to.x)}rad; --delay:${swing + STRIKE_TRAVEL * 0.4}ms`;
      nodes.push(guard);
    }
  }
  els.strikeFx.replaceChildren(...nodes);
}

// A carved stone token decides who plays first. The result comes from the seed, so replays match.
function tossCoin() {
  const current = match;
  const first = current.state.first;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 0 : COIN_MS;

  for (const node of [els.coin, els.coinStage]) node.getAnimations().forEach((a) => a.cancel());
  els.coinResult.textContent = '';
  els.coinOverlay.hidden = false;
  if (duration) sfx.coinToss(duration / 1000);

  els.coinStage.animate(
    [{ transform: 'translateY(0)' }, { transform: 'translateY(-120px)', offset: 0.45 }, { transform: 'translateY(0)' }],
    { duration, easing: 'ease-in-out' },
  );
  const spins = 360 * 6 + (first === OPPONENT ? 180 : 0);
  const spin = els.coin.animate(
    [{ transform: 'rotateX(0deg)' }, { transform: `rotateX(${spins}deg)` }],
    { duration, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' },
  );

  spin.finished.then(() => {
    if (match !== current) return;
    els.coinResult.textContent = first === PLAYER ? 'You play first' : 'Your opponent plays first';
    setTimeout(() => {
      if (match !== current) return;
      els.coinOverlay.hidden = true;
      current.flipping = false;
      current.busy = false;
      render();
      if (current.state.turn === OPPONENT) opponentTurn();
    }, 1000);
  }).catch(() => {}); // cancelled by a new match
}

function modeLabel() {
  if (match.mode === 'daily') return `Daily #${dailyNumber(match.dailyKey)}${match.practice ? ' · practice' : ''}`;
  if (match.mode === 'challenge') return `${match.challenge.from || 'Friend'}'s challenge · ${LEVEL_LABELS[match.level]}`;
  if (match.mode === 'trail') {
    const stop = TRAIL[match.stopIndex];
    return `Trail ${match.stopIndex + 1}: ${stop.foe} · ${LEVEL_LABELS[match.level]}`;
  }
  return `Quick Match · ${LEVEL_LABELS[match.level]}`;
}

const countAdvantaged = (board, owner) =>
  advantagedCells(board).filter((on, i) => on && board[i].owner === owner).length;

function play(move) {
  const mover = match.state.turn;
  const advantagedBefore = advantagedCells(match.state.board).filter(Boolean).length;
  match.state = applyMove(match.state, move);
  match.selected = null;
  match.previewCaptures = null;

  const { board, lastMove } = match.state;
  sfx.card(lastMove.cardId);
  const rung = new Set();
  for (const strike of lastMove.strikes) {
    // One knock per card per beat: a card several attacks bounce off shouldn't rattle.
    const ring = `${strike.to}:${strike.round}`;
    if (!strike.won && rung.has(ring)) continue;
    rung.add(ring);
    const swing = (STRIKE_LEAD + strike.round * STRIKE_ROUND) / 1000;
    sfx.strike(swing, strike.won);
    if (strike.won) sfx.flip(strikeHit(strike.round));
  }
  if (advantagedCells(board).filter(Boolean).length > advantagedBefore) sfx.advantage();
  if (lastMove.drew && mover === PLAYER) sfx.draw();
  if (mover === PLAYER) match.bestCapture = Math.max(match.bestCapture, lastMove.flipped.length);
  match.maxAdvantaged = Math.max(match.maxAdvantaged, countAdvantaged(board, PLAYER));

  render();
  renderStrikes(lastMove.strikes);
  // Everything that reacts to a move — the opponent's reply, the results screen — waits this out.
  match.animUntil = performance.now() + (reducedMotion() ? 0 : strikeDuration(lastMove.strikes));
  if (isOver(match.state)) {
    finish();
  } else if (match.state.turn === OPPONENT) {
    opponentTurn();
  }
}

function opponentTurn() {
  const current = match;
  current.busy = true;
  renderStatus();
  const think = AI_THINK_MS.min + Math.random() * (AI_THINK_MS.max - AI_THINK_MS.min);
  // It thinks fast, but it never plays over the attacks of the move it's answering.
  const wait = Math.max(think, (current.animUntil ?? 0) - performance.now());
  setTimeout(() => {
    if (match !== current) return; // player left the match
    if (riteReady(current.state, OPPONENT)) {
      const pick = chooseRite(current.state, current.level);
      if (pick) {
        current.state = useRite(current.state, OPPONENT, pick.target);
        sfx.advantage();
        render();
        showToast(`Opponent used ${RITES_BY_ID[current.state.rites[OPPONENT]].name}`);
      }
    }
    const move = chooseMove(current.state, current.level);
    current.busy = false;
    play(move);
  }, wait);
}

function finish() {
  const current = match;
  const [p, o] = score(match.state.board);
  const won = outcome([p, o]) === 'win';
  let { profile: next, rewards } = recordMatch(profile, {
    mode: match.mode, level: match.level, won, score: [p, o],
    dailyKey: match.dailyKey, practice: match.practice,
  });
  if (match.mode === 'trail' && won) {
    const trail = recordTrailWin(next, match.stopIndex);
    const xp = awardDeckXp(trail.profile, WIN_XP[match.level]);
    next = xp.profile;
    rewards = {
      ...rewards,
      amber: rewards.amber + trail.rewards.amber,
      cards: [...rewards.cards, ...trail.rewards.cards],
      trailCleared: trail.rewards.trailCleared,
      xp: WIN_XP[match.level],
      levelUps: xp.levelUps,
      // Before and after XP for each deck card, for the filling bars on the results screen.
      xpCards: next.campaign.deck.map((cardId) => ({
        cardId, beforeXp: cardProgress(trail.profile, cardId).xp, afterXp: cardProgress(next, cardId).xp,
      })),
    };
  }

  const target = match.challenge?.beat;
  const { profile: withTrophies, unlocked } = checkAchievements(next, {
    won, mode: match.mode, level: match.level, score: [p, o],
    bestCapture: match.bestCapture, maxAdvantaged: match.maxAdvantaged,
    colors: match.initialHands[PLAYER].map((id) => CARDS_BY_ID[id].color),
    beatChallenge: target != null && p > target,
  });
  commit(withTrophies);
  match.rewards = { ...rewards, achievements: unlocked };

  // Let the last attack land, and the card it took finish turning, before results cover the board.
  const settle = Math.max(700, (match.animUntil ?? 0) - performance.now() + 150);
  setTimeout(() => {
    if (match !== current) return;
    if (won) sfx.win();
    else sfx.lose();
    if (unlocked.length || rewards.levelUps?.length) setTimeout(sfx.unlock, 800);
    showResult();
  }, settle);
}

function showResult() {
  if (!match || !isOver(match.state)) return;
  const [p, o] = score(match.state.board);
  const result = outcome([p, o]);
  els.resultDialog.classList.toggle('won', result === 'win');
  els.resultDialog.classList.toggle('drawn', result === 'draw');
  els.resultTitle.textContent = { win: 'Victory', loss: 'Defeat', draw: 'Draw' }[result];
  els.resultScore.textContent = `${p}–${o}`;
  els.resultGrid.textContent = emojiGrid(match.state.board, match.state.blocked);

  const target = match.challenge?.beat;
  els.resultChallenge.hidden = target == null;
  if (target != null) {
    const who = match.challenge.from || 'your friend';
    els.resultChallenge.textContent =
      p > target ? `You beat ${who}'s ${target}!` :
      p === target ? `You tied ${who}'s ${target}. So close.` :
      `${who} still leads with ${target}. Try again?`;
  }

  renderRewards(match.rewards);
  els.rematchBtn.textContent = rematchLabel(result === 'win');
  els.nameInput.value = setting.get('name', '');
  els.shareBtn.textContent = match.mode === 'trail' ? 'Share' : SHARE_LABEL;
  els.imageBtn.textContent = 'Save image';
  if (!els.resultDialog.open) els.resultDialog.showModal();

  // New cards get a full reveal first; XP bars fill once it's closed so both are seen.
  const newCards = match.rewards?.cards ?? [];
  const afterReveal = () => animateXpGains().then(() => {
    const summary = els.resultRewards.querySelector('.xp-summary');
    if (summary) summary.hidden = false;
  });
  if (newCards.length && !match.revealed) {
    match.revealed = true;
    revealCards(newCards, rewardSource(match.rewards)).then(afterReveal);
  } else {
    afterReveal();
  }
}

function rewardSource(rewards) {
  if (rewards?.trailCleared) return `Reward for clearing ${TRAIL.find((s) => s.id === rewards.trailCleared).place}`;
  if (rewards?.streakMilestone) return `Reward for a ${rewards.streakMilestone.days}-day Daily Duel streak`;
  return '';
}

function rematchLabel(won) {
  if (match.mode === 'challenge') return 'Try again';
  if (match.mode === 'trail') {
    if (!won) return 'Try again';
    return TRAIL[match.stopIndex + 1] ? 'Next stop' : 'Back to the Trail';
  }
  return 'New match';
}

function renderRewards(rewards) {
  const parts = [];
  if (rewards?.trailCleared) {
    const stop = TRAIL.find((s) => s.id === rewards.trailCleared);
    parts.push(el('p', 'reward-line trail', `${stop.place} cleared!`));
  }
  if (rewards?.amber) {
    const line = el('p', 'reward-line');
    line.append(el('span', 'amber-drop'), ` +${rewards.amber} amber`);
    parts.push(line);
  }
  if (rewards?.xpCards?.length) parts.push(xpGainsEl(rewards));
  if (rewards?.streakMilestone) {
    parts.push(el('p', 'reward-line streak', `🔥 ${rewards.streakMilestone.days}-day streak reward!`));
  }
  for (const id of rewards?.cards ?? []) {
    const unlock = el('div', 'reward-card is-new');
    const face = el('div', 'reward-card-face');
    face.append(cardEl(id));
    const text = el('div', 'reward-card-text');
    text.append(
      el('span', `rarity-text-${CARDS_BY_ID[id].rarity}`, `New ${RARITY_LABELS[CARDS_BY_ID[id].rarity]} card`),
      el('strong', null, CARDS_BY_ID[id].name),
    );
    unlock.append(face, text);
    parts.push(unlock);
  }
  for (const trophy of rewards?.achievements ?? []) {
    parts.push(el('p', 'reward-line trophy', `Trophy: ${trophy.name} · +${trophy.amber} amber`));
  }
  els.resultRewards.replaceChildren(...parts);
  els.resultRewards.hidden = parts.length === 0;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How far through its current level a card's XP is, as a percentage.
function levelPercent(xp) {
  const level = levelFor(xp);
  if (level >= MAX_LEVEL) return 100;
  return ((xp - LEVEL_XP[level - 1]) / (LEVEL_XP[level] - LEVEL_XP[level - 1])) * 100;
}

// Each campaign deck card with an XP bar, drawn at its XP from before the match.
function xpGainsEl(rewards) {
  const box = el('div', 'xp-gains');
  const headline = el('p', 'xp-headline');
  headline.append(el('span', null, 'Campaign deck'), el('strong', null, `+${rewards.xp} XP`));
  box.append(headline);
  const grid = el('div', 'xp-grid');
  for (const { cardId, beforeXp, afterXp } of rewards.xpCards) {
    const item = el('div', 'xp-card');
    item.dataset.before = beforeXp;
    item.dataset.after = afterXp;
    item.setAttribute('aria-label', `${CARDS_BY_ID[cardId].name}: level ${levelFor(afterXp)}`);
    const face = el('div', 'xp-face');
    face.append(cardEl(cardId, { stats: campaignStats(profile, cardId), level: levelFor(beforeXp) }));
    const bar = el('div', 'xp-bar');
    const fill = el('span');
    fill.style.width = `${levelPercent(beforeXp)}%`;
    bar.append(fill);
    item.append(face, bar, el('span', 'xp-level', levelFor(beforeXp) >= MAX_LEVEL ? 'Max' : `Lv ${levelFor(beforeXp)}`));
    grid.append(item);
  }
  box.append(grid);

  // Shown after the bars finish filling: a direct way to spend the new points.
  const ups = rewards.levelUps?.length ?? 0;
  if (ups) {
    const summary = el('div', 'xp-summary');
    summary.hidden = true;
    const spend = el('button', 'btn small primary', 'Spend upgrade points');
    spend.type = 'button';
    spend.addEventListener('click', () => {
      leaveMatch();
      openCollection('campaign', 'trail');
    });
    summary.append(el('p', null, `${ups} card${ups === 1 ? '' : 's'} leveled up · +${ups} upgrade point${ups === 1 ? '' : 's'}`), spend);
    box.append(summary);
  }
  return box;
}

// Fills each bar to its new XP. A level-up fills the bar, pops the card, then keeps filling from empty.
async function animateXpGains() {
  const items = [...els.resultRewards.querySelectorAll('.xp-card')];
  if (items.length === 0) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let chimed = false;

  const levelUp = (item, level) => {
    const gained = Number(item.dataset.gained ?? 0) + 1;
    item.dataset.gained = gained;
    for (const badge of item.querySelectorAll('.level-badge')) badge.textContent = `Lv ${level}`;
    item.querySelector('.xp-level').replaceChildren(
      level >= MAX_LEVEL ? 'Max ' : `Lv ${level} `,
      el('span', 'xp-up', `+${gained}`),
    );
    item.classList.remove('leveled');
    void item.offsetWidth; // restart the pop animation
    item.classList.add('leveled');
    if (!chimed) {
      chimed = true;
      sfx.advantage();
    }
  };

  // The bars always fill smoothly (it's the point of the screen); reduced motion only skips the extras.
  await Promise.all(items.map(async (item, i) => {
    const before = Number(item.dataset.before);
    const after = Number(item.dataset.after);
    const fill = item.querySelector('.xp-bar span');
    const target = levelFor(after);
    let level = levelFor(before);
    try {
      await wait(reduced ? 200 : 750 + i * 120);
      if (after > before) {
        item.classList.add('filling');
        if (!reduced) {
          const float = el('span', 'xp-float', `+${after - before} XP`);
          item.append(float);
          setTimeout(() => float.remove(), 1500);
        }
      }
      let from = levelPercent(before);
      while (level < target) {
        fill.style.width = '100%';
        await fill.animate([{ width: `${from}%` }, { width: '100%' }], { duration: 750, easing: 'ease-in-out' }).finished;
        level += 1;
        levelUp(item, level);
        from = 0;
      }
      const to = levelPercent(after);
      fill.style.width = `${to}%`;
      if (to !== from) {
        await fill.animate([{ width: `${from}%` }, { width: `${to}%` }], { duration: 1100, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' }).finished;
      }
    } catch {
      fill.style.width = `${levelPercent(after)}%`; // animation cancelled (dialog closed)
    } finally {
      item.classList.remove('filling');
    }
  }));
}

function shareTitle() {
  if (match.mode === 'daily') return `Daily #${dailyNumber(match.dailyKey)}`;
  if (match.mode === 'challenge') return 'Challenge';
  if (match.mode === 'trail') return `Trail: ${TRAIL[match.stopIndex].place}`;
  return `Quick Match · ${LEVEL_LABELS[match.level]}`;
}

function shareName() {
  const name = els.nameInput.value.trim().slice(0, 20);
  setting.set('name', name);
  return name;
}

function makeResultImage(name) {
  const { board, blocked } = match.state;
  return resultImage({ board, blocked, title: shareTitle(), score: score(board), name, host: location.host });
}

async function shareResult() {
  const name = shareName();
  const [p, o] = score(match.state.board);
  const base = location.origin + location.pathname;
  // Campaign cards are leveled, so a friend couldn't replay a Trail board: share the game instead.
  const challenge = match.mode !== 'trail';
  const url = challenge
    ? challengeUrl(base, {
      seed: match.seed, level: match.level, score: p, name, twists: match.twists,
      rites: match.state.rites,
      // Daily boards are rebuilt from the seed alone; deck-based boards need the hands.
      hands: match.mode === 'daily' ? null : match.initialHands,
    })
    : base;
  const label = challenge ? SHARE_LABEL : 'Share';
  const text = buildShareText({
    title: shareTitle(), playerScore: p, opponentScore: o,
    grid: emojiGrid(match.state.board, match.state.blocked), url, challenge,
  });

  if (navigator.share) {
    try {
      const blob = await makeResultImage(challenge ? name : '');
      const file = blob && new File([blob], 'vinebound.png', { type: 'image/png' });
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text, files: [file] });
      } else {
        await navigator.share({ text });
      }
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    flashButton(els.shareBtn, 'Copied! Paste it to a friend ✓', label);
  } catch {
    flashButton(els.shareBtn, "Couldn't copy. Try again", label);
  }
}

async function saveImage() {
  const blob = await makeResultImage(match.mode === 'trail' ? '' : shareName());
  if (!blob) {
    flashButton(els.imageBtn, "Couldn't make the image", 'Save image');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = `vinebound-${match.seed}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  flashButton(els.imageBtn, 'Saved ✓', 'Save image');
}

function flashButton(btn, text, label) {
  btn.textContent = text;
  setTimeout(() => { btn.textContent = label; }, 2200);
}

function quickSeed() {
  return Math.random().toString(36).slice(2, 10);
}

function rematch() {
  const won = outcome(score(match.state.board)) === 'win';
  if (match.mode === 'challenge') {
    startMatch({ mode: 'challenge', seed: match.seed, level: match.level, challenge: match.challenge });
  } else if (match.mode === 'trail') {
    const next = won ? match.stopIndex + 1 : match.stopIndex;
    if (TRAIL[next] && next <= profile.trail && isDeckReady(profile, { campaign: true })) startTrailStop(next);
    else openTrail();
  } else if (isDeckReady(profile)) {
    startMatch({ mode: 'quick', seed: quickSeed(), level: quickLevel });
  } else {
    goHome();
  }
}

function leaveMatch() {
  match = null;
  els.coinOverlay.hidden = true;
  if (els.resultDialog.open) els.resultDialog.close();
}

function goHome() {
  leaveMatch();
  renderHome();
}

// ---------- Game rendering ----------

function render() {
  const { state } = match;
  renderHand(els.handO, state.hands[OPPONENT], OPPONENT);
  renderHand(els.handP, state.hands[PLAYER], PLAYER);
  renderBoard();
  const [p, o] = score(state.board);
  els.scoreP.textContent = p;
  els.scoreO.textContent = o;
  renderRiteBar();
  renderDrawPile();
  markRiteTargets();
  renderStatus();
  refreshCardPreview();
}

// The player's hand is face up; the opponent's is face down. Freshly drawn cards slide in.
function renderHand(container, hand, owner) {
  const { state } = match;
  const playable = owner === PLAYER && state.turn === PLAYER && !match.busy && !isOver(state);
  const drew = state.lastMove?.owner === owner && state.lastMove.drew;
  const sideStats = state.rules.stats[owner];

  const slots = hand.map((cardId, i) => {
    if (owner === OPPONENT) {
      const slot = el('div', 'hand-slot');
      slot.append(cardBackEl());
      slot.setAttribute('aria-label', 'Hidden card');
      if (drew && i === hand.length - 1) slot.classList.add('drawn');
      return slot;
    }
    const slot = el('button', 'hand-slot');
    slot.type = 'button';
    slot.append(cardEl(cardId, { owner, stats: sideStats[cardId] }));
    slot.setAttribute('aria-label', cardLabel(cardId, sideStats[cardId]));
    slot.disabled = !playable;
    slot.setAttribute('aria-pressed', String(match.selected === i));
    slot.addEventListener('click', () => selectCard(i));
    if (drew === cardId) slot.classList.add('drawn');
    return slot;
  });

  const left = state.decks[owner].length;
  container.replaceChildren(...slots, el('div', 'pile', left ? `${left} left to draw` : 'Pile empty'));
}

function renderBoard() {
  const { board, blocked, tiles, lastMove, rules } = match.state;
  const mods = computeModifiers(board, undefined, rules);
  const advantaged = advantagedCells(board);
  // Which beat of the last move's chain each card fell on, and which cards turned a blow aside.
  const fell = new Map();
  const held = new Map();
  for (const strike of lastMove?.strikes ?? []) {
    if (strike.won) fell.set(strike.to, strike.round);
    else if (!held.has(strike.to)) held.set(strike.to, strike.round);
  }
  els.board.replaceChildren(...board.map((slot, i) => {
    if (blocked[i]) {
      const stone = el('div', `cell blocked stone-${i % 3}`);
      stone.setAttribute('role', 'img');
      stone.setAttribute('aria-label', `Square ${i + 1}, blocked by stone`);
      return stone;
    }
    const cell = el('button', 'cell');
    cell.type = 'button';
    if (tiles[i] > 0) cell.classList.add('sunlit');
    if (tiles[i] < 0) cell.classList.add('shade');

    if (slot) {
      const stats = slotStats(slot, rules);
      const card = cardEl(slot.cardId, {
        owner: slot.owner, tile: tiles[i], mods: mods.subarray(i * 2, i * 2 + 2), advantage: advantaged[i], stats,
      });
      if (lastMove?.cell === i) card.classList.add('placed');
      if (fell.has(i)) {
        // It keeps its old owner's arrows until the blow lands, then turns: a chain falls one
        // link at a time, each card standing until something swings at it.
        const round = fell.get(i);
        // Under reduced motion there is no blow to wait for: the card is simply already taken.
        if (!reducedMotion()) {
          card.classList.add('turning');
          setTimeout(() => {
            if (!card.isConnected) return; // the board moved on
            card.classList.replace('turning', 'flipped');
            // Taken by the chain rather than by the played card: claw marks rake across it.
            if (round > 0) card.append(el('span', 'claw'));
          }, strikeHit(round) * 1000);
        }
      } else if (held.has(i)) {
        // It was attacked and stood: a shudder, in time with the slash ringing off it.
        card.classList.add('held');
        card.style.animationDelay = `${strikeHit(held.get(i))}s`;
      }
      cell.append(card);
      cell.setAttribute('aria-label',
        `${slot.owner === PLAYER ? 'Your' : "Opponent's"} ${cardLabel(slot.cardId, stats)}${advantaged[i] ? ' Advantage active.' : ''}`);
    } else {
      cell.classList.add('empty');
      const tileName = tiles[i] > 0 ? ', sunlit +1' : tiles[i] < 0 ? ', undergrowth −1' : '';
      cell.setAttribute('aria-label', `Empty square ${i + 1}${tileName}`);
      if (tiles[i] !== 0) {
        const badge = el('span', 'tile-badge');
        badge.append(
          el('span', 'glyph', (tiles[i] > 0 ? '☀' : '❦') + TEXT_STYLE),
          // The name drops out on a square too narrow to hold it; the glyph and the number stay.
          el('span', 'tile-name', tiles[i] > 0 ? 'Sunlit' : 'Undergrowth'),
          el('span', 'tile-amount', tiles[i] > 0 ? '+1' : '−1'),
        );
        cell.append(badge);
      }
      cell.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'touch') showPlacementPreview(i);
      });
      cell.addEventListener('pointerleave', clearPlacementPreview);
    }
    cell.addEventListener('click', () => onCellClick(i));
    return cell;
  }));
  renderAdvantageHints();
}

// While a card is selected, mark the empty squares where it would have Advantage. The colour it
// wants can come from either side's cards, so enemy cards light these squares up too.
function renderAdvantageHints() {
  const { board, blocked, hands } = match.state;
  const cardId = match.selected === null ? null : hands[PLAYER][match.selected];
  const wanted = cardId && CARDS_BY_ID[cardId].ability.when.color;
  [...els.board.children].forEach((cell, i) => {
    const hint = Boolean(cardId) && !board[i] && !blocked[i] && wouldHaveAdvantage(board, i, cardId);
    cell.classList.remove('advantage-hint', ...COLORS.map((c) => `want-${c}`));
    cell.querySelector('.advantage-hint-label')?.remove();
    if (hint) {
      cell.classList.add('advantage-hint', `want-${wanted}`);
      cell.append(el('span', 'advantage-hint-label', 'Advantage'));
    }
  });
  els.board.classList.toggle('selecting', match.selected !== null);
}

// Hovering a square with a card selected shows the card there, with its final numbers,
// and marks every enemy card it would capture (chains included).
function showPlacementPreview(cell) {
  clearPlacementPreview();
  const { state } = match ?? {};
  if (!state || match.busy || match.selected === null || state.turn !== PLAYER) return;
  if (state.board[cell] || state.blocked[cell]) return;

  const next = applyMove(state, { handIndex: match.selected, cell });
  const placed = next.board[cell];
  const mods = computeModifiers(next.board, undefined, next.rules);
  const advantaged = advantagedCells(next.board);
  const ghost = cardEl(placed.cardId, {
    owner: PLAYER, tile: next.tiles[cell], mods: mods.subarray(cell * 2, cell * 2 + 2), advantage: advantaged[cell],
    stats: slotStats(placed, next.rules),
  });
  ghost.classList.add('ghost');
  const target = els.board.children[cell];
  target.classList.add('previewing');
  target.append(ghost);
  for (const f of next.lastMove.flipped) els.board.children[f].classList.add('would-flip');
  match.previewCaptures = next.lastMove.flipped.length;
  renderStatus();
}

function clearPlacementPreview() {
  for (const ghost of els.board.querySelectorAll('.ghost')) ghost.remove();
  for (const cell of els.board.querySelectorAll('.would-flip, .previewing')) cell.classList.remove('would-flip', 'previewing');
  if (match && match.previewCaptures !== null) {
    match.previewCaptures = null;
    renderStatus();
  }
}

function renderStatus() {
  const { state } = match;
  const over = isOver(state);
  els.status.disabled = !over;
  if (over) {
    const [p, o] = score(state.board);
    const lead = { win: 'You win', loss: 'You lose', draw: "It's a draw" }[outcome([p, o])];
    els.status.textContent = `${lead} ${p}–${o} · See results`;
  } else if (match.riteAiming) {
    els.status.textContent = RITE_PROMPTS[RITES_BY_ID[state.rites[PLAYER]].target];
  } else if (match.flipping) {
    els.status.textContent = 'Tossing for the first move…';
  } else if (state.turn === OPPONENT) {
    els.status.textContent = 'Opponent is thinking…';
  } else if (match.selected === null) {
    els.status.textContent = 'Your turn. Pick a card.';
  } else {
    const name = CARDS_BY_ID[state.hands[PLAYER][match.selected]].name;
    const captures = match.previewCaptures;
    if (captures !== null) {
      els.status.textContent = captures ? `${name}: captures ${captures} here` : `${name}: no captures here`;
    } else {
      const hints = els.board.querySelectorAll('.advantage-hint').length;
      els.status.textContent = `${name}: tap a square${hints ? '. Marked squares give it Advantage' : ''}`;
    }
  }
}

function selectCard(i) {
  if (!match || match.busy || match.state.turn !== PLAYER) return;
  if (match.riteAiming) return spendRite(i);
  match.selected = match.selected === i ? null : i;
  sfx.select();
  els.handP.querySelectorAll('.hand-slot').forEach((btn, idx) => {
    btn.setAttribute('aria-pressed', String(match.selected === idx));
  });
  clearPlacementPreview();
  renderAdvantageHints();
  renderStatus();
}

function onCellClick(cell) {
  if (!match || match.busy || match.state.turn !== PLAYER) return;
  if (match.riteAiming) return spendRite(cell);
  if (match.selected === null || match.state.board[cell] || match.state.blocked[cell]) return;
  play({ handIndex: match.selected, cell });
}

// A leaf of the pile for every card you have not drawn yet, stacked beside the board. It is the
// same information as "5 left to draw", but as something you watch go down.
function renderDrawPile() {
  const left = match.state.decks[PLAYER].length;
  const leaves = Array.from({ length: left }, (_, i) => {
    const back = cardBackEl();
    back.style.setProperty('--n', String(left - 1 - i));
    return back;
  });
  // The stack grows upward, so the box has to be tall enough to hold it.
  els.drawPile.style.setProperty('--stack', String(Math.max(0, left - 1)));
  els.drawPile.replaceChildren(
    ...leaves,
    el('span', 'draw-pile-count', left ? `${left} left to draw` : 'Pile empty'),
  );
  els.drawPile.classList.toggle('empty', left === 0);
}

// ---------- Rites ----------

const RITE_PROMPTS = {
  hand: 'Pick a card in your hand.',
  empty: 'Pick an open square.',
  blocked: 'Pick a square under stone.',
  placed: 'Pick one of the cards you played.',
  none: '',
};

// Where a Rite wants you to look: the board, or your own hand.
const aimsAtHand = (rite) => rite.target === 'hand';

// Each side's Rite sits beside that side's hand, as a token the size of a card in it.
function renderRiteBar() {
  const { state } = match;
  const rite = RITES_BY_ID[state.rites[PLAYER]];
  const spent = !riteReady(state, PLAYER);
  const targets = riteTargets(state, PLAYER);
  const yourTurn = state.turn === PLAYER && !match.busy && !isOver(state);

  els.riteBtn.replaceChildren(riteFaceEl(rite));
  els.riteBtn.classList.toggle('spent', spent);
  els.riteBtn.classList.toggle('aiming', Boolean(match.riteAiming));
  els.riteBtn.disabled = spent || !yourTurn || targets.length === 0;
  els.riteBtn.setAttribute('aria-label',
    spent ? `Your Rite, already used: ${rite.name}` : `Your Rite: ${rite.name}. ${rite.text}`);
  els.riteBtn.title = spent ? `${rite.name} — already used this match` : `${rite.name} — ${rite.text}`;

  const foe = RITES_BY_ID[state.rites[OPPONENT]];
  const foeSpent = !riteReady(state, OPPONENT);
  els.foeRite.replaceChildren(riteFaceEl(foe));
  els.foeRite.classList.toggle('spent', foeSpent);
  els.foeRite.setAttribute('aria-label',
    `Opponent's Rite${foeSpent ? ', already used' : ''}: ${foe.name}. ${foe.text}`);
  els.foeRite.title = `Opponent's Rite: ${foe.name} — ${foe.text}`;
}

function openRitePanel() {
  if (!match || match.busy || match.state.turn !== PLAYER) return;
  if (!riteReady(match.state, PLAYER)) return;
  const rite = RITES_BY_ID[match.state.rites[PLAYER]];
  const targets = riteTargets(match.state, PLAYER);
  if (targets.length === 0) return;

  const use = el('button', 'btn primary small', rite.target === 'none' ? 'Use it' : 'Choose a target');
  use.type = 'button';
  use.addEventListener('click', () => {
    closeRitePanel();
    if (rite.target === 'none') spendRite(null);
    else startAiming();
  });
  const cancel = el('button', 'btn small', 'Not yet');
  cancel.type = 'button';
  cancel.addEventListener('click', closeRitePanel);

  const actions = el('div', 'rite-actions');
  actions.append(use, cancel);
  els.ritePanel.replaceChildren(
    el('p', 'rite-panel-head', rite.name),
    el('p', 'rite-panel-text', rite.text),
    el('p', 'rite-panel-flavor', rite.flavor),
    el('p', 'rite-panel-once', 'Once a match, and it does not cost you your turn.'),
    actions,
  );
  els.ritePanel.hidden = false;
  use.focus();
}

function closeRitePanel() {
  els.ritePanel.hidden = true;
  els.ritePanel.replaceChildren();
}

function startAiming() {
  match.riteAiming = true;
  match.selected = null;
  clearPlacementPreview();
  render(); // render() re-marks the targets, since it rebuilds the squares
}

function stopAiming() {
  if (!match?.riteAiming) return;
  match.riteAiming = false;
  render();
}

// Outlines everything this Rite could be used on, so you can see the choice before you make it.
function markRiteTargets() {
  const { state } = match;
  const aiming = Boolean(match.riteAiming);
  const rite = RITES_BY_ID[state.rites[PLAYER]];
  const targets = aiming ? riteTargets(state, PLAYER) : [];
  const onHand = aiming && aimsAtHand(rite);
  els.board.classList.toggle('aiming', aiming && !onHand);
  els.handP.classList.toggle('aiming', onHand);

  // Each target's pulse starts a beat after the last, so the legal ones light up in a ripple
  // rather than blinking as one block. That movement is what reads as "pick one of these".
  const mark = (node, ok, order) => {
    node.classList.toggle('rite-target', ok);
    if (ok) node.style.setProperty('--aim-delay', `${order * 90}ms`);
    else node.style.removeProperty('--aim-delay');
  };
  els.handP.querySelectorAll('.hand-slot').forEach((slot, i) => {
    mark(slot, onHand && targets.includes(i), targets.indexOf(i));
    if (onHand) slot.disabled = !targets.includes(i);
  });
  [...els.board.children].forEach((cell, i) => {
    mark(cell, aiming && !onHand && targets.includes(i), targets.indexOf(i));
  });
}

function spendRite(target) {
  const { state } = match;
  if (!riteReady(state, PLAYER)) return stopAiming();
  if (!riteTargets(state, PLAYER).some((t) => t === target)) return;

  const rite = RITES_BY_ID[state.rites[PLAYER]];
  match.state = useRite(state, PLAYER, target);
  match.riteAiming = false;
  match.selected = null;
  sfx.advantage();
  render();
  showToast(`${rite.name}: ${rite.text}`);
  if (isOver(match.state)) finish();
}

// ---------- Rites in the Collection ----------

function renderRiteShelf(campaign) {
  const equipped = equippedRite(profile, { campaign });
  els.riteSlotHint.textContent =
    `One per match, free to use. ${campaign ? 'The Trail deck' : 'This deck'} carries ${RITES_BY_ID[equipped].name}.`;
  els.riteList.replaceChildren(...RITES.map((rite) => riteTile(rite, equipped, campaign)));
}

function riteTile(rite, equipped, campaign) {
  const owned = profile.rites.includes(rite.id);
  const price = ritePrice(rite.id);
  const tile = el('div', `rite-tile${owned ? '' : ' locked'}${rite.id === equipped ? ' equipped' : ''}`);
  // The emblem, at the size it appears in a match, so you pick by the mark you'll be looking at.
  const mark = el('div', 'rite-token rite-tile-mark');
  mark.append(riteFaceEl(rite));
  const body = el('div', 'rite-tile-body');
  body.append(el('p', 'rite-name', rite.name), el('p', 'rite-text', rite.text));
  tile.append(mark, body);

  const action = el('button', 'btn small', '');
  action.type = 'button';
  if (!owned) {
    action.textContent = `${price} amber`;
    action.classList.add('buy');
    action.disabled = profile.amber < price;
    action.title = action.disabled ? `Need ${price - profile.amber} more amber` : `Unlock ${rite.name}`;
    action.addEventListener('click', () => unlockRite(rite.id));
  } else if (rite.id === equipped) {
    action.textContent = 'Equipped \u2713';
    action.classList.add('in-deck');
    action.disabled = true;
  } else {
    action.textContent = 'Equip';
    action.addEventListener('click', () => {
      const { profile: next, error } = equipRite(profile, rite.id, { campaign });
      if (error) return;
      commit(next);
      sfx.select();
      refreshCollection();
    });
  }
  body.append(action);
  return tile;
}

function unlockRite(id) {
  const { profile: next, error } = buyRite(profile, id);
  if (error) return;
  commit(next);
  sfx.unlock();
  refreshCollection();
  showToast(`${RITES_BY_ID[id].name} unlocked`);
}

// ---------- Jungle Trail (campaign) ----------

function openTrail() {
  leaveMatch();
  renderTrail();
  showScreen('trail');
}

function startTrailStop(index) {
  const stop = TRAIL[index];
  startMatch({ mode: 'trail', seed: quickSeed(), level: stop.level, stopIndex: index });
}

function renderTrail() {
  els.trailBalance.textContent = profile.amber;
  const ready = isDeckReady(profile, { campaign: true });
  const { deck } = profile.campaign;
  els.trailHint.textContent = 'Beat each opponent to open the path to the next. Every stop bends the rules.';

  const points = totalPoints(profile);
  els.campaignCount.textContent = `${deck.length}/${DECK_SIZE}`;
  els.campaignCount.classList.toggle('incomplete', !ready);
  els.campaignHint.textContent = !ready
    ? `Add ${DECK_SIZE - deck.length} more cards to walk the Trail.`
    : points
      ? `You have ${points} upgrade point${points === 1 ? '' : 's'} to spend.`
      : 'Every Trail win gives all 10 of these cards XP. Each level earns a point for Attack or Defense.';
  els.campaignEdit.classList.toggle('primary', points > 0);
  els.campaignStrip.replaceChildren(...Array.from({ length: DECK_SIZE }, (_, i) => {
    const id = deck[i];
    if (!id) return el('div', 'deck-slot empty');
    const slot = el('div', 'deck-slot');
    slot.append(cardEl(id, campaignView(id)));
    return slot;
  }));

  els.trailList.replaceChildren(...TRAIL.map((stop, i) => {
    const cleared = i < profile.trail;
    const open = i <= profile.trail;
    const item = el('li', `trail-stop${cleared ? ' cleared' : ''}${open ? '' : ' locked'}`);

    const face = el('div', 'trail-face');
    face.append(cardEl(stop.hand[0], { stats: trailStats(i, stop.hand)[stop.hand[0]] }));

    const body = el('div', 'trail-body');
    body.append(
      el('p', 'trail-meta', `Stop ${i + 1} · ${LEVEL_LABELS[stop.level]} · +${WIN_XP[stop.level]} XP per win`),
      el('h3', null, stop.place),
      el('p', null, `Opponent: ${stop.foe}`),
    );
    for (const id of stop.twists) {
      const twist = el('p', 'trail-twist');
      twist.append(el('b', null, TWISTS[id].name), ` ${TWISTS[id].text}`);
      body.append(twist);
    }
    const reward = stop.reward.card
      ? `${CARDS_BY_ID[stop.reward.card].name} (${RARITY_LABELS[CARDS_BY_ID[stop.reward.card].rarity]} card)`
      : `${stop.reward.amber} amber`;
    body.append(el('p', 'trail-reward', cleared ? 'Cleared ✓' : `Reward: ${reward}`));

    const action = el('button', `btn small${cleared ? '' : ' primary'}`, cleared ? 'Replay' : open ? 'Fight' : 'Locked');
    action.type = 'button';
    action.disabled = !open || !ready;
    action.addEventListener('click', () => startTrailStop(i));

    item.append(face, body, action);
    return item;
  }));
  refreshCardPreview();
}

// ---------- Trophies ----------

function openTrophies() {
  const have = new Set(profile.achievements);
  els.trophySummary.textContent = `${have.size} of ${ACHIEVEMENTS.length} earned`;
  els.trophyList.replaceChildren(...ACHIEVEMENTS.map((a) => {
    const item = el('li', `trophy${have.has(a.id) ? ' done' : ''}`);
    item.append(el('strong', null, a.name), el('span', 'trophy-amber', `+${a.amber} amber`), el('span', 'trophy-text', a.text));
    return item;
  }));
  els.trophiesDialog.showModal();
}

// ---------- Packs ----------

function openPacks(mode) {
  leaveMatch();
  packsMode = mode;
  pickedPack = null;
  renderPacks();
  showScreen('packs');
}

function renderPacks() {
  const start = packsMode === 'start';
  const list = start ? STARTER_PACKS : PACKS;
  els.packsBalance.textContent = profile.amber;
  els.packsBack.hidden = start; // the opening choice has nowhere to go back to
  els.packsTitle.textContent = start ? 'Choose your pack' : 'Card Packs';
  els.packsIntro.textContent = start
    ? 'Every pack is a deck you can play right away. Pick the one you like the look of — the others go on sale for amber once you start.'
    : 'Themed bundles, a quarter off the single-card price. You only pay for the cards you’re missing.';
  els.packsFooter.hidden = !start;
  if (start) els.packList.setAttribute('role', 'radiogroup');
  else els.packList.removeAttribute('role');
  els.packList.setAttribute('aria-label', start ? 'Starter packs' : 'Card packs');

  els.packList.replaceChildren(...list.map((pack) => packPanel(pack, start)));
  renderPackConfirm();
  refreshCardPreview();
}

function packPanel(pack, start) {
  const missing = packMissing(pack.id, profile.owned);
  const panel = el('div', `pack pack-${pack.color}${pickedPack === pack.id ? ' picked' : ''}${!start && missing.length === 0 ? ' complete' : ''}`);

  const head = el('div', 'pack-head');
  head.append(el('h3', null, pack.name), el('p', 'pack-tagline', pack.tagline));
  panel.append(head, el('p', 'pack-meta', packMeta(pack, start, missing)), el('p', 'pack-about', pack.about));

  if (start) {
    panel.append(
      el('p', 'pack-label', `Your opening deck · ${DECK_SIZE} cards`),
      packCardRow(pack.cards.slice(0, DECK_SIZE)),
    );
    const spares = pack.cards.slice(DECK_SIZE);
    if (spares.length) {
      panel.append(el('p', 'pack-label', 'Spares, to swap in later'), packCardRow(spares));
    }
    panel.dataset.packId = pack.id;
    panel.setAttribute('role', 'radio');
    panel.setAttribute('aria-checked', String(pickedPack === pack.id));
    panel.tabIndex = 0;
    // Selecting only moves the highlight, so the cards don't rebuild under the player's finger.
    const pick = () => {
      if (pickedPack === pack.id) return;
      pickedPack = pack.id;
      sfx.select();
      for (const node of els.packList.children) {
        const on = node.dataset.packId === pack.id;
        node.classList.toggle('picked', on);
        node.setAttribute('aria-checked', String(on));
      }
      renderPackConfirm();
    };
    panel.addEventListener('click', pick);
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });
  } else {
    panel.append(packCardRow(pack.cards, new Set(profile.owned)));
    const price = packPrice(pack.id, profile.owned);
    const action = el('button', 'btn small', missing.length === 0 ? 'Complete ✓' : `${price} amber`);
    action.type = 'button';
    if (missing.length === 0) {
      action.classList.add('in-deck');
      action.disabled = true;
      action.title = 'You own every card in this pack';
    } else {
      action.classList.add('buy');
      action.disabled = profile.amber < price;
      action.title = action.disabled
        ? `Need ${price - profile.amber} more amber`
        : `Trade ${price} amber for ${missing.length} card${missing.length === 1 ? '' : 's'}`;
      action.addEventListener('click', () => purchasePack(pack.id));
    }
    panel.append(action);
  }
  return panel;
}

function packMeta(pack, start, missing) {
  const rarities = packRarities(pack.id);
  const bits = [`${pack.cards.length} cards`];
  bits.push(RARITIES.filter((r) => rarities[r]).reverse().map((r) => `${rarities[r]} ${RARITY_LABELS[r]}`).join(', '));
  bits.push(COLORS
    .filter((c) => pack.cards.some((id) => CARDS_BY_ID[id].color === c))
    .map((c) => `${pack.cards.filter((id) => CARDS_BY_ID[id].color === c).length} ${COLOR_NAMES[c]}`)
    .join(', '));
  if (!start) bits.push(missing.length === 0 ? 'all owned' : `${missing.length} new to you`);
  return bits.join(' · ');
}

const packCols = (n) => (n <= 5 ? n : [5, 7, 6, 4, 3].find((cols) => n % cols === 0) ?? 5);

function packCardRow(ids, owned = null) {
  const row = el('div', 'pack-cards');
  // Rows of five, or whatever divides the pack evenly, so it never ends on a ragged line:
  // a 14-card deck reads as 7 x 2, a six-card pack as 3 x 2.
  row.style.setProperty('--pack-cols', packCols(ids.length));
  row.append(...ids.map((id) => {
    const slot = el('div', `pack-card${owned?.has(id) ? ' owned' : ''}`);
    slot.append(cardEl(id));
    if (owned?.has(id)) slot.append(el('span', 'pack-owned', 'Owned'));
    return slot;
  }));
  return row;
}

function renderPackConfirm() {
  const pack = PACKS_BY_ID[pickedPack];
  els.packConfirm.disabled = !pack;
  els.packConfirm.textContent = pack ? `Begin with ${pack.name}` : 'Pick a pack';
}

function takePack() {
  const { profile: next, error } = choosePack(profile, pickedPack);
  if (error) return showToast(error);
  const pack = PACKS_BY_ID[pickedPack];
  commit(next);
  sfx.unlock();
  showToast(`${pack.name} · ${pack.cards.length} cards are yours. Your deck is ready.`);
  renderHome();
  maybeShowHowto();
}

// First-timers get the rules once, after they have a deck in hand.
function maybeShowHowto() {
  if (!hasStarted(profile) || setting.get('seenHowto', false)) return;
  setting.set('seenHowto', true);
  els.howtoDialog.showModal();
}

function purchasePack(id) {
  const { profile: bought, cards, error } = buyPack(profile, id);
  if (error) return showToast(error);
  const { profile: next, unlocked } = checkAchievements(bought);
  commit(next);
  renderPacks();
  announceAchievements(unlocked);
  revealCards(cards, `${PACKS_BY_ID[id].name} pack`);
}

// ---------- Collection & decks ----------

function openCollection(mode = 'duel', from = 'home') {
  collectionMode = mode;
  collectionReturn = from;
  renderCollection();
  showScreen('collection');
}

function renderCollection() {
  const campaign = collectionMode === 'campaign';
  els.collectionBalance.textContent = profile.amber;
  const openPacksCount = PACKS.filter((pack) => packMissing(pack.id, profile.owned).length > 0).length;
  els.packsCount.textContent = openPacksCount ? `${openPacksCount} available` : 'all collected';
  for (const btn of document.querySelectorAll('[data-deck-mode]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.deckMode === collectionMode));
  }

  const deck = campaign ? profile.campaign.deck : profile.deck;
  els.deckTitle.textContent = campaign ? 'Campaign deck' : 'Duel deck';
  els.deckCount.textContent = `${deck.length}/${DECK_SIZE}`;
  els.deckCount.classList.toggle('incomplete', deck.length !== DECK_SIZE);
  const colorMix = COLORS
    .map((c) => `${deck.filter((id) => CARDS_BY_ID[id].color === c).length} ${COLOR_NAMES[c]}`)
    .join(', ');
  const points = totalPoints(profile);
  if (deck.length !== DECK_SIZE) {
    els.deckHint.textContent = `Add ${DECK_SIZE - deck.length} more to play ${campaign ? 'the Jungle Trail' : 'Quick Matches'}.`;
  } else if (campaign) {
    els.deckHint.textContent = `For the Jungle Trail · ${colorMix}. Cards level up as you win there` +
      `${points ? `, and you have ${points} upgrade point${points === 1 ? '' : 's'} to spend: open a card to raise it` : ''}.`;
  } else {
    els.deckHint.textContent = `For Quick Matches · power ${deck.reduce((sum, id) => sum + cardPower(id), 0)} · ${colorMix}. ` +
      `Numbers are fixed. Each match you bring ${MATCH_CARDS} of these.`;
  }

  els.deckStrip.replaceChildren(...Array.from({ length: DECK_SIZE }, (_, i) => {
    const id = deck[i];
    if (!id) return el('div', 'deck-slot empty');
    const slot = el('div', 'deck-slot');

    // Tapping the card opens it, where you can read it, upgrade it, or take it out.
    const face = el('button', 'deck-slot-face');
    face.type = 'button';
    const points = campaign ? cardProgress(profile, id).points : 0;
    face.setAttribute('aria-label',
      `${CARDS_BY_ID[id].name}. Open${points ? `, ${points} upgrade point${points === 1 ? '' : 's'} to spend` : ''}`);
    face.append(cardEl(id, campaign ? campaignView(id) : {}));
    face.addEventListener('click', () => openCardDetail(id));

    // Taking it out is deliberate: its own button, never the card itself.
    const drop = el('button', 'deck-drop', '✕');
    drop.type = 'button';
    drop.title = `Take ${CARDS_BY_ID[id].name} out of the deck`;
    drop.setAttribute('aria-label', `Take ${CARDS_BY_ID[id].name} out of the deck`);
    drop.addEventListener('click', () => changeDeck(id));

    slot.append(face, drop);
    if (points > 0) slot.append(el('span', 'deck-points', String(points)));
    return slot;
  }));

  for (const btn of document.querySelectorAll('[data-filter]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.filter === collectionFilter));
  }
  for (const btn of document.querySelectorAll('[data-color]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.color === collectionColor));
  }

  const owned = new Set(profile.owned);
  const cards = CARDS
    .filter((c) => collectionFilter === 'all' || (collectionFilter === 'owned') === owned.has(c.id))
    .filter((c) => collectionColor === 'all' || c.color === collectionColor)
    .sort((a, b) =>
      Number(isNewCard(b.id)) - Number(isNewCard(a.id)) ||
      Number(owned.has(b.id)) - Number(owned.has(a.id)) ||
      RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) ||
      cardPower(b.id) - cardPower(a.id));

  renderRiteShelf(campaign);
  els.cardGrid.replaceChildren(...cards.map((card) => collectionTile(card, owned.has(card.id))));
  refreshCardPreview();
}

const activeDeck = () => (collectionMode === 'campaign' ? profile.campaign.deck : profile.deck);

function collectionTile(card, isOwned) {
  const campaign = collectionMode === 'campaign';
  const tile = el('div', `tile${isOwned ? '' : ' locked'}${activeDeck().includes(card.id) ? ' in-deck' : ''}${isNewCard(card.id) ? ' is-new' : ''}`);
  if (isNewCard(card.id)) tile.append(el('span', 'new-badge', 'New'));
  const face = el('button', 'tile-face');
  face.type = 'button';
  face.setAttribute('aria-label', `${card.name}, ${RARITY_LABELS[card.rarity]}. View details`);
  face.append(cardEl(card.id, campaign ? campaignView(card.id) : {}));
  face.addEventListener('click', () => openCardDetail(card.id));

  const action = el('button', 'btn small tile-action');
  action.type = 'button';
  configureCardAction(action, card.id);

  tile.append(face, el('span', 'tile-name', card.name), el('span', `tile-rarity rarity-text-${card.rarity}`, RARITY_LABELS[card.rarity]));
  const points = campaign && isOwned ? cardProgress(profile, card.id).points : 0;
  if (points > 0) tile.append(el('span', 'points-badge', `${points} point${points === 1 ? '' : 's'} to spend`));
  tile.append(action);
  return tile;
}

function configureCardAction(btn, id) {
  const price = PRICES[CARDS_BY_ID[id].rarity];
  const deck = activeDeck();
  btn.classList.remove('buy', 'in-deck');
  if (!profile.owned.includes(id)) {
    btn.textContent = `${price} amber`;
    btn.classList.add('buy');
    btn.disabled = profile.amber < price;
    btn.title = btn.disabled ? `Need ${price - profile.amber} more amber` : `Trade ${price} amber for this card`;
    btn.onclick = () => purchase(id);
  } else if (deck.includes(id)) {
    // On a tile this reads as a status badge; in the open card it is a plain instruction.
    btn.textContent = btn === els.cardDialogAction ? 'Take out of deck' : 'In deck ✓';
    btn.classList.add('in-deck');
    btn.disabled = false;
    btn.title = 'Take out of the deck';
    btn.onclick = () => changeDeck(id);
  } else {
    btn.textContent = '+ Deck';
    btn.disabled = deck.length >= DECK_SIZE;
    btn.title = btn.disabled ? 'Deck is full. Remove a card first' : 'Add to deck';
    btn.onclick = () => changeDeck(id);
  }
}

function purchase(id) {
  const { profile: bought, error } = buyCard(profile, id);
  if (error) return;
  const { profile: next, unlocked } = checkAchievements(bought);
  commit(next);
  refreshCollection();
  announceAchievements(unlocked);
  revealCards([id], `Traded for ${PRICES[CARDS_BY_ID[id].rarity]} amber`);
}

function changeDeck(id) {
  const { profile: next, error } = toggleDeckCard(profile, id, { campaign: collectionMode === 'campaign' });
  if (error) return;
  commit(next);
  refreshCollection();
}

function upgradeStat(id, stat) {
  const { profile: upgraded, error } = spendPoint(profile, id, stat);
  if (error) return;
  const { profile: next, unlocked } = checkAchievements(upgraded);
  commit(next);
  sfx.advantage();
  refreshCollection();
  announceAchievements(unlocked);
}

function refreshCollection() {
  renderCollection();
  if (els.cardDialog.open) renderCardDetail();
}

function openCardDetail(id) {
  detailCardId = id;
  if (isNewCard(id)) {
    commit({ ...profile, newCards: profile.newCards.filter((c) => c !== id) });
    renderCollection();
  }
  renderCardDetail();
  if (!els.cardDialog.open) els.cardDialog.showModal();
}

function renderCardDetail() {
  const card = CARDS_BY_ID[detailCardId];
  const owned = profile.owned.includes(card.id);
  const campaign = collectionMode === 'campaign';
  els.cardDialogCard.replaceChildren(cardEl(card.id, campaign ? campaignView(card.id) : {}));
  els.cardDialogCard.classList.toggle('locked', !owned);
  els.cardDialogRarity.textContent = `${COLOR_NAMES[card.color]} · ${RARITY_LABELS[card.rarity]}`;
  els.cardDialogRarity.className = `rarity-label rarity-text-${card.rarity}`;
  els.cardDialogName.textContent = card.name;
  els.cardDialogAbility.replaceChildren(abilityBlock(card.id));
  renderUpgrade(card.id, campaign && owned);
  els.cardDialogFlavor.textContent = card.flavor;
  configureCardAction(els.cardDialogAction, card.id);
  if (!owned) els.cardDialogAction.textContent = `Trade ${PRICES[card.rarity]} amber`;
}

// Level, XP, and upgrade buttons for a campaign card.
function renderUpgrade(id, show) {
  const box = els.cardDialogUpgrade;
  box.hidden = !show;
  if (!show) {
    box.replaceChildren();
    return;
  }
  const progress = cardProgress(profile, id);
  const stats = campaignStats(profile, id);
  const maxed = progress.nextLevelXp === null;

  const head = el('p', 'upgrade-head');
  head.append(
    el('span', 'upgrade-level', `Level ${progress.level}${maxed ? ' · max' : ''}`),
    el('span', 'upgrade-points', `${progress.points} point${progress.points === 1 ? '' : 's'} to spend`),
  );
  const bar = el('div', 'xp-bar');
  const fill = el('span');
  fill.style.width = maxed
    ? '100%'
    : `${((progress.xp - progress.levelStartXp) / (progress.nextLevelXp - progress.levelStartXp)) * 100}%`;
  bar.append(fill);
  const xpText = maxed
    ? `${progress.xp} XP`
    : `${progress.xp - progress.levelStartXp} / ${progress.nextLevelXp - progress.levelStartXp} XP to level ${progress.level + 1}`;

  const buttons = el('div', 'upgrade-buttons');
  STAT_LABELS.forEach((label, stat) => {
    const btn = el('button', 'btn small', `${label} +1`);
    btn.type = 'button';
    btn.disabled = progress.points <= 0 || stats[stat] >= MAX_STAT;
    btn.setAttribute('aria-label', `Raise ${label} to ${stats[stat] + 1}`);
    btn.addEventListener('click', () => upgradeStat(id, stat));
    buttons.append(btn);
  });

  const card = CARDS_BY_ID[id];
  box.replaceChildren(
    head, bar, el('p', 'upgrade-xp', xpText), buttons,
    el('p', 'upgrade-note', `Campaign: Attack ${stats[0]}, Defense ${stats[1]}. Duels always use Attack ${card.atk}, Defense ${card.def}.`),
  );
}

// ---------- New card reveal ----------

let unlockQueue = [];
let unlockDone = null;
let unlockTotal = 0;

// Shows each card in turn: it rises face down, flips over, then its name and ability appear.
// Resolves once the player has seen them all.
function revealCards(cardIds, source = '') {
  return new Promise((resolve) => {
    unlockQueue = cardIds.map((id) => ({ id, source }));
    unlockTotal = unlockQueue.length;
    unlockDone = resolve;
    showNextUnlock();
  });
}

function showNextUnlock() {
  const next = unlockQueue.shift();
  if (!next) {
    if (els.unlockDialog.open) els.unlockDialog.close();
    const done = unlockDone;
    unlockDone = null;
    done?.();
    return;
  }
  const card = CARDS_BY_ID[next.id];
  const position = unlockTotal - unlockQueue.length;
  els.unlockDialog.dataset.rarity = card.rarity;
  els.unlockEyebrow.textContent = `New ${RARITY_LABELS[card.rarity]} card${unlockTotal > 1 ? ` · ${position} of ${unlockTotal}` : ''}`;
  els.unlockFront.replaceChildren(cardEl(card.id));
  els.unlockRarity.textContent = `${COLOR_NAMES[card.color]} · ${RARITY_LABELS[card.rarity]}`;
  els.unlockName.textContent = card.name;
  els.unlockAbility.replaceChildren(abilityBlock(card.id));
  els.unlockSource.textContent = next.source;
  els.unlockSource.hidden = !next.source;
  els.unlockNext.textContent = unlockQueue.length ? 'Next card' : 'Continue';
  configureUnlockDeckButton(card.id);

  // Restart the reveal animation for each card.
  els.unlockDialog.classList.remove('revealing');
  void els.unlockDialog.offsetWidth;
  els.unlockDialog.classList.add('revealing');
  setTimeout(() => sfx.unlock(), 650);
  if (!els.unlockDialog.open) els.unlockDialog.showModal();
}

// Offers to put the new card straight into whichever deck has room (Duel first).
function configureUnlockDeckButton(id) {
  const btn = els.unlockDeck;
  const duelRoom = profile.deck.length < DECK_SIZE && !profile.deck.includes(id);
  const campaignRoom = profile.campaign.deck.length < DECK_SIZE && !profile.campaign.deck.includes(id);
  btn.hidden = !(duelRoom || campaignRoom);
  btn.disabled = false;
  btn.textContent = duelRoom ? 'Add to Duel deck' : 'Add to Campaign deck';
  btn.onclick = () => {
    const { profile: next, error } = toggleDeckCard(profile, id, { campaign: !duelRoom });
    if (error) return;
    commit(next);
    btn.textContent = 'Added ✓';
    btn.disabled = true;
    if (!$('collection').hidden) renderCollection();
  };
}

// ---------- Wiring ----------

els.dailyBtn.addEventListener('click', () => {
  const key = todayKey();
  startMatch({ mode: 'daily', seed: `daily-${key}`, level: DAILY_LEVEL, dailyKey: key });
});
els.riteBtn.addEventListener('click', () => (match?.riteAiming ? stopAiming() : openRitePanel()));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (match?.riteAiming) stopAiming();
  else if (!els.ritePanel.hidden) closeRitePanel();
});
els.quickBtn.addEventListener('click', () => startMatch({ mode: 'quick', seed: quickSeed(), level: quickLevel }));
els.challengeBtn.addEventListener('click', () => {
  challengeFirst = false; // once it's been played, new players go on to pick a pack
  startMatch({ mode: 'challenge', seed: incomingChallenge.seed, level: incomingChallenge.level, challenge: incomingChallenge });
});
for (const btn of document.querySelectorAll('.difficulty button')) {
  btn.addEventListener('click', () => {
    quickLevel = btn.dataset.level;
    setting.set('level', quickLevel);
    renderHome();
  });
}
els.collectionBtn.addEventListener('click', () => openCollection('duel', 'home'));
els.packsBtn.addEventListener('click', () => openPacks('shop'));
els.packsBack.addEventListener('click', () => openCollection(collectionMode, collectionReturn));
els.packConfirm.addEventListener('click', takePack);
els.collectionBack.addEventListener('click', () => {
  // Leaving the Collection counts as having seen the highlighted new cards.
  if (profile.newCards.length) commit({ ...profile, newCards: [] });
  if (collectionReturn === 'trail') openTrail();
  else renderHome();
});
els.trailBtn.addEventListener('click', openTrail);
els.trailBack.addEventListener('click', renderHome);
els.campaignEdit.addEventListener('click', () => openCollection('campaign', 'trail'));
els.trophiesBtn.addEventListener('click', openTrophies);
for (const btn of document.querySelectorAll('[data-deck-mode]')) {
  btn.addEventListener('click', () => {
    collectionMode = btn.dataset.deckMode;
    renderCollection();
  });
}
for (const btn of document.querySelectorAll('[data-filter]')) {
  btn.addEventListener('click', () => {
    collectionFilter = btn.dataset.filter;
    renderCollection();
  });
}
for (const btn of document.querySelectorAll('[data-color]')) {
  btn.addEventListener('click', () => {
    collectionColor = btn.dataset.color;
    renderCollection();
  });
}
for (const btn of document.querySelectorAll('[data-sound-toggle]')) {
  btn.addEventListener('click', () => {
    setMuted(!isMuted());
    setting.set('muted', isMuted());
    renderSoundButtons();
    sfx.select();
  });
}

els.howtoBtn.addEventListener('click', () => els.howtoDialog.showModal());
els.quitBtn.addEventListener('click', () => (match?.mode === 'trail' ? openTrail() : goHome()));
els.status.addEventListener('click', showResult);
els.shareBtn.addEventListener('click', shareResult);
els.imageBtn.addEventListener('click', saveImage);
els.rematchBtn.addEventListener('click', rematch);
els.homeBtn.addEventListener('click', goHome);
els.unlockNext.addEventListener('click', showNextUnlock);
els.unlockDialog.addEventListener('cancel', (e) => {
  // Escape moves on rather than closing mid-queue, so a waiting results screen still continues.
  e.preventDefault();
  showNextUnlock();
});
els.nameInput.addEventListener('change', () => setting.set('name', els.nameInput.value.trim().slice(0, 20)));
for (const btn of document.querySelectorAll('[data-close]')) {
  btn.addEventListener('click', () => btn.closest('dialog').close());
}

setMuted(setting.get('muted', false) === true);
renderSoundButtons();
initCardPreview(els.cardPreview);

// Trophies earned before they existed (a collection, a streak) are granted on load.
{
  const { profile: next, unlocked } = checkAchievements(profile);
  if (unlocked.length) {
    commit(next);
    setTimeout(() => showToast(trophyText(unlocked)), 800);
  }
}

// Don't let a slow or missing art manifest hold up the game.
await Promise.race([loadArtManifest(), new Promise((resolve) => setTimeout(resolve, 1500))]);
renderHome();
window.__vineboundReady = true;
maybeShowHowto();
