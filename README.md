# TETRIS — Guideline Edition

A complete, technically precise Tetris implementation in pure HTML/CSS/JS — no frameworks, no build step, zero dependencies beyond a Google Font.

## Features

- ✅ **7-bag randomizer** — fair piece distribution
- ✅ **SRS** — Super Rotation System with full wall kick tables (JLSTZ + I-piece)
- ✅ **180° rotation** with keybind
- ✅ **Ghost piece** — semi-transparent, always visible
- ✅ **Hold piece** — one swap per lock cycle
- ✅ **Next queue** — 5 pieces preview
- ✅ **Lock delay** — 500ms, 15 resets per piece (Guideline standard)
- ✅ **T-Spin detection** — 3-corner rule, T-Spin / T-Spin Mini
- ✅ **Back-to-Back** tracking with multiplier (×1.5)
- ✅ **Combo counter**
- ✅ **Guideline scoring** — Singles, Doubles, Triples, Tetrises, T-Spin variants
- ✅ **DAS/ARR/DCD/SDF** — all configurable in the settings menu
- ✅ **Fully rebindable keybinds** — persisted in localStorage
- ✅ **High score** — persisted in localStorage

## Default Keybinds

| Action | Default |
|---|---|
| Move Left | ← |
| Move Right | → |
| Soft Drop | ↓ |
| Hard Drop | Space |
| Rotate CW | X / ↑ |
| Rotate CCW | Z |
| Rotate 180° | A |
| Hold | C / Shift |
| Pause | Escape / P |
| Restart | F1 |
| Settings | Tab |

## Default Handling

| Setting | Default | Range |
|---|---|---|
| DAS (Delayed Auto Shift) | 133ms | 0–300ms |
| ARR (Auto Repeat Rate) | 10ms | 0–100ms |
| DCD (DAS Cut Delay) | 0ms | 0–200ms |
| SDF (Soft Drop Factor) | 20× | 1–∞ |

## Running Locally

No build step required. Just open `index.html` in your browser:

```bash
# Option 1: Direct open
open index.html

# Option 2: Local server (avoids ES module CORS in some browsers)
python3 -m http.server 8080
# then visit http://localhost:8080
```

## GitHub Pages Deployment

1. Push to a public GitHub repository
2. Go to **Settings → Pages**
3. Set source to **main branch / root**
4. Your game will be live at `https://yourusername.github.io/tetris/`

## Project Structure

```
tetris/
├── index.html          # Main HTML, layout, overlays, settings modal
├── style.css           # Dark tetr.io-inspired design, responsive
├── src/
│   ├── game.js         # Main loop, state machine, orchestration
│   ├── board.js        # Board state, collision, line clear, T-spin detection
│   ├── piece.js        # Tetrominoes, SRS rotation, wall kick tables, 7-bag
│   ├── input.js        # Keyboard handling, DAS/ARR/DCD timing
│   ├── scoring.js      # Guideline scoring, B2B, combos, level progression
│   ├── renderer.js     # Canvas rendering, animations, ghost/hold/next
│   └── settings.js     # localStorage persistence, keybind UI, handling UI
└── README.md
```

## License

MIT — do whatever you want with it.
