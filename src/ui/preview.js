// Card preview: hover a card (or press and hold on touch) to see it large, with its ability.
import { CARDS_BY_ID } from '../cards.js';
import { COLOR_NAMES } from '../abilities.js';
import { RARITY_LABELS, abilityBlock } from './cardView.js';

const HOLD_MS = 400;
const GAP = 14;
const MARGIN = 8;

let panel = null;
let current = null;
let pointer = null; // last pointer position, to find the card again after a re-render
let holdTimer = 0;
let holdStart = null;
let swallowClick = false;

function node(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

// Cards inside dialogs already show their details, so they don't get a preview.
function targetCard(target) {
  const card = target instanceof Element ? target.closest('.card') : null;
  return card && !card.closest('dialog, .card-preview') ? card : null;
}

function show(card) {
  current = card;
  const info = CARDS_BY_ID[card.dataset.cardId];
  const big = card.cloneNode(true);
  big.classList.remove('placed', 'flipped', 'turning', 'held');
  const face = node('div', 'preview-face');
  face.append(big);

  const meta = node('p', 'preview-meta');
  meta.append(node('span', `kin-dot color-${info.color}`), `${COLOR_NAMES[info.color]} · ${RARITY_LABELS[info.rarity]}`);
  const onBoard = Boolean(card.closest('.cell'));

  panel.replaceChildren(
    face,
    meta,
    node('h3', 'preview-name', info.name),
    abilityBlock(info.id, onBoard ? card.classList.contains('advantaged') : null),
    node('p', 'preview-flavor', info.flavor),
  );
  panel.hidden = false;
  place(card.getBoundingClientRect());
}

function hide() {
  current = null;
  if (panel) panel.hidden = true;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

// Beside the card when there's room, otherwise above or below it (phones).
function place(rect) {
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  let left = rect.right + GAP;
  let top = rect.top + rect.height / 2 - h / 2;
  if (left + w > vw - MARGIN) left = rect.left - GAP - w;
  if (left < MARGIN) {
    left = rect.left + rect.width / 2 - w / 2;
    top = rect.top - GAP - h >= MARGIN ? rect.top - GAP - h : rect.bottom + GAP;
  }
  panel.style.left = `${clamp(left, MARGIN, vw - w - MARGIN)}px`;
  panel.style.top = `${clamp(top, MARGIN, vh - h - MARGIN)}px`;
}

function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = 0;
}

export function initCardPreview(panelEl) {
  panel = panelEl;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    pointer = { x: e.clientX, y: e.clientY };
    const card = targetCard(e.target);
    if (card === current) return;
    if (card) show(card);
    else hide();
  });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') {
      pointer = { x: e.clientX, y: e.clientY };
    } else if (holdTimer && Math.hypot(e.clientX - holdStart.x, e.clientY - holdStart.y) > 10) {
      cancelHold();
    }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'touch' && !e.relatedTarget) hide();
  });

  // Touch: press and hold to peek, release to close.
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    swallowClick = false;
    const card = targetCard(e.target);
    if (!card) return;
    holdStart = { x: e.clientX, y: e.clientY };
    cancelHold();
    holdTimer = setTimeout(() => {
      holdTimer = 0;
      pointer = holdStart;
      swallowClick = true;
      show(card);
    }, HOLD_MS);
  });
  const release = (e) => {
    if (e.pointerType !== 'touch') return;
    cancelHold();
    if (current) hide();
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);

  // A hold shouldn't also select, buy, or open the menu for the card underneath.
  document.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  document.addEventListener('contextmenu', (e) => {
    if (swallowClick || holdTimer) e.preventDefault();
  });
  window.addEventListener('scroll', hide, { passive: true });
}

// Call after re-rendering: the hovered card element may have been replaced.
export function refreshCardPreview() {
  if (!current || !panel) return;
  const card = pointer && targetCard(document.elementFromPoint(pointer.x, pointer.y));
  if (card) show(card);
  else hide();
}
