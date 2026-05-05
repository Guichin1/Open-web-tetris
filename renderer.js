/**
 * renderer.js
 * Canvas-based renderer for board, pieces, ghost, next queue, hold.
 * Handles animations: line clear flash, lock flash.
 */

import { PIECE_COLORS, PIECE_SHAPES } from './piece.js';
import { BOARD_COLS, VISIBLE_ROWS, BUFFER_ROWS } from './board.js';

// ---- Color utilities ----
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

function darken(hex, amt = 0.3) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
}

function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---- Cell drawing ----
function drawCell(ctx, x, y, size, color, alpha = 1) {
  if (size < 4) return;
  ctx.globalAlpha = alpha;

  // Base fill (slightly darker)
  ctx.fillStyle = darken(color, 0.22);
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  // Gradient overlay
  const grad = ctx.createLinearGradient(x, y, x, y + size);
  grad.addColorStop(0,   rgba(color, 0.95));
  grad.addColorStop(0.45, rgba(color, 0.75));
  grad.addColorStop(1,   rgba(color, 0.5));
  ctx.fillStyle = grad;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  // Top-left shine
  ctx.fillStyle = rgba('#ffffff', 0.20);
  ctx.fillRect(x + 2, y + 2, size - 5, 3);
  ctx.fillRect(x + 2, y + 2, 3, size - 5);

  // Inner border (dark inset)
  ctx.strokeStyle = darken(color, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);

  ctx.globalAlpha = 1;
}

function drawGhostCell(ctx, x, y, size, color) {
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  ctx.globalAlpha = 1;
}

function drawEmptyCell(ctx, x, y, size) {
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(x, y, size, size);
  // Subtle grid dot at center
  ctx.fillStyle = '#18182a';
  ctx.fillRect(x + Math.floor(size/2), y + Math.floor(size/2), 1, 1);
}

// ---- Mini piece for hold/next panels ----
function drawMiniPiece(ctx, type, areaW, areaH, alpha, offsetY = 0) {
  const shape = PIECE_SHAPES[type][0];
  const color = PIECE_COLORS[type];

  const rows = shape.map(([r]) => r);
  const cols = shape.map(([,c]) => c);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const minC = Math.min(...cols), maxC = Math.max(...cols);
  const spanC = maxC - minC + 1;
  const spanR = maxR - minR + 1;

  const cellSize = Math.min(
    Math.floor((areaW - 4) / 4),
    Math.floor((areaH - 4) / 4)
  );

  const totalW = spanC * cellSize;
  const totalH = spanR * cellSize;
  const startX = Math.floor((areaW - totalW) / 2);
  const startY = offsetY + Math.floor((areaH - totalH) / 2);

  for (const [r, c] of shape) {
    const x = startX + (c - minC) * cellSize;
    const y = startY + (r - minR) * cellSize;
    drawCell(ctx, x, y, cellSize, color, alpha);
  }
}

// ---- Renderer class ----
export class Renderer {
  constructor() {
    this.boardCanvas = document.getElementById('canvas-board');
    this.holdCanvas  = document.getElementById('canvas-hold');
    this.nextCanvas  = document.getElementById('canvas-next');

    this.boardCtx = this.boardCanvas.getContext('2d');
    this.holdCtx  = this.holdCanvas.getContext('2d');
    this.nextCtx  = this.nextCanvas.getContext('2d');

    this._cellSize = 32;

    // Animation state
    this.flashRows  = [];
    this.flashAlpha = 0;
    this.lockFlash  = 0;
    this._flashRaf  = null;
    this._lockRaf   = null;

    this._setupCanvases();
    window.addEventListener('resize', () => this._setupCanvases());
  }

  _setupCanvases() {
    const wrapper = document.getElementById('board-wrapper');
    const dpr = window.devicePixelRatio || 1;

    // Board canvas — fill the wrapper
    const bw = wrapper.clientWidth;
    const bh = wrapper.clientHeight;
    this.boardCanvas.width  = Math.round(bw * dpr);
    this.boardCanvas.height = Math.round(bh * dpr);
    this.boardCanvas.style.width  = bw + 'px';
    this.boardCanvas.style.height = bh + 'px';

    // Reset and scale context (must re-get after resize)
    this.boardCtx = this.boardCanvas.getContext('2d');
    this.boardCtx.scale(dpr, dpr);
    this._cellSize = bw / BOARD_COLS;

    // Hold canvas
    const hw = this.holdCanvas.parentElement.clientWidth - 20;
    const hsize = Math.min(hw, 110);
    this.holdCanvas.width  = Math.round(hsize * dpr);
    this.holdCanvas.height = Math.round(hsize * dpr);
    this.holdCanvas.style.width  = hsize + 'px';
    this.holdCanvas.style.height = hsize + 'px';
    this.holdCtx = this.holdCanvas.getContext('2d');
    this.holdCtx.scale(dpr, dpr);
    this._holdSize = hsize;

    // Next canvas
    const nw = this.nextCanvas.parentElement.clientWidth - 20;
    const nsize = Math.min(nw, 110);
    const nh = nsize * 5;
    this.nextCanvas.width  = Math.round(nsize * dpr);
    this.nextCanvas.height = Math.round(nh * dpr);
    this.nextCanvas.style.width  = nsize + 'px';
    this.nextCanvas.style.height = nh + 'px';
    this.nextCtx = this.nextCanvas.getContext('2d');
    this.nextCtx.scale(dpr, dpr);
    this._nextW = nsize;
    this._nextH = nh;
  }

