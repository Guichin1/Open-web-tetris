/**
 * scoring.js
 * Guideline-compliant scoring: singles/doubles/triples/tetrises,
 * T-Spin and all-spin variants, Back-to-Back, combos, soft/hard drop points.
 */

/**
 * Base score table per line count × tspin type (before level multiplier).
 */
const SCORE_TABLE = {
  // [linesCleared][tspinType]
  // tspinType: 'none' | 'mini' | 'tspin'
  0: { none: 0,    mini: 400,  tspin: 400  },
  1: { none: 100,  mini: 200,  tspin: 800  },
  2: { none: 300,  mini: null, tspin: 1200 },
  3: { none: 500,  mini: null, tspin: 1600 },
  4: { none: 800,  mini: null, tspin: null },
};

for (const spinType of ['jspin', 'lspin', 'ispin']) {
  SCORE_TABLE[0][spinType] = 400;
  SCORE_TABLE[1][spinType] = 800;
  SCORE_TABLE[2][spinType] = 1200;
  SCORE_TABLE[3][spinType] = 1600;
  SCORE_TABLE[4][spinType] = 2000;
}

/**
 * Returns whether a clear qualifies for B2B continuation.
 * Only Tetrises and spins maintain B2B.
 */
function isB2BEligible(lines, tspinType) {
  if (['tspin', 'mini', 'jspin', 'lspin', 'ispin'].includes(tspinType)) return true;
  if (lines === 4) return true;
  return false;
}

/**
 * Calculate score for a clear event.
 * @param {object} params
 * @param {number}  params.lines       - Lines cleared (0–4)
 * @param {string}  params.tspinType   - spin classification
 * @param {boolean} params.b2b         - Is this back-to-back?
 * @param {number}  params.combo       - Current combo count (0-indexed, 0 = no combo)
 * @param {number}  params.level       - Current level
 * @returns {object} { points, label }
 */
export function calculateScore({ lines, tspinType, b2b, combo, level }) {
  let base = SCORE_TABLE[lines]?.[tspinType] ?? 0;

  // B2B bonus (×1.5)
  if (b2b && isB2BEligible(lines, tspinType) && lines > 0) {
    base = Math.floor(base * 1.5);
  }

  let points = base * level;

  // Combo points (50 × combo × level, 0-indexed so combo=1 means first consecutive)
  if (combo > 0 && lines > 0) {
    points += 50 * combo * level;
  }

  const label = buildLabel(lines, tspinType, b2b);
  return { points, label };
}

function buildLabel(lines, tspinType, b2b) {
  const prefix = b2b && isB2BEligible(lines, tspinType) && lines > 0 ? 'B2B ' : '';
  if (tspinType === 'tspin') {
    const names = ['T-SPIN', 'T-SPIN SINGLE', 'T-SPIN DOUBLE', 'T-SPIN TRIPLE'];
    return prefix + (names[lines] || 'T-SPIN');
  }
  if (tspinType === 'mini') {
    const names = ['T-SPIN MINI', 'T-SPIN MINI SINGLE', 'T-SPIN MINI DOUBLE'];
    return prefix + (names[lines] || 'T-SPIN MINI');
  }
  if (['jspin', 'lspin', 'ispin'].includes(tspinType)) {
    const names = {
      jspin: 'J-SPIN',
      lspin: 'L-SPIN',
      ispin: 'I-SPIN',
    };
    const lineNames = ['', ' SINGLE', ' DOUBLE', ' TRIPLE', ' QUADRUPLE'];
    return prefix + names[tspinType] + (lineNames[lines] || '');
  }
  const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
  return prefix + (names[lines] || '');
}

/**
 * Level progression — advances every 10 lines.
 * Returns gravity interval in ms per cell.
 */
export function gravityInterval(level) {
  // Guideline gravity formula (seconds per cell → ms)
  const sec = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
  return Math.max(sec * 1000, 16.67); // cap at ~60fps
}

/**
 * Score state manager.
 */
export class ScoreManager {
  constructor() {
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = -1;   // -1 = no combo, 0+ = combo chain length
    this.b2b = false;
    this.b2bCount = 0;
  }

  reset() {
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = -1;
    this.b2b = false;
    this.b2bCount = 0;
  }

  /**
   * Process a line clear event. Returns { points, label, comboPts }.
   */
  processLineClear(linesCleared, tspinType = 'none') {
    // Combo tracking
    if (linesCleared > 0) {
      this.combo++;
    } else {
      this.combo = -1;
    }

    // B2B tracking
    const eligible = isB2BEligible(linesCleared, tspinType) && linesCleared > 0;
    const isB2B = eligible && this.b2b;
    if (eligible) {
      this.b2bCount++;
      this.b2b = true;
    } else if (linesCleared > 0) {
      // Non-eligible clear breaks B2B
      this.b2b = false;
      this.b2bCount = 0;
    }

    const { points, label } = calculateScore({
      lines: linesCleared,
      tspinType,
      b2b: isB2B,
      combo: Math.max(0, this.combo),
      level: this.level,
    });

    this.score += points;
    this.lines += linesCleared;
    this.level = Math.floor(this.lines / 10) + 1;

    return { points, label, combo: this.combo };
  }

  /** Add soft drop points (1pt per cell) */
  addSoftDrop(cells) {
    this.score += cells;
  }

  /** Add hard drop points (2pt per cell) */
  addHardDrop(cells) {
    this.score += cells * 2;
  }
}
