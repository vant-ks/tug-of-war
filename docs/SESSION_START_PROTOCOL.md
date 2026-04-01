# Session Start Protocol — Tug of War

**Project:** Tug of War
**Project Dir:** `TugOfWar/`
**Last Updated:** 2026-04-01

---

## Trigger Phrase

When the user says any of:
- "Let's start a new session"
- "Start a new session"
- "Begin session"
- "Session start"

Execute this protocol automatically.

---

## Session Start Checklist

### Phase 1: Review Documentation (Grep-First)

**Step 1 — DEVLOG recent state:**
- `grep_search` for `"✅ COMPLETE|IN PROGRESS"` in `docs/DEVLOG.md` (last 60 lines)

**Step 2 — PROJECT_RULES.md navigation TOC:**
- `read_file` lines 1–50 of `docs/PROJECT_RULES.md` (the `<!-- DOCUMENT NAVIGATION -->` block)
- Then read targeted sections as needed

**Step 3 — SESSION_JOURNAL most recent session:**
- `grep_search "^## Session 20"` in `docs/SESSION_JOURNAL.md`
- `read_file` ~60 lines from the latest session heading

**Step 4 — TODO_NEXT_SESSION.md (full file):**
- `read_file` full `docs/TODO_NEXT_SESSION.md`

**Step 5 — AI_AGENT_PROTOCOL.md (lines 1–100 only):**
- `read_file` lines 1–100 of `docs/AI_AGENT_PROTOCOL.md` (symlink → `_Utilities/AI_AGENT_PROTOCOL.md`)

---

### Phase 2: Environment Check

Verify `imports/TugOfWar.jsx` is intact and start the dev server:

```bash
wc -l imports/TugOfWar.jsx
ls -la docs/
```

Start dev server (background):
```bash
npm run dev
# → http://localhost:5173
```
Verify HTTP 200 on `http://localhost:5173`.

---

### Phase 3: Git Pipeline

```bash
git status
git branch --show-current
git log --oneline -5
```

If no git repo yet, note it and skip.

---

### Phase 4: Report Back

Report:
- Last DEVLOG checkpoint (last ✅ COMPLETE task)
- Any IN PROGRESS tasks (must re-verify before new work)
- Top priorities from TODO_NEXT_SESSION.md
- Git state (or "no git repo")

---

## Session Rules (active for every session)

**DEVLOG RULE:** Add IN PROGRESS checkpoint before any task. Update to ✅ COMPLETE immediately after.

**SINGLE FILE RULE:** The Framer source stays in `imports/TugOfWar.jsx`. The dev project lives in `src/`. Keep them manually in sync when making non-trivial changes.

**NO DEPENDENCIES RULE:** No npm packages, no imports beyond what's already in the file.

**COMMIT RULE:** Use conventional commit format (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).

**SESSION JOURNAL RULE:** Log every prompt in `docs/SESSION_JOURNAL.md` in real-time.

**PROJECT RULES RULE:** If you discover a new convention or gotcha, add it to `docs/PROJECT_RULES.md` before the session ends.

**SYMLINK RULE:** Universal docs (no placeholders) go in `docs/` as symlinks to `_Utilities/`. Project-specific docs are always local copies. See `docs/PROJECT_RULES.md` → Docs Structure & Symlink Protocol.
