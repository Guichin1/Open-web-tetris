/**
 * board.js
 * Board state, collision detection, line clearing, T-spin detection.
 * Board is 10 wide × 22 tall (20 visible + 2 buffer rows at top).
 */

export const BOARD_COLS = 10;
export const BOARD_ROWS = 22;   // 20 visible + 2 buffer
export const VISIBLE_ROWS = 20;
export const BUFFER_ROWS = 2;

/**
 * Creates a fresh empty board.
 * board[row][col] = null | pieceType string
 */
export function createBoard() {
  return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
}

/** Deep-copy a board */
export function cloneBoard(board) {
  return board.map(row => [...row]);
}

/** Returns true if the piece overlaps a filled cell or is out of bounds */
export function collides(board, piece) {
  for (const [r, c] of piece.cells()) {
    if (c < 0 || c >= BOARD_COLS) return true;
    if (r >= BOARD_ROWS) return true;
    if (r >= 0 && board[r][c] !== null) return true;
    // r < 0 is buffer above — allowed as long as within col bounds
  }
  return false;
}

/** Lock a piece onto the board. Mutates board. */
export function lockPiece(board, piece) {
  for (const [r, c] of piece.cells()) {
    if (r >= 0 && r < BOARD_ROWS) {
      board[r][c] = piece.type;
    }
  }
}

/**
 * Clear completed lines. Returns { newBoard, linesCleared, clearedRows }
 * clearedRows: indices of cleared rows (for animation)
 */
export function clearLines(board) {
  const clearedRows = [];
  const remaining = [];

  // Process from bottom to top for efficiency
  for (let r = BOARD_ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== null)) {
      clearedRows.push(r);
    } else {
      remaining.unshift([...board[r]]);
    }
  }

  const linesCleared = clearedRows.length;
  if (linesCleared === 0) {
    return { newBoard: board, linesCleared: 0, clearedRows: [] };
  }

  // Add empty rows at top
  const emptyRows = Array.from({ length: linesCleared }, () => Array(BOARD_COLS).fill(null));
  const newBoard = [...emptyRows, ...remaining];

  return { newBoard, linesCleared, clearedRows };
}

/**
 * T-Spin detection (3-corner rule).
 * Returns: 'tspin' | 'tspin-mini' | null
 * lastKick: { dc, dr, kickIndex } or null
 */
export function detectTSpin(board, piece, lastKick) {
  if (piece.type !== 'T') return null;

  const [pr, pc] = [piece.row, piece.col];
  const corners = [
    [pr + 0, pc + 0],
    [pr + 0, pc + 2],
    [pr + 2, pc + 0],
    [pr + 2, pc + 2],
  ];

  const filled = corners.map(([r, c]) =>
    r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS || (r >= 0 && board[r]?.[c] !== null)
  );
  const filledCount = filled.filter(Boolean).length;

  if (filledCount < 3) return null;

  // Front corners depend on T rotation
  // rot 0 (up): front = top corners [0,1]
  // rot 1/R (right): front = right corners [1,3]
  // rot 2 (down): front = bottom corners [2,3]
  // rot 3/L (left): front = left corners [0,2]
  const frontIndices = [[0,1],[1,3],[2,3],[0,2]][piece.rot];
  const frontFilled = frontIndices.filter(i => filled[i]).length;

  const wasKick5 = lastKick && lastKick.kickIndex === 4;

  if (frontFilled === 2 || wasKick5) return 'tspin';
  if (frontFilled === 1) return 'tspin-mini';
  return 'tspin';
}

/**
 * Check if placing piece causes a top-out (any cell in buffer rows after lock).
 */
export function isTopOut(board) {
  for (let r = 0; r < BUFFER_ROWS; r++) {
    if (board[r].some(c => c !== null)) return true;
  }
  return false;
}

/**
 * Compute the ghost piece position.
 * Returns a piece cloned at the lowest valid row it can occupy.
 */
export function computeGhost(board, piece) {
  const ghost = piece.clone();
  let dropDistance = 0;
  const maxDrop = BOARD_ROWS - piece.row; // Prevent infinite loop

  while (dropDistance < maxDrop) {
    ghost.row++;
    if (collides(board, ghost)) {
      ghost.row--;
      break;
    }
    dropDistance++;
  }

  return ghost;
}
