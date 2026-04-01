# Tug of War — Project Rules

**Project:** Tug of War
**Last Updated:** 2026-04-01
**Maintained By:** Kevin @ GJS Media

For universal AI agent protocols, see `docs/AI_AGENT_PROTOCOL.md`.

---

<!-- DOCUMENT NAVIGATION -->
| Section | Approx Lines | Key Tags |
|---------|-------------|----------|
| Entity Terminology & Naming | 40–70 | naming, entities, views |
| Mission Statement / Pillars | 72–110 | pillars, patterns, anti-patterns |
| Stack & Architecture | 112–140 | stack, tech, framer |
| Pre-Implementation Checklist | 142–165 | checklist, diagnostic |
| Docs Structure & Symlink Protocol | 167–215 | docs, symlinks, structure |
| Imports Folder Protocol | 217–250 | imports, framer, files, assets |
| Known Patterns & Gotchas | 252+ | gotchas, bugs, lessons |
<!-- END DOCUMENT NAVIGATION -->

---

## 🗺️ ENTITY TERMINOLOGY & NAMING
<!-- tags: naming, entities, views -->

### Core Concepts

```
TugOfWar (root component — URL router)
  ├── EditorView    → ?view=editor   (game host / setup screen)
  ├── ArenaDisplay  → ?view=arena    (big-screen projection display)
  └── PlayerView    → ?view=player   (participant device)
```

### Naming Rules for AI Agents

| Context | Correct Term | Wrong Term |
|---------|-------------|------------|
| Root component | `TugOfWar` | `App`, `Main` |
| Host setup screen | `EditorView` | `AdminView`, `HostView` |
| Big screen | `ArenaDisplay` | `DisplayView`, `Screen` |
| Participant device | `PlayerView` | `ClientView`, `UserView` |
| Cross-tab messaging | `BroadcastChannel` (`CH_NAME = "tug-of-war-game"`) | WebSocket, polling |
| Cross-tab shared state | `localStorage` key `"tow-state"` | sessionStorage |

### Game Modes

| ID | Label | Icon |
|----|-------|------|
| `"tap"` | Tap Frenzy | 👆 |
| `"trivia_math"` | Math Blitz | 🧮 |
| `"trivia_color"` | Color Rush | 🎨 |
| `"trivia_highlow"` | High / Low | 🔢 |

### Team Colors (index-locked)

| Index | Name | Hex |
|-------|------|-----|
| 0 | Red | `#E53935` |
| 1 | Green | `#43A047` |
| 2 | Blue | `#1E88E5` |
| 3 | Yellow | `#FDD835` |

---

## 🎯 MISSION STATEMENT
<!-- tags: pillars, patterns, anti-patterns -->

### Core Pillars

1. **SINGLE FILE** → The entire app lives in `imports/TugOfWar.jsx`. Do not split into multiple files unless explicitly requested.

2. **BROADCASTCHANNEL IS THE BUS** → All cross-tab communication goes through `BroadcastChannel("tug-of-war-game")`. Never introduce WebSockets, polling, or server calls.

3. **LOCALSTORAGE FOR LATE-JOIN STATE** → `"tow-state"` in localStorage lets a newly opened tab (Arena, Player) catch up to the current game state. `broadcastState()` must be called whenever game state is published.

4. **NO BUILD STEP** → This is a Framer import component (single `.jsx` file). No bundler, no npm install, no `package.json`. Do not add dependencies that require a build pipeline.

5. **URL = VIEW** → View routing is driven entirely by `?view=` query param (or hash). No React Router, no navigation library.

6. **SERVER OWNS TIME** → Game timer is set in EditorView and broadcast to all tabs. Tabs do not independently compute session timing.

### Quick Diagnostic Checklist
<!-- tags: checklist, diagnostic -->

| Symptom | Likely Cause |
|---------|-------------|
| Player/Arena tab not updating | `broadcastState()` not called after `send()` |
| Late-joining tab shows wrong state | `readState()` not called in useEffect on mount |
| Team color wrong on Arena | `colorIdx` not passed in `teams` array on `start_game` |
| New game mode not appearing | Not added to `GAME_MODES` constant array |

---

## 🛠️ STACK & ARCHITECTURE
<!-- tags: stack, tech, framer -->

