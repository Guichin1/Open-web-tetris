/**
 * settings.js
 * All settings: keybinds and handling (DAS/ARR/DCD/SDF).
 * Persisted in localStorage.
 */

const STORAGE_KEY = 'tetris_settings_v1';

export const DEFAULT_KEYBINDS = {
  moveLeft:    'ArrowLeft',
  moveRight:   'ArrowRight',
  softDrop:    'ArrowDown',
  hardDrop:    'Space',
  rotateCW:    'KeyX',
  rotateCCW:   'KeyZ',
  rotate180:   'KeyA',
  hold:        'KeyC',
  pause:       'Escape',
  restart:     'F1',
  settings:    'Tab',
};

export const KEYBIND_LABELS = {
  moveLeft:    'Move Left',
  moveRight:   'Move Right',
  softDrop:    'Soft Drop',
  hardDrop:    'Hard Drop',
  rotateCW:    'Rotate CW',
  rotateCCW:   'Rotate CCW',
  rotate180:   'Rotate 180°',
  hold:        'Hold',
  pause:       'Pause',
  restart:     'Restart',
  settings:    'Settings',
};

// Additional alternate binds (not user-configurable, always active)
export const ALT_BINDS = {
  rotateCW:  ['ArrowUp'],
  hold:      ['ShiftLeft', 'ShiftRight'],
  pause:     ['KeyP'],
};

export const DEFAULT_HANDLING = {
  das: 133,  // ms
  arr: 10,   // ms
  dcd: 0,    // ms
  sdf: 20,   // × (41 = ∞)
};

/** Load settings from localStorage, merging with defaults. */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { keybinds: { ...DEFAULT_KEYBINDS }, handling: { ...DEFAULT_HANDLING } };
    const saved = JSON.parse(raw);
    return {
      keybinds: { ...DEFAULT_KEYBINDS, ...(saved.keybinds || {}) },
      handling: { ...DEFAULT_HANDLING, ...(saved.handling || {}) },
    };
  } catch {
    return { keybinds: { ...DEFAULT_KEYBINDS }, handling: { ...DEFAULT_HANDLING } };
  }
}

/** Save settings to localStorage. */
export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** High score persistence */
export function loadHighScore() {
  return parseInt(localStorage.getItem('tetris_highscore') || '0', 10);
}

export function saveHighScore(score) {
  const current = loadHighScore();
  if (score > current) {
    localStorage.setItem('tetris_highscore', String(score));
    return true;
  }
  return false;
}

/**
 * Settings UI controller.
 * Manages the settings modal DOM interactions.
 */
export class SettingsUI {
  constructor(settings, onChanged) {
    this.settings = settings;
    this.onChanged = onChanged;
    this._listeningAction = null;
    this._listeningEl = null;
    this._boundKeyListener = null;

    this._initHandling();
    this._initKeybinds();
    this._initTabs();
    this._initModal();
  }

  _initModal() {
    const modal = document.getElementById('modal-settings');
    const backdrop = document.getElementById('modal-backdrop');
    const closeBtn = document.getElementById('btn-close-settings');

    const close = () => this.hide();
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
  }

