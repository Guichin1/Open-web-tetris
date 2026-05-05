/**
 * input.js
 * Keyboard input management: DAS, ARR, DCD, keybind dispatching.
 */

import { ALT_BINDS } from './settings.js';

/**
 * InputManager handles keydown/keyup, DAS/ARR/DCD timers,
 * and fires normalized action events.
 */
export class InputManager {
  /**
   * @param {object} keybinds - { action: keyCode }
   * @param {object} handling - { das, arr, dcd, sdf }
   * @param {function} onAction - callback(action, data)
   */
  constructor(keybinds, handling, onAction) {
    this.keybinds = keybinds;
    this.handling = handling;
    this.onAction = onAction;

    // Active key tracking
    this._held = new Set();
    this._dasTimer = null;
    this._arrInterval = null;
    this._dasDirection = null; // 'moveLeft' | 'moveRight'
    this._dcdTimer = null;     // DCD cooldown after key release

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  updateSettings(keybinds, handling) {
    this.keybinds = keybinds;
    this.handling = handling;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    this._clearDAS();
  }

  /** Resolve an event code to an action string, checking keybinds and alt binds. */
  _resolveAction(code) {
    for (const [action, bound] of Object.entries(this.keybinds)) {
      if (bound === code) return action;
    }
    // Check alt binds
    for (const [action, codes] of Object.entries(ALT_BINDS)) {
      if (codes.includes(code)) return action;
    }
    return null;
  }

  _onKeyDown(e) {
    // Prevent repeat events from browser
    if (e.repeat) return;

    const code = e.code;
    if (this._held.has(code)) return;
    this._held.add(code);

    const action = this._resolveAction(code);
    if (!action) return;

    // Prevent default for game keys (space, arrows, etc.)
    const preventDefaultKeys = ['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'];
    if (preventDefaultKeys.includes(code)) e.preventDefault();

    this.onAction(action, { type: 'press', code });

    // DAS/ARR for lateral movement
    if (action === 'moveLeft' || action === 'moveRight') {
      this._startDAS(action);
    }
  }

  _onKeyUp(e) {
    const code = e.code;
    this._held.delete(code);

    const action = this._resolveAction(code);
    if (!action) return;

    if (action === 'moveLeft' || action === 'moveRight') {
      if (this._dasDirection === action) {
        this._clearDAS();

        // DCD: check if the opposite direction is still held
        const opposite = action === 'moveLeft' ? 'moveRight' : 'moveLeft';
        const oppCode = this.keybinds[opposite];
        const oppAlt  = ALT_BINDS[opposite] || [];
        const oppHeld = [...this._held].some(c => c === oppCode || oppAlt.includes(c));

        if (oppHeld) {
          const dcd = this.handling.dcd;
          if (dcd > 0) {
            // Wait DCD ms before re-activating DAS for opposite direction
            this._dcdTimer = setTimeout(() => {
              this._dcdTimer = null;
              this._startDAS(opposite);
            }, dcd);
          } else {
            this._startDAS(opposite);
          }
        }
      }
    }
  }

  _startDAS(action) {
    this._clearDAS();
    this._dasDirection = action;

    const { das, arr } = this.handling;

    if (das === 0) {
      // Instant repeat
      this._startARR(action);
      return;
    }

    this._dasTimer = setTimeout(() => {
      this._dasTimer = null;
      this._startARR(action);
    }, das);
  }

  _startARR(action) {
    const { arr } = this.handling;

    if (arr === 0) {
      // Instant: move all the way
      this.onAction(action, { type: 'arr', instant: true });
      return;
    }

    // Fire once immediately, then repeat
    this.onAction(action, { type: 'arr', instant: false });

    this._arrInterval = setInterval(() => {
      this.onAction(action, { type: 'arr', instant: false });
    }, arr);
  }

  _clearDAS() {
    if (this._dasTimer)   { clearTimeout(this._dasTimer);   this._dasTimer = null; }
    if (this._arrInterval){ clearInterval(this._arrInterval); this._arrInterval = null; }
    if (this._dcdTimer)   { clearTimeout(this._dcdTimer);   this._dcdTimer = null; }
    this._dasDirection = null;
  }

  /** Returns true if soft drop key is currently held */
  isSoftDropHeld() {
    const code = this.keybinds['softDrop'];
    return this._held.has(code);
  }
}
