/**
 * game.js
 * Main game loop, state machine, and orchestration.
 * States: 'menu' | 'playing' | 'paused' | 'gameover'
 */

import { Piece, generate7Bag } from './piece.js';
import {
  createBoard, collides, lockPiece, clearLines,
  detectTSpin, isTopOut, computeGhost, BOARD_COLS
} from './board.js';
import { ScoreManager, gravityInterval } from './scoring.js';
import { InputManager } from './input.js';
import { Renderer } from './renderer.js';
import { loadSettings, saveSettings, saveHighScore, loadHighScore, SettingsUI } from './settings.js';

// ---- Constants ----
const LOCK_DELAY    = 500;    // ms
const LOCK_RESETS   = 15;
const NEXT_QUEUE_SIZE = 5;

// ---- Game State ----
class TetrisGame {
  constructor() {
    this.state = 'menu';

    // Load settings
    this.settings = loadSettings();

    // Initialize renderer
    this.renderer = new Renderer();

    // Initialize score manager
    this.scoreManager = new ScoreManager();

    // Initialize input
    this.input = new InputManager(
      this.settings.keybinds,
      this.settings.handling,
      (action, data) => this._handleAction(action, data)
    );

    // Initialize settings UI
    this.settingsUI = new SettingsUI(this.settings, (newSettings) => {
      this.settings = newSettings;
      this.input.updateSettings(newSettings.keybinds, newSettings.handling);
    });

    // Game fields (initialized on start)
    this.board = null;
    this.bag = [];
    this.nextQueue = [];
    this.currentPiece = null;
    this.ghostPiece = null;
    this.holdPiece = null;
    this.holdLocked = false;    // Can't hold again until piece locks

    // Timing
    this._lastTime = 0;
    this._gravityAccum = 0;
    this._lockTimer = null;
    this._lockResetCount = 0;
    this._softDropRow = 0;      // row when soft drop started
    this._hardDropRow = 0;

    // Last rotation kick info (for T-spin detection)
    this._lastKick = null;
    this._lastRotated = false;

    // Action label timeout
    this._actionLabelTimer = null;

    // RAF handle
    this._rafHandle = null;

    // Bind DOM
    this._bindUI();

    // Display highscore
    document.getElementById('highscore').textContent = loadHighScore().toLocaleString();

    // Start render loop
    this._loop(0);
  }

  // ---- UI Binding ----
  _bindUI() {
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-restart-pause').addEventListener('click', () => this.startGame());
    document.getElementById('btn-restart-go').addEventListener('click', () => this.startGame());
    document.getElementById('btn-menu-go').addEventListener('click', () => this._showMenu());
    document.getElementById('btn-settings-start').addEventListener('click', () => this.settingsUI.show());
    document.getElementById('btn-settings-pause').addEventListener('click', () => {
      this.settingsUI.show();
    });
  }

  // ---- State machine ----
  startGame() {
    this.board = createBoard();
    this.bag = [];
    this.nextQueue = [];
    this.scoreManager.reset();
    this.holdPiece = null;
    this.holdLocked = false;
    this._gravityAccum = 0;
    this._lastKick = null;
    this._lastRotated = false;

    this._fillBag();
    this._spawnPiece();

    this.state = 'playing';
    this._showOverlay(null);
    this._updateUI();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this._showOverlay(null);
    this._lastTime = performance.now();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this._showOverlay('pause');
    this._clearLockTimer();
  }

  _gameOver() {
    this.state = 'gameover';
    const score = this.scoreManager.score;
    const isNew = saveHighScore(score);
    document.getElementById('go-score').textContent = score.toLocaleString();
    if (isNew) {
      document.getElementById('highscore').textContent = score.toLocaleString();
    }
    this._clearLockTimer();
    this._showOverlay('gameover');
  }

  _showMenu() {
    this.state = 'menu';
    this._showOverlay('start');
  }

  _showOverlay(name) {
    document.getElementById('overlay-start').classList.toggle('hidden', name !== 'start');
    document.getElementById('overlay-pause').classList.toggle('hidden', name !== 'pause');
    document.getElementById('overlay-gameover').classList.toggle('hidden', name !== 'gameover');
  }

  // ---- Bag / Queue ----
  _fillBag() {
    while (this.nextQueue.length < NEXT_QUEUE_SIZE + 1) {
      if (this.bag.length === 0) this.bag = generate7Bag();
      this.nextQueue.push(this.bag.shift());
    }
  }

  _dequeue() {
    const type = this.nextQueue.shift();
    this._fillBag();
    return type;
  }

  // ---- Piece Spawning ----
  _spawnPiece() {
    const type = this._dequeue();
    this.currentPiece = new Piece(type);
    this._lastKick = null;
    this._lastRotated = false;
    this._lockResetCount = 0;

    if (collides(this.board, this.currentPiece)) {
      // Top-out on spawn
      this._gameOver();
      return;
    }

    this._updateGhost();
  }

