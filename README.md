# Tug of War

A multi-team party game with real-time cross-tab communication via BroadcastChannel.

## Views

| URL param | View | Purpose |
|-----------|------|---------|
| `?view=editor` (default) | Editor | Host/game-master setup screen |
| `?view=arena` | Arena Display | Big-screen projection display |
| `?view=player` | Player | Participant device (phone/tablet) |

## Game Modes

- **Tap Frenzy** — mash the screen to pull for your team
- **Math Blitz** — solve multiplication problems for pull power
- **Color Rush** — tap the correct color
- **High / Low** — is the number higher or lower than the middle?

## Dev Setup

```bash
npm install
npm run dev
# → http://localhost:3040
```

Open arena in a second window: `http://localhost:3040?view=arena`  
Open player on any device on the same network: `http://<your-ip>:3040?view=player`

## Build & Deploy

```bash
npm run build       # outputs to dist/
npm run preview     # preview production build locally
```

Deployed via Railway (see `railway.json`). Push to `main` to deploy.

## Project Structure

```
src/
  main.jsx              Entry point
  App.jsx               URL-based view router
  constants.js          TEAM_COLORS, GAME_MODES, TIMER_OPTIONS
  hooks/
    useBus.js           BroadcastChannel hook (cross-tab messaging)
  utils/
    storage.js          broadcastState / readState (localStorage sync)
    trivia.js           Question generators for trivia modes
  views/
    EditorView.jsx      Host / game editor
    ArenaDisplay.jsx    Big-screen animated display
    PlayerView.jsx      Player device view
imports/
  TugOfWar.jsx          Framer single-file source (keep in sync manually)
docs/
  PROJECT_RULES.md      AI agent rules for this project
  DEVLOG.md             Task checkpoint log
  SESSION_JOURNAL.md    Per-session AI work log
  TODO_NEXT_SESSION.md  Next priorities
```