- **Framework:** React 18 (hooks only — no class components)
- **Dev server:** Vite 6 — `npm run dev` → `http://localhost:5173`
- **Build:** `npm run build` → `dist/`
- **Deploy:** Railway (static site via `serve`) — push to `main` triggers deploy
- **Framer source:** `imports/TugOfWar.jsx` — single-file version kept in sync manually
- **Cross-tab comms:** `BroadcastChannel` API
- **Persistence:** `localStorage` (key: `"tow-state"`) for late-join sync only
- **Styling:** Inline styles only (no CSS files, no Tailwind, no styled-components)
- **No backend, no DB, no API calls**
- **Timer options:** `[10, 20, 30]` seconds (defined in `TIMER_OPTIONS` constant)
- **Port:** 5173 (dev), Railway-assigned (prod)

---

## ✅ PRE-IMPLEMENTATION CHECKLIST
<!-- tags: checklist, diagnostic -->

Before changing anything:

1. Does the change require a new file? → **No. Keep everything in `TugOfWar.jsx`.**
2. Does it introduce a new dependency? → **No external imports allowed.**
3. Does it affect cross-tab state? → Call both `send()` and `broadcastState()`.
4. Does it add a new view? → Add URL param handling in the `TugOfWar` router.
5. Does it add a new game mode? → Add to `GAME_MODES` constant AND implement handler in relevant views.

---

## 📁 DOCS STRUCTURE & SYMLINK PROTOCOL
<!-- tags: docs, symlinks, structure -->

All project documentation lives in `docs/`. Nothing at the project root except `imports/`.

### File types in `docs/`

| Type | How created | Rule |
|------|-------------|------|
| **Local copy** | Created from `_Utilities` template, filled with project values | `PROJECT_RULES.md`, `SESSION_JOURNAL.md`, `SESSION_START_PROTOCOL.md`, `DEVLOG.md`, `TODO_NEXT_SESSION.md` |
| **Symlink** | `ln -s` pointing to `_Utilities/` | Universal docs with no project-specific content |

### Current symlinks

```bash
docs/AI_AGENT_PROTOCOL.md            → ../../_Utilities/AI_AGENT_PROTOCOL.md
docs/MIGRATION_CRASH_PREVENTION_RULE.md → ../../_Utilities/MIGRATION_CRASH_PREVENTION_RULE.md
docs/MIGRATION_SAFETY_CHECKLIST.md   → ../../_Utilities/MIGRATION_SAFETY_CHECKLIST.md
```

### Rule: symlink vs local copy

- **Symlink** if: the doc is universal, has no project-specific placeholders, and should reflect upstream edits automatically.
- **Local copy** if: the doc contains `[PROJECT_NAME]`, port numbers, Railway URLs, or any other project-specific values.
- **Never symlink** `PROJECT_RULES.md`, `SESSION_JOURNAL.md`, `DEVLOG.md`, `TODO_NEXT_SESSION.md`, or `SESSION_START_PROTOCOL.md` — they are always local copies.

### Adding a new symlink

```bash
# From the TugOfWar/docs/ directory:
ln -s "../../_Utilities/FILENAME.md" FILENAME.md
```

Relative path must resolve correctly from `docs/` — test with `ls -la docs/FILENAME.md`.

---

## 📦 IMPORTS FOLDER PROTOCOL
<!-- tags: imports, framer, files, assets -->

The `imports/` folder is the Framer import root. All component files and reference assets belong here.

### Rules

1. **Use existing `imports/` folder** — never create a parallel directory for source files.
2. **Main component:** `imports/TugOfWar.jsx` — the single source of truth.
3. **Reference files** (e.g. JSON data, helper snippets, design tokens): place in `imports/` with a descriptive name. Document in the table below.
4. **Do not create subfolders** inside `imports/` unless Framer's import system explicitly supports it for this project.

### Current `imports/` contents

| File | Purpose |
|------|---------|
| `TugOfWar.jsx` | Main app component (all views, game logic, styling) |

> Update this table when adding any new file to `imports/`.

---

## 🧠 KNOWN PATTERNS & GOTCHAS
<!-- tags: gotchas, bugs, lessons -->

- `useBus` handler dependency: the `handler` passed to `useBus` is not in the `useEffect` deps array — do not add it or it will re-register the channel on every render.
- `genColorQ()` hardcodes 4 colors — it does not use `TEAM_COLORS`. Keep them in sync if colors ever change.
- `gameCode` is generated once on mount via `useState` initializer — do not move this to a `useEffect` or it will regenerate on re-renders.