  _updateGhost() {
    if (!this.currentPiece) { this.ghostPiece = null; return; }
    this.ghostPiece = computeGhost(this.board, this.currentPiece);
  }

  // ---- Input handling ----
  _handleAction(action, data) {
    // Settings toggle — works from any state
    if (action === 'settings') {
      if (this.settingsUI.isOpen()) {
        this.settingsUI.hide();
      } else {
        if (this.state === 'playing') this.pause();
        this.settingsUI.show();
      }
      return;
    }

    // If settings modal is open, block game input
    if (this.settingsUI.isOpen()) return;

    if (action === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      return;
    }

    if (action === 'restart') {
      this.startGame();
      return;
    }

    if (this.state !== 'playing') return;

    switch (action) {
      case 'moveLeft':
        this._move(data.instant ? -BOARD_COLS : -1);
        break;
      case 'moveRight':
        this._move(data.instant ? BOARD_COLS : 1);
        break;
      case 'softDrop':
        // Handled in loop via isSoftDropHeld()
        break;
      case 'hardDrop':
        this._hardDrop();
        break;
      case 'rotateCW':
        this._rotate(1);
        break;
      case 'rotateCCW':
        this._rotate(-1);
        break;
      case 'rotate180':
        this._rotate(2);
        break;
      case 'hold':
        this._hold();
        break;
    }
  }

  _move(delta) {
    if (!this.currentPiece) return;
    const dir = delta > 0 ? 1 : -1;
    const steps = Math.abs(delta);
    let moved = 0;

    for (let i = 0; i < steps; i++) {
      this.currentPiece.col += dir;
      if (collides(this.board, this.currentPiece)) {
        this.currentPiece.col -= dir;
        break;
      }
      moved++;
      this._onMovement();
    }

    if (moved > 0) {
      this._lastRotated = false;
      this._updateGhost();
    }
  }

  _rotate(delta) {
    if (!this.currentPiece) return;
    const result = this.currentPiece.tryRotate(delta, (p) => collides(this.board, p));
    if (result !== null) {
      this._lastKick = result;
      this._lastRotated = true;
      this._updateGhost();
      this._onMovement();
    }
  }

  _hardDrop() {
    if (!this.currentPiece || !this.ghostPiece) return;
    const dropDistance = this.ghostPiece.row - this.currentPiece.row;
    this.scoreManager.addHardDrop(dropDistance);
    this.currentPiece.row = this.ghostPiece.row;
    this.currentPiece.col = this.ghostPiece.col;
    this._lockPiece();
  }

  _hold() {
    if (!this.currentPiece || this.holdLocked) return;

    const currentType = this.currentPiece.type;
    this._clearLockTimer();
    this._lockResetCount = 0;
    this._lastKick = null;
    this._lastRotated = false;

    if (this.holdPiece) {
      const heldType = this.holdPiece;
      this.holdPiece = currentType;
      this.currentPiece = new Piece(heldType);

      if (collides(this.board, this.currentPiece)) {
        // Extremely rare — treat as game over
        this._gameOver();
        return;
      }
    } else {
      this.holdPiece = currentType;
      const type = this._dequeue();
      this.currentPiece = new Piece(type);

      if (collides(this.board, this.currentPiece)) {
        this._gameOver();
        return;
      }
    }

    this.holdLocked = true;
    this._updateGhost();
  }

  _onMovement() {
    // If piece is on the ground, reset lock delay (up to limit)
    if (this._lockTimer !== null && this._lockResetCount < LOCK_RESETS) {
      this._clearLockTimer();
      this._startLockTimer();
      this._lockResetCount++;
    }
  }

  // ---- Lock delay ----
  _startLockTimer() {
    if (this._lockTimer !== null) return;
    this._lockTimer = setTimeout(() => {
      this._lockTimer = null;
      this._lockPiece();
    }, LOCK_DELAY);
  }

  _clearLockTimer() {
    if (this._lockTimer !== null) {
      clearTimeout(this._lockTimer);
      this._lockTimer = null;
    }
  }

