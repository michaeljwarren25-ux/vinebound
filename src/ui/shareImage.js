// Draws a finished match as a 1200x630 image (the standard link-preview size) for sharing.
import { CARDS_BY_ID } from '../cards.js';
import { SIZE } from '../board.js';

const W = 1200;
const H = 630;
const CARD_COLORS = { green: ['#6e9b4e', '#0c1c0b'], red: ['#c26a4c', '#220a06'], blue: ['#6194b8', '#07121f'] };
const OWNER_BORDERS = ['#6fd896', '#ec6f52'];
const DISPLAY_FONT = '"IM Fell English SC", Georgia, serif';
const SYMBOL_FONT = '"Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", serif';

function roundedRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

/** Resolves to a PNG Blob of the final board, the result, and a challenge line. */
export async function resultImage({ board, blocked = [], title, score: [p, o], name = '', host = '' }) {
  try {
    await document.fonts.load(`64px ${DISPLAY_FONT}`);
  } catch {}

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  const bg = g.createRadialGradient(W * 0.3, H * 0.2, 40, W * 0.5, H * 0.5, 900);
  bg.addColorStop(0, '#18241a');
  bg.addColorStop(1, '#040604');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // The 5×5 board: a stone slab on the right. The squares are sized so five rows still clear
  // the top and bottom of the card, and keep the 4:5 shape the cards have in the game.
  const cw = 82;
  const ch = 103;
  const gap = 8;
  const bw = cw * SIZE + gap * (SIZE - 1);
  const bh = ch * SIZE + gap * (SIZE - 1);
  const bx = W - 80 - bw;
  const by = (H - bh) / 2;
  roundedRect(g, bx - 14, by - 14, bw + 28, bh + 28, 12);
  g.fillStyle = '#1c2119';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = '#343c2f';
  g.stroke();

  board.forEach((slot, i) => {
    const x = bx + (i % SIZE) * (cw + gap);
    const y = by + Math.floor(i / SIZE) * (ch + gap);
    if (blocked[i]) {
      roundedRect(g, x, y, cw, ch, 7);
      g.fillStyle = '#2c2c25';
      g.fill();
      g.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + cw * 0.25, y + ch * 0.2);
      g.lineTo(x + cw * 0.55, y + ch * 0.55);
      g.lineTo(x + cw * 0.45, y + ch * 0.85);
      g.stroke();
      return;
    }
    if (!slot) {
      roundedRect(g, x, y, cw, ch, 7);
      g.fillStyle = '#0a0d09';
      g.fill();
      return;
    }
    const card = CARDS_BY_ID[slot.cardId];
    const [light, dark] = CARD_COLORS[card.color];
    const body = g.createRadialGradient(x + cw / 2, y + ch * 0.42, 6, x + cw / 2, y + ch / 2, ch * 0.75);
    body.addColorStop(0, light);
    body.addColorStop(1, dark);
    roundedRect(g, x, y, cw, ch, 7);
    g.fillStyle = body;
    g.fill();

    g.lineWidth = 7;
    g.strokeStyle = OWNER_BORDERS[slot.owner];
    roundedRect(g, x + 3.5, y + 3.5, cw - 7, ch - 7, 5);
    g.stroke();

    g.fillStyle = 'rgba(236, 231, 210, 0.9)';
    g.font = `38px ${SYMBOL_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${card.sigil}︎`, x + cw / 2, y + ch / 2);
  });

  // Text on the left.
  const result = p > o ? 'Victory' : p < o ? 'Defeat' : 'Draw';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#cdd6bb';
  g.font = `76px ${DISPLAY_FONT}`;
  g.fillText('Vinebound', 70, 140);
  g.fillStyle = '#8d9c86';
  g.font = `34px ${DISPLAY_FONT}`;
  g.fillText(title, 74, 192);

  g.fillStyle = result === 'Victory' ? '#7fb069' : result === 'Defeat' ? '#e08a70' : '#d9c28a';
  g.font = `68px ${DISPLAY_FONT}`;
  g.fillText(result, 70, 320);
  g.fillStyle = '#dfe5d2';
  g.font = 'bold 110px Georgia, serif';
  g.fillText(`${p}–${o}`, 66, 440);

  g.fillStyle = '#b9c4ad';
  g.font = `32px ${DISPLAY_FONT}`;
  g.fillText(name ? `${name} challenges you.` : 'Can you beat this board?', 74, 525);
  if (host) {
    g.fillStyle = '#6f7d69';
    g.font = '24px Georgia, serif';
    g.fillText(host, 74, 568);
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
