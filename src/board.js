// Board geometry: a 5×5 grid, eight directions, and named zones. Shared by the rules, AI, and UI.
export const SIZE = 5;
export const CELLS = SIZE * SIZE;

// Clockwise from straight up.
export const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const DIR_INDEX = Object.fromEntries(DIRS.map((d, i) => [d, i]));
const OFFSETS = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];

export const opposite = (dir) => (dir + 4) % 8;

// NEIGHBOR[cell][dir] is the cell next to `cell` in that direction, or -1 off the board.
export const NEIGHBOR = Array.from({ length: CELLS }, (_, cell) => OFFSETS.map(([dr, dc]) => {
  const row = Math.floor(cell / SIZE) + dr;
  const col = (cell % SIZE) + dc;
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE ? row * SIZE + col : -1;
}));

export const neighborsOf = (cell) => NEIGHBOR[cell].filter((n) => n >= 0);

// Zones are derived from SIZE rather than listed, so they follow the board if it ever changes
// again: the four corners, the rest of the rim, and everything the rim encloses.
const ALL_CELLS = Array.from({ length: CELLS }, (_, i) => i);
const onRim = (cell) => {
  const row = Math.floor(cell / SIZE);
  const col = cell % SIZE;
  return row === 0 || row === SIZE - 1 || col === 0 || col === SIZE - 1;
};
const isCorner = (cell) => {
  const row = Math.floor(cell / SIZE);
  const col = cell % SIZE;
  return (row === 0 || row === SIZE - 1) && (col === 0 || col === SIZE - 1);
};

export const ZONES = {
  corners: ALL_CELLS.filter(isCorner),
  edges: ALL_CELLS.filter((cell) => onRim(cell) && !isCorner(cell)),
  center: ALL_CELLS.filter((cell) => !onRim(cell)),
  all: ALL_CELLS,
};

// A card's arrows are stored as a bitmask over DIRS.
export const arrowMask = (dirs) => dirs.reduce((mask, d) => mask | (1 << DIR_INDEX[d]), 0);
export const hasArrow = (mask, dir) => (mask & (1 << dir)) !== 0;