  _lockPiece() {
    if (!this.currentPiece) return;

    // Lock piece onto board
    lockPiece(this.board, this.currentPiece);
    this.renderer.triggerLockFlash();

    // Detect T-Spin
    let tspinType = 'none';
    if (this._lastRotated && this.currentPiece.type === 'T') {
      const detected = detectTSpin(this.board, this.currentPiece, this._lastKick);
      tspinType = detected || 'none';
    }

    // Clear lines
    const { newBoard, linesCleared, clearedRows } = clearLines(this.board);
    this.board = newBoard;

    if (linesCleared > 0) {
      this.renderer.triggerLineClearFlash(clearedRows);
    }

    // Score
    const { points, label, combo } = this.scoreManager.processLineClear(linesCleared, tspinType);

    // Show action label
    if (label && linesCleared > 0) {
      this._showActionLabel(label);
    }
    if (combo > 0 && linesCleared > 0) {
      this._showActionLabel(`COMBO ×${combo}`);
    }

    // Unlock hold
    this.holdLocked = false;
    this._lastKick = null;
    this._lastRotated = false;
    this._lockResetCount = 0;

    // Check top-out
    if (isTopOut(this.board)) {
      this._gameOver();
      return;
    }

    this._updateUI();
    this._spawnPiece();
  }

  // ---- Gravity / Game loop ----
  _loop(timestamp) {
    this._rafHandle = requestAnimationFrame((t) => this._loop(t));

    // First frame guard
    if (this._lastTime === 0) {
      this._lastTime = timestamp;
      return;
    }

    const dt = Math.min(timestamp - this._lastTime, 100); // cap at 100ms
    this._lastTime = timestamp;

    if (this.state === 'playing' && this.currentPiece) {
      this._tick(dt);
    }

    // Render
    this.renderer.render({
      board: this.board || createBoard(),
      currentPiece: this.state === 'playing' ? this.currentPiece : null,
      ghostPiece:   this.state === 'playing' ? this.ghostPiece   : null,
      holding:      this.holdPiece,
      holdLocked:   this.holdLocked,
      nextQueue:    this.nextQueue,
    });
  }

  _tick(dt) {
    if (!this.currentPiece) return;

    const softHeld = this.input.isSoftDropHeld();
    const sdf      = this.settings.handling.sdf;
    const gravity  = gravityInterval(this.scoreManager.level);

    // Effective interval after SDF
    const effectiveInterval = softHeld
      ? (sdf >= 41 ? 0 : gravity / sdf)
      : gravity;

    if (effectiveInterval <= 0) {
      // Instant drop (SDF = ∞ or interval = 0)
      let dropped = 0;
      while (true) {
        this.currentPiece.row++;
        if (collides(this.board, this.currentPiece)) {
          this.currentPiece.row--;
          break;
        }
        dropped++;
      }
      if (softHeld && dropped > 0) this.scoreManager.addSoftDrop(dropped);
      if (dropped > 0) this._updateGhost();
      this._gravityAccum = 0;

      // Start lock if on ground
      if (this._lockTimer === null) this._startLockTimer();
      return;
    }

    this._gravityAccum += dt;
    let grounded = false;

    while (this._gravityAccum >= effectiveInterval) {
      this._gravityAccum -= effectiveInterval;

      this.currentPiece.row++;
      if (collides(this.board, this.currentPiece)) {
        this.currentPiece.row--;
        grounded = true;
        if (softHeld) this.scoreManager.addSoftDrop(0); // 0 cells, already at bottom
        break;
      }

      // Successfully moved down
      this._updateGhost();
      if (softHeld) this.scoreManager.addSoftDrop(1);
    }

    if (grounded) {
      if (this._lockTimer === null) this._startLockTimer();
    } else {
      // Piece is airborne — reset accum overflow guard
      // Lock timer stays running only if piece is actually on ground
      const testDown = this.currentPiece.clone();
      testDown.row++;
      if (!collides(this.board, testDown)) {
        // Piece is NOT on ground — clear any lock timer
        this._clearLockTimer();
      }
    }
  }

  // ---- UI Updates ----
  _updateUI() {
    const sm = this.scoreManager;
    document.getElementById('score').textContent = sm.score.toLocaleString();
    document.getElementById('level').textContent = sm.level;
    document.getElementById('lines').textContent = sm.lines;

    // B2B indicator
    const b2bBlock = document.getElementById('block-b2b');
    if (sm.b2b && sm.b2bCount > 1) {
      b2bBlock.style.display = '';
      document.getElementById('b2b-count').textContent = sm.b2bCount;
    } else {
      b2bBlock.style.display = 'none';
    }

    // Combo indicator
    const comboBlock = document.getElementById('block-combo');
    if (sm.combo > 0) {
      comboBlock.style.display = '';
      document.getElementById('combo').textContent = `×${sm.combo}`;
    } else {
      comboBlock.style.display = 'none';
    }
  }

  _showActionLabel(text) {
    const el = document.getElementById('action-label');
    if (this._actionLabelTimer) clearTimeout(this._actionLabelTimer);
    el.textContent = text;
    el.classList.remove('visible');
    void el.offsetWidth; // force reflow for animation restart
    el.classList.add('visible');
    this._actionLabelTimer = setTimeout(() => {
      el.classList.remove('visible');
    }, 900);
  }
}

// ---- Boot ----
window.addEventListener('DOMContentLoaded', () => {
  new TetrisGame();
});