  get cellSize() { return this._cellSize; }

  render({ board, currentPiece, ghostPiece, holding, holdLocked, nextQueue }) {
    if (!board) return;

    const ctx = this.boardCtx;
    const cs  = this._cellSize;
    const W   = cs * BOARD_COLS;
    const H   = cs * VISIBLE_ROWS;

    ctx.clearRect(0, 0, W, H);

    // Draw cells
    for (let r = 0; r < VISIBLE_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const boardRow = r + BUFFER_ROWS;
        const cell = board[boardRow]?.[c] ?? null;
        const x = c * cs, y = r * cs;
        if (cell) {
          drawCell(ctx, x, y, cs, PIECE_COLORS[cell]);
        } else {
          drawEmptyCell(ctx, x, y, cs);
        }
      }
    }

    // Line clear flash
    if (this.flashRows.length > 0 && this.flashAlpha > 0) {
      for (const row of this.flashRows) {
        const visRow = row - BUFFER_ROWS;
        if (visRow < 0 || visRow >= VISIBLE_ROWS) continue;
        ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha * 0.85})`;
        ctx.fillRect(0, visRow * cs, W, cs);
      }
    }

    // Lock flash overlay
    if (this.lockFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.lockFlash * 0.1})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Ghost piece
    if (ghostPiece && currentPiece) {
      const color = PIECE_COLORS[ghostPiece.type];
      for (const [r, c] of ghostPiece.cells()) {
        const vr = r - BUFFER_ROWS;
        if (vr < 0 || vr >= VISIBLE_ROWS || c < 0 || c >= BOARD_COLS) continue;
        drawGhostCell(ctx, c * cs, vr * cs, cs, color);
      }
    }

    // Active piece
    if (currentPiece) {
      const color = PIECE_COLORS[currentPiece.type];
      for (const [r, c] of currentPiece.cells()) {
        const vr = r - BUFFER_ROWS;
        if (vr < 0 || vr >= VISIBLE_ROWS || c < 0 || c >= BOARD_COLS) continue;
        drawCell(ctx, c * cs, vr * cs, cs, color);
      }
    }

    // Hold and next
    this._renderHold(holding, holdLocked);
    this._renderNext(nextQueue);
  }

  _renderHold(type, locked) {
    const ctx = this.holdCtx;
    const s = this._holdSize || 110;
    ctx.clearRect(0, 0, s, s);
    if (!type) return;
    drawMiniPiece(ctx, type, s, s, locked ? 0.35 : 1.0);
  }

  _renderNext(queue) {
    const ctx = this.nextCtx;
    const w = this._nextW || 110;
    const h = this._nextH || 550;
    ctx.clearRect(0, 0, w, h);

    const maxShow = 5;
    const slotH = h / maxShow;
    for (let i = 0; i < Math.min(queue.length, maxShow); i++) {
      const alpha = i === 0 ? 1 : Math.max(0.35, 1 - i * 0.18);
      drawMiniPiece(ctx, queue[i], w, slotH, alpha, i * slotH);
    }
  }

  triggerLineClearFlash(rows) {
    if (this._flashRaf) cancelAnimationFrame(this._flashRaf);
    this.flashRows  = rows;
    this.flashAlpha = 1;
    const duration  = 200;
    const start     = performance.now();

    const tick = (now) => {
      const t = (now - start) / duration;
      if (t >= 1) { this.flashAlpha = 0; this.flashRows = []; return; }
      this.flashAlpha = 1 - t;
      this._flashRaf = requestAnimationFrame(tick);
    };
    this._flashRaf = requestAnimationFrame(tick);
  }

  triggerLockFlash() {
    if (this._lockRaf) cancelAnimationFrame(this._lockRaf);
    this.lockFlash = 1;
    const duration = 90;
    const start    = performance.now();

    const tick = (now) => {
      const t = (now - start) / duration;
      if (t >= 1) { this.lockFlash = 0; return; }
      this.lockFlash = 1 - t;
      this._lockRaf = requestAnimationFrame(tick);
    };
    this._lockRaf = requestAnimationFrame(tick);
  }
}