  _initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('tab-handling').classList.toggle('hidden', tab !== 'handling');
        document.getElementById('tab-keybinds').classList.toggle('hidden', tab !== 'keybinds');
      });
    });
  }

  _initHandling() {
    const { das, arr, dcd, sdf } = this.settings.handling;
    this._syncHandlingInputs({ das, arr, dcd, sdf });

    const pairs = [
      ['das', 'das-slider', 'das-input'],
      ['arr', 'arr-slider', 'arr-input'],
      ['dcd', 'dcd-slider', 'dcd-input'],
      ['sdf', 'sdf-slider', 'sdf-input'],
    ];

    for (const [key, sliderId, inputId] of pairs) {
      const slider = document.getElementById(sliderId);
      const input  = document.getElementById(inputId);

      const update = (val) => {
        val = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), parseInt(val) || 0));
        this.settings.handling[key] = val;
        slider.value = val;
        input.value = key === 'sdf' && val === 41 ? '∞' : val;
        if (key === 'sdf') {
          document.getElementById('sdf-unit').textContent = val === 41 ? '' : '×';
        }
        saveSettings(this.settings);
        this.onChanged(this.settings);
      };

      slider.addEventListener('input', () => update(slider.value));
      input.addEventListener('change', () => {
        if (key === 'sdf' && input.value === '∞') update(41);
        else update(input.value);
      });
    }
  }

  _syncHandlingInputs({ das, arr, dcd, sdf }) {
    document.getElementById('das-slider').value = das;
    document.getElementById('das-input').value = das;
    document.getElementById('arr-slider').value = arr;
    document.getElementById('arr-input').value = arr;
    document.getElementById('dcd-slider').value = dcd;
    document.getElementById('dcd-input').value = dcd;
    document.getElementById('sdf-slider').value = sdf;
    document.getElementById('sdf-input').value = sdf === 41 ? '∞' : sdf;
    document.getElementById('sdf-unit').textContent = sdf === 41 ? '' : '×';
  }

  _initKeybinds() {
    const grid = document.getElementById('keybind-grid');
    grid.innerHTML = '';

    for (const [action, label] of Object.entries(KEYBIND_LABELS)) {
      const row = document.createElement('div');
      row.className = 'keybind-row';

      const actionEl = document.createElement('span');
      actionEl.className = 'keybind-action';
      actionEl.textContent = label;

      const keyEl = document.createElement('span');
      keyEl.className = 'keybind-key';
      keyEl.textContent = this._formatKey(this.settings.keybinds[action]);
      keyEl.dataset.action = action;

      keyEl.addEventListener('click', () => this._startListening(action, keyEl));

      row.appendChild(actionEl);
      row.appendChild(keyEl);
      grid.appendChild(row);
    }
  }

  _startListening(action, el) {
    if (this._listeningAction !== null) {
      this._stopListening();
    }

    this._listeningAction = action;
    this._listeningEl = el;
    el.classList.add('listening');
    el.textContent = '…';

    document.getElementById('keybind-listening').classList.remove('hidden');

    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels
      if (e.code === 'Escape') {
        this._stopListening();
        return;
      }

      // Check for conflicts
      const conflict = this._findConflict(action, e.code);
      const conflictEl = document.getElementById('keybind-conflict');
      if (conflict) {
        conflictEl.textContent = `Conflict: "${e.code}" is already bound to "${KEYBIND_LABELS[conflict]}"`;
        conflictEl.classList.remove('hidden');
        this._stopListening();
        return;
      }

      conflictEl.classList.add('hidden');
      this.settings.keybinds[action] = e.code;
      el.textContent = this._formatKey(e.code);
      saveSettings(this.settings);
      this.onChanged(this.settings);
      this._stopListening();
    };

    this._boundKeyListener = onKey;
    window.addEventListener('keydown', onKey, true);
  }

  _stopListening() {
    if (this._listeningEl) {
      this._listeningEl.classList.remove('listening');
      this._listeningEl.textContent = this._formatKey(
        this.settings.keybinds[this._listeningAction]
      );
    }
    if (this._boundKeyListener) {
      window.removeEventListener('keydown', this._boundKeyListener, true);
    }
    this._listeningAction = null;
    this._listeningEl = null;
    this._boundKeyListener = null;
    document.getElementById('keybind-listening').classList.add('hidden');
  }

  _findConflict(action, code) {
    for (const [a, c] of Object.entries(this.settings.keybinds)) {
      if (a !== action && c === code) return a;
    }
    return null;
  }

  _formatKey(code) {
    if (!code) return '—';
    const map = {
      'ArrowLeft': '←', 'ArrowRight': '→', 'ArrowUp': '↑', 'ArrowDown': '↓',
      'Space': 'SPACE', 'Escape': 'ESC', 'ShiftLeft': 'L-SHF', 'ShiftRight': 'R-SHF',
      'Tab': 'TAB', 'Enter': 'ENTER', 'Backspace': 'BKSP',
    };
    if (map[code]) return map[code];
    // Strip Key/Digit prefix
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  show() {
    document.getElementById('modal-settings').classList.remove('hidden');
    this._syncHandlingInputs(this.settings.handling);
    this._initKeybinds();
    document.getElementById('keybind-conflict').classList.add('hidden');
  }

  hide() {
    document.getElementById('modal-settings').classList.add('hidden');
    this._stopListening();
  }

  isOpen() {
    return !document.getElementById('modal-settings').classList.contains('hidden');
  }
}
