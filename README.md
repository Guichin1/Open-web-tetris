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
- ✅ **Player nickname** — requested on first launch and persisted in localStorage
- ✅ **Local leaderboard** — top 10 scores saved in the current browser
- ✅ **Online leaderboard** — top 10 personal bests, with a persistent anonymous player ID
- ✅ **Start screen changelog** — loaded automatically from `CHANGELOG.MD`

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

No build step required. Run a local web server so the game can load `CHANGELOG.MD`:

```bash
# Local server
python3 -m http.server 8080
# then visit http://localhost:8080
```

The leaderboard is local to the browser and is not shared across devices.

## Online leaderboard setup

The browser uses only the Supabase project URL and its public publishable key
from the ignored `.env` file. The personal access token and project secret key
must never be added to browser code or shared with players. If the public key
changes, update `supabase-config.js` with the new publishable key.

1. In Supabase, enable **Authentication → Sign In / Providers → Anonymous Sign-Ins**.
2. Open the SQL Editor, run `supabase-setup.sql`, and make sure it completes.
3. Serve the game over HTTP or HTTPS and open **ONLINE SCORES**.

The first visit creates a persistent anonymous player ID in that browser. Each
player has one online entry, and only a new personal best replaces the score.
Clearing browser storage creates a new ID. Scores come from the game client and
are not cheat-proof; enable Supabase rate limits or CAPTCHA to reduce abuse.
Nicknames and best scores are public, and the leaderboard displays the top 10
players. Players should choose a nickname that does not reveal personal details.

## Como atualizar o histórico de mudanças

O [CHANGELOG.MD](./CHANGELOG.MD) é exibido na tela inicial. Escreva em português,
com frases curtas que expliquem o que mudou para quem joga. Evite siglas e termos
técnicos; quando forem necessários, explique-os.

Cada versão publicada deve apontar para o commit do GitHub que trouxe a mudança
ao jogo. Inclua a data e os primeiros caracteres do código do commit. Coloque a
versão mais nova no início e descreva primeiro o efeito para quem joga. Não
conte commits que só mudam documentação ou organização do projeto como versões.

Mudanças ainda sem commit ficam em **“Próxima versão — ainda sem commit”**.
Quando forem publicadas, mova-as para uma nova versão com a data e o código do
commit correspondente.

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
