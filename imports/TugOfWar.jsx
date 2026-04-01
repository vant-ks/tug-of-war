import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const TEAM_COLORS = [
  { name: "Red", bg: "#E53935", light: "#EF5350", dark: "#B71C1C", glow: "rgba(229,57,53,0.6)" },
  { name: "Green", bg: "#43A047", light: "#66BB6A", dark: "#1B5E20", glow: "rgba(67,160,71,0.6)" },
  { name: "Blue", bg: "#1E88E5", light: "#42A5F5", dark: "#0D47A1", glow: "rgba(30,136,229,0.6)" },
  { name: "Yellow", bg: "#FDD835", light: "#FFEE58", dark: "#F57F17", glow: "rgba(253,216,53,0.6)" },
];

const GAME_MODES = [
  { id: "tap", label: "Tap Frenzy", icon: "👆" },
  { id: "trivia_math", label: "Math Blitz", icon: "🧮" },
  { id: "trivia_color", label: "Color Rush", icon: "🎨" },
  { id: "trivia_highlow", label: "High / Low", icon: "🔢" },
];

const TIMER_OPTIONS = [10, 20, 30];

// ─── Trivia Generators ──────────────────────────────────────────────────────
function genMathQ() {
  const a = Math.floor(Math.random() * 12) + 1;
  const b = Math.floor(Math.random() * 12) + 1;
  const correct = a * b;
  const wrongs = new Set();
  while (wrongs.size < 2) {
    const w = correct + (Math.floor(Math.random() * 20) - 10);
    if (w !== correct && w > 0) wrongs.add(w);
  }
  const opts = [correct, ...wrongs].sort(() => Math.random() - 0.5);
  return { question: `${a} × ${b} = ?`, options: opts.map(String), answer: String(correct) };
}

function genColorQ() {
  const colors = [
    { name: "RED", hex: "#E53935" },
    { name: "GREEN", hex: "#43A047" },
    { name: "BLUE", hex: "#1E88E5" },
    { name: "YELLOW", hex: "#FDD835" },
  ];
  const target = colors[Math.floor(Math.random() * 4)];
  return { prompt: `Tap ${target.name}!`, target: target.name, colors };
}

function genHighLowQ() {
  const top = Math.floor(Math.random() * 9) + 1;
  const mid = Math.floor(Math.random() * 9) + 1;
  const bot = Math.floor(Math.random() * 9) + 1;
  return { top, mid, bot, topHigher: top > mid, botLower: bot < mid };
}

// ─── BroadcastChannel helpers ────────────────────────────────────────────────
const CH_NAME = "tug-of-war-game";
function useBus(handler) {
  const chRef = useRef(null);
  useEffect(() => {
    const ch = new BroadcastChannel(CH_NAME);
    chRef.current = ch;
    ch.onmessage = (e) => handler(e.data);
    return () => ch.close();
  }, []);
  const send = useCallback((msg) => {
    chRef.current?.postMessage(msg);
  }, []);
  return send;
}

// ─── Shared Storage for cross-tab state ──────────────────────────────────────
function broadcastState(state) {
  try { localStorage.setItem("tow-state", JSON.stringify(state)); } catch {}
}
function readState() {
  try { return JSON.parse(localStorage.getItem("tow-state") || "null"); } catch { return null; }
}

// ─── Main App (Router) ──────────────────────────────────────────────────────
export default function TugOfWar() {
  const [view, setView] = useState(() => {
    const p = new URLSearchParams(window.location.search || window.location.hash.replace("#", "?"));
    return p.get("view") || "editor";
  });

  if (view === "arena") return <ArenaDisplay />;
  if (view === "player") return <PlayerView />;
  return <EditorView />;
}

// ═════════════════════════════════════════════════════════════════════════════
// EDITOR VIEW
// ═════════════════════════════════════════════════════════════════════════════
function EditorView() {
  const [gameMode, setGameMode] = useState("tap");
  const [timerLen, setTimerLen] = useState(20);
  const [teams, setTeams] = useState([
    { id: 0, name: "Red Team", enabled: true },
    { id: 1, name: "Green Team", enabled: true },
    { id: 2, name: "Blue Team", enabled: false },
    { id: 3, name: "Yellow Team", enabled: false },
  ]);
  const [gameCode, setGameCode] = useState(() => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return code;
  });
  const [gameActive, setGameActive] = useState(false);
  const [roundResults, setRoundResults] = useState(null);
  const send = useBus((msg) => {
    if (msg.type === "round_end") setRoundResults(msg.results);
  });

  const enabledTeams = teams.filter((t) => t.enabled);

  const startGame = () => {
    const state = {
      type: "start_game",
      mode: gameMode,
      timer: timerLen,
      teams: enabledTeams.map((t, i) => ({ ...t, colorIdx: t.id })),
      code: gameCode,
    };
    send(state);
    broadcastState(state);
    setGameActive(true);
    setRoundResults(null);
  };

  const resetGame = () => {
    send({ type: "reset" });
    setGameActive(false);
    setRoundResults(null);
  };

  const openArena = () => {
    window.open(window.location.href.split("?")[0] + "?view=arena", "tow-arena",
      "width=1200,height=800,menubar=no,toolbar=no");
  };

  const toggleTeam = (id) => {
    setTeams((prev) => prev.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const renameTeam = (id, name) => {
    setTeams((prev) => prev.map((t) => t.id === id ? { ...t, name } : t));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a1a 0%, #101030 50%, #0a0a1a 100%)",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', 'SF Pro Display', sans-serif",
      padding: "24px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 300, letterSpacing: 6,
            background: "linear-gradient(90deg, #E53935, #FDD835, #43A047, #1E88E5)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 4,
          }}>TUG OF WAR</h1>
          <p style={{ color: "#667", fontSize: 13, letterSpacing: 2 }}>GAME EDITOR</p>
        </div>

        {/* Game Code */}
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "16px 20px",
          marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#889", letterSpacing: 1, marginBottom: 4 }}>JOIN CODE</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 4, color: "#5eb7f1" }}>{gameCode}</div>
          </div>
          <button onClick={() => setGameCode(Math.random().toString(36).substring(2, 8).toUpperCase())}
            style={{
              background: "rgba(94,183,241,0.12)", border: "1px solid rgba(94,183,241,0.3)",
              color: "#5eb7f1", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
            }}>Regenerate</button>
        </div>

        {/* Game Mode */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#889", letterSpacing: 1, marginBottom: 10 }}>GAME MODE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {GAME_MODES.map((m) => (
              <button key={m.id} onClick={() => setGameMode(m.id)}
                style={{
                  background: gameMode === m.id ? "rgba(94,183,241,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${gameMode === m.id ? "rgba(94,183,241,0.5)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                  color: gameMode === m.id ? "#5eb7f1" : "#aab",
                  textAlign: "left", transition: "all 0.2s",
                }}>
                <span style={{ fontSize: 20, marginRight: 8 }}>{m.icon}</span>
                <span style={{ fontSize: 14 }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#889", letterSpacing: 1, marginBottom: 10 }}>ROUND TIMER</div>
          <div style={{ display: "flex", gap: 8 }}>
            {TIMER_OPTIONS.map((t) => (
              <button key={t} onClick={() => setTimerLen(t)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer",
                  background: timerLen === t ? "rgba(94,183,241,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${timerLen === t ? "rgba(94,183,241,0.5)" : "rgba(255,255,255,0.06)"}`,
                  color: timerLen === t ? "#5eb7f1" : "#aab", fontSize: 16, fontWeight: 500,
                }}>
                {t}s
              </button>
            ))}
          </div>
        </div>

        {/* Teams */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#889", letterSpacing: 1, marginBottom: 10 }}>TEAMS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teams.map((t) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 16px",
                border: `1px solid ${t.enabled ? TEAM_COLORS[t.id].bg + "44" : "rgba(255,255,255,0.04)"}`,
                opacity: t.enabled ? 1 : 0.4, transition: "all 0.2s",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: TEAM_COLORS[t.id].bg,
                }} />
                <input value={t.name}
                  onChange={(e) => renameTeam(t.id, e.target.value)}
                  style={{
                    flex: 1, background: "transparent", border: "none", color: "#dde",
                    fontSize: 14, outline: "none",
                  }} />
                <button onClick={() => toggleTeam(t.id)}
                  style={{
                    background: t.enabled ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${t.enabled ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: t.enabled ? "#66BB6A" : "#667",
                    padding: "4px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                  }}>
                  {t.enabled ? "ON" : "OFF"}
                </button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#556", marginTop: 6 }}>
            {enabledTeams.length} team{enabledTeams.length !== 1 ? "s" : ""} active (min 2 required)
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button onClick={openArena} style={{
            flex: 1, padding: "14px 0", borderRadius: 10, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#ccd", fontSize: 14, fontWeight: 500,
          }}>
            🖥️ Open Arena Display
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {!gameActive ? (
            <button onClick={startGame} disabled={enabledTeams.length < 2}
              style={{
                flex: 1, padding: "16px 0", borderRadius: 10, cursor: enabledTeams.length < 2 ? "not-allowed" : "pointer",
                background: enabledTeams.length < 2 ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #E53935, #FF7043)",
                border: "none", color: "#fff", fontSize: 16, fontWeight: 600,
                letterSpacing: 1, opacity: enabledTeams.length < 2 ? 0.4 : 1,
              }}>
              ▶ START ROUND
            </button>
          ) : (
            <button onClick={resetGame} style={{
              flex: 1, padding: "16px 0", borderRadius: 10, cursor: "pointer",
              background: "rgba(229,57,53,0.2)", border: "1px solid rgba(229,57,53,0.4)",
              color: "#EF5350", fontSize: 16, fontWeight: 600, letterSpacing: 1,
            }}>
              ■ RESET
            </button>
          )}
        </div>

        {/* Results */}
        {roundResults && (
          <div style={{
            marginTop: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12,
            padding: 20, border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 13, color: "#5eb7f1", marginBottom: 12, letterSpacing: 1 }}>ROUND RESULTS</div>
            {roundResults.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: TEAM_COLORS[r.colorIdx].bg }} />
                <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: TEAM_COLORS[r.colorIdx].light }}>
                  {r.points} pts
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Player URL hint */}
        <div style={{
          marginTop: 20, textAlign: "center", fontSize: 12, color: "#445",
          padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: 8,
        }}>
          Player URL: add <code style={{ color: "#5eb7f1" }}>?view=player</code> to this page URL
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ARENA DISPLAY
// ═════════════════════════════════════════════════════════════════════════════
function ArenaDisplay() {
  const [gameState, setGameState] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [teamForces, setTeamForces] = useState({});
  const [knotPos, setKnotPos] = useState({ x: 0, y: 0 });
  const [phase, setPhase] = useState("idle"); // idle, countdown, playing, results
  const [particles, setParticles] = useState([]);
  const [strobeOn, setStrobeOn] = useState(false);
  const animRef = useRef();
  const timerRef = useRef();
  const forceRef = useRef({});
  const teamsRef = useRef([]);
  const totalTimeRef = useRef(20);

  const send = useBus((msg) => {
    if (msg.type === "start_game") {
      teamsRef.current = msg.teams;
      totalTimeRef.current = msg.timer;
      const forces = {};
      msg.teams.forEach((t) => { forces[t.id] = 0; });
      forceRef.current = forces;
      setTeamForces(forces);
      setGameState(msg);
      setPhase("countdown");
      setCountdown(3);
      setKnotPos({ x: 0, y: 0 });
    }
    if (msg.type === "pull") {
      const tid = msg.teamId;
      if (forceRef.current[tid] !== undefined) {
        forceRef.current[tid] = (forceRef.current[tid] || 0) + (msg.power || 1);
      }
    }
    if (msg.type === "reset") {
      setPhase("idle");
      setGameState(null);
      setCountdown(null);
      forceRef.current = {};
      setTeamForces({});
      setKnotPos({ x: 0, y: 0 });
      if (timerRef.current) clearInterval(timerRef.current);
    }
  });

  // Also check localStorage for initial state
  useEffect(() => {
    const s = readState();
    if (s && s.type === "start_game") setGameState(s);
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("playing");
      setTimeLeft(totalTimeRef.current);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Game timer
  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setPhase("results");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Strobe effect during play
  useEffect(() => {
    if (phase !== "playing") { setStrobeOn(false); return; }
    const iv = setInterval(() => setStrobeOn((s) => !s), 150);
    return () => clearInterval(iv);
  }, [phase]);

  // Animation loop for knot position
  useEffect(() => {
    if (phase !== "playing" && phase !== "results") return;
    let raf;
    const tick = () => {
      const teams = teamsRef.current;
      const n = teams.length;
      if (n < 2) return;
      const forces = forceRef.current;
      const totalForce = Object.values(forces).reduce((a, b) => a + b, 0) || 1;

      // Each team pulls toward its angle
      let fx = 0, fy = 0;
      teams.forEach((t, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const strength = (forces[t.id] || 0) / totalForce;
        fx += Math.cos(angle) * strength;
        fy += Math.sin(angle) * strength;
      });

      setKnotPos((prev) => ({
        x: prev.x + (fx - prev.x) * 0.08,
        y: prev.y + (fy - prev.y) * 0.08,
      }));
      setTeamForces({ ...forceRef.current });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Send results when round ends
  useEffect(() => {
    if (phase !== "results" || !gameState) return;
    const teams = teamsRef.current;
    const n = teams.length;
    const maxDist = Math.sqrt(knotPos.x * knotPos.x + knotPos.y * knotPos.y);

    // Find which team's sector the knot is closest to
    const knotAngle = Math.atan2(knotPos.y, knotPos.x);
    let bestTeam = -1;
    let bestDiff = Infinity;
    teams.forEach((t, i) => {
      const tAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      let diff = Math.abs(knotAngle - tAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < bestDiff) { bestDiff = diff; bestTeam = i; }
    });

    const pct = Math.min(maxDist * 100, 100);
    const results = teams.map((t, i) => ({
      ...t,
      points: i === bestTeam && pct > 5 ? Math.round(pct * 10) : 0,
    }));
    send({ type: "round_end", results });

    // Burst particles for winner
    if (pct > 5) {
      const winColor = TEAM_COLORS[teams[bestTeam].colorIdx].bg;
      const burst = Array.from({ length: 40 }, (_, i) => ({
        id: Date.now() + i,
        x: 50 + knotPos.x * 30,
        y: 50 + knotPos.y * 30,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color: winColor,
        life: 1,
      }));
      setParticles(burst);
    }
  }, [phase]);

  // Particle decay
  useEffect(() => {
    if (particles.length === 0) return;
    const iv = setInterval(() => {
      setParticles((ps) => ps.map((p) => ({
        ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, life: p.life - 0.02,
      })).filter((p) => p.life > 0));
    }, 30);
    return () => clearInterval(iv);
  }, [particles.length > 0]);

  const teams = gameState?.teams || [];
  const n = teams.length;

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      background: "#050510",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      {/* Ballyhoo background glow */}
      {phase === "playing" && (
        <div style={{
          position: "absolute", inset: 0,
          background: strobeOn
            ? "radial-gradient(ellipse at center, rgba(94,183,241,0.06) 0%, transparent 70%)"
            : "radial-gradient(ellipse at center, rgba(229,57,53,0.04) 0%, transparent 70%)",
          transition: "background 0.15s",
        }} />
      )}

      {/* Scanning light beams */}
      {phase === "playing" && (
        <>
          <div style={{
            position: "absolute", width: 4, height: "140%",
            background: "linear-gradient(to bottom, transparent, rgba(94,183,241,0.15), transparent)",
            top: "-20%", left: "50%",
            animation: "scanBeam 3s linear infinite",
            transformOrigin: "center center",
          }} />
          <div style={{
            position: "absolute", width: 4, height: "140%",
            background: "linear-gradient(to bottom, transparent, rgba(229,57,53,0.12), transparent)",
            top: "-20%", left: "50%",
            animation: "scanBeam 4.5s linear infinite reverse",
            transformOrigin: "center center",
          }} />
        </>
      )}

      <svg viewBox="-50 -50 100 100" style={{
        width: "min(85vw, 85vh)", height: "min(85vw, 85vh)",
        filter: phase === "playing" ? "drop-shadow(0 0 20px rgba(94,183,241,0.15))" : "none",
      }}>
        <defs>
          {teams.map((t, i) => {
            const c = TEAM_COLORS[t.colorIdx];
            return (
              <radialGradient key={`g${i}`} id={`tg${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={c.bg} stopOpacity="0.15" />
                <stop offset="100%" stopColor={c.bg} stopOpacity="0.4" />
              </radialGradient>
            );
          })}
          <radialGradient id="arenaGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1a3a" />
            <stop offset="100%" stopColor="#0a0a18" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Arena circle */}
        <circle cx={0} cy={0} r={40} fill="url(#arenaGlow)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.3} />

        {/* Team sectors */}
        {n > 0 && teams.map((t, i) => {
          const startAngle = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
          const endAngle = startAngle + (Math.PI * 2) / n;
          const r = 40;
          const x1 = Math.cos(startAngle) * r;
          const y1 = Math.sin(startAngle) * r;
          const x2 = Math.cos(endAngle) * r;
          const y2 = Math.sin(endAngle) * r;
          const large = n <= 2 ? 1 : 0;
          return (
            <path key={`sec${i}`}
              d={`M0,0 L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`}
              fill={`url(#tg${i})`}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.2}
            />
          );
        })}

        {/* Team labels */}
        {teams.map((t, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = Math.cos(angle) * 32;
          const ly = Math.sin(angle) * 32;
          const c = TEAM_COLORS[t.colorIdx];
          return (
            <g key={`lbl${i}`}>
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                fill={c.light} fontSize={3.2} fontWeight="600" fontFamily="'Segoe UI', sans-serif">
                {t.name}
              </text>
              <text x={lx} y={ly + 4} textAnchor="middle" dominantBaseline="central"
                fill={c.light} fontSize={2} fontFamily="'Segoe UI', sans-serif" opacity={0.7}>
                {teamForces[t.id] || 0} pulls
              </text>
            </g>
          );
        })}

        {/* Ropes from edge to knot */}
        {teams.map((t, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const edgeX = Math.cos(angle) * 40;
          const edgeY = Math.sin(angle) * 40;
          const kx = knotPos.x * 30;
          const ky = knotPos.y * 30;
          const c = TEAM_COLORS[t.colorIdx];
          const tension = (teamForces[t.id] || 0);
          const thick = 0.5 + Math.min(tension / 50, 1.5);
          return (
            <line key={`rope${i}`}
              x1={edgeX} y1={edgeY} x2={kx} y2={ky}
              stroke={c.bg} strokeWidth={thick}
              strokeLinecap="round" filter="url(#glow)"
              style={{ transition: "stroke-width 0.3s" }}
            />
          );
        })}

        {/* Center knot */}
        <circle cx={knotPos.x * 30} cy={knotPos.y * 30} r={2.5}
          fill="#ddd" stroke="#fff" strokeWidth={0.4} filter="url(#glow)"
        />
        <circle cx={knotPos.x * 30} cy={knotPos.y * 30} r={1.2}
          fill="#999"
        />

        {/* Ring markers */}
        {[10, 20, 30].map((r) => (
          <circle key={`ring${r}`} cx={0} cy={0} r={r}
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.15} />
        ))}
      </svg>

      {/* Particles */}
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.x}%`, top: `${p.y}%`,
          width: 6, height: 6, borderRadius: "50%",
          background: p.color,
          opacity: p.life,
          boxShadow: `0 0 8px ${p.color}`,
          transform: "translate(-50%,-50%)",
          pointerEvents: "none",
        }} />
      ))}

      {/* Countdown overlay */}
      {phase === "countdown" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.7)", zIndex: 10,
        }}>
          <div style={{
            fontSize: 140, fontWeight: 200, color: "#fff",
            textShadow: "0 0 60px rgba(94,183,241,0.5)",
            animation: "countPulse 1s ease-in-out infinite",
            fontFamily: "'Segoe UI', sans-serif",
          }}>
            {countdown}
          </div>
        </div>
      )}

      {/* Timer */}
      {phase === "playing" && (
        <div style={{
          position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
          fontSize: 48, fontWeight: 300, color: timeLeft <= 5 ? "#E53935" : "#fff",
          textShadow: timeLeft <= 5 ? "0 0 20px rgba(229,57,53,0.6)" : "0 0 20px rgba(255,255,255,0.2)",
          fontFamily: "'Segoe UI', sans-serif", letterSpacing: 4,
          transition: "color 0.3s",
        }}>
          {timeLeft}
        </div>
      )}

      {/* Results overlay */}
      {phase === "results" && (
        <div style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)", borderRadius: 16, padding: "20px 40px",
          border: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center", minWidth: 300,
        }}>
          <div style={{
            fontSize: 18, letterSpacing: 4, color: "#5eb7f1", marginBottom: 16,
            fontWeight: 300, fontFamily: "'Segoe UI', sans-serif",
          }}>ROUND OVER</div>
          {teams.map((t, i) => {
            const totalF = Object.values(teamForces).reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round(((teamForces[t.id] || 0) / totalF) * 100);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 4,
                  background: TEAM_COLORS[t.colorIdx].bg,
                }} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 15, color: "#dde" }}>{t.name}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: TEAM_COLORS[t.colorIdx].light }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Idle state */}
      {phase === "idle" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column",
        }}>
          <div style={{
            fontSize: 48, fontWeight: 200, letterSpacing: 8,
            background: "linear-gradient(90deg, #E53935, #FDD835, #43A047, #1E88E5)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 12, fontFamily: "'Segoe UI', sans-serif",
          }}>TUG OF WAR</div>
          <div style={{ color: "#556", fontSize: 14, letterSpacing: 3 }}>WAITING FOR GAME START</div>
          {gameState && (
            <div style={{ color: "#5eb7f1", fontSize: 24, marginTop: 20, letterSpacing: 6 }}>
              {gameState.code}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes countPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.8; }
        }
        @keyframes scanBeam {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PLAYER VIEW
// ═════════════════════════════════════════════════════════════════════════════
function PlayerView() {
  const [joined, setJoined] = useState(false);
  const [teamId, setTeamId] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [gameState, setGameState] = useState(null);
  const [phase, setPhase] = useState("join"); // join, lobby, countdown, playing, done
  const [countdown, setCountdown] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [triviaQ, setTriviaQ] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [tapFlash, setTapFlash] = useState(false);
  const timerRef = useRef();
  const totalTimeRef = useRef(20);
  const scoreRef = useRef(0);

  const send = useBus((msg) => {
    if (msg.type === "start_game") {
      setGameState(msg);
      totalTimeRef.current = msg.timer;
      if (joined) {
        setPhase("countdown");
        setCountdown(3);
        scoreRef.current = 0;
        setScore(0);
      }
    }
    if (msg.type === "reset") {
      setPhase(joined ? "lobby" : "join");
      setGameState(null);
      setScore(0);
      scoreRef.current = 0;
    }
  });

  // Also read localStorage
  useEffect(() => {
    const s = readState();
    if (s && s.type === "start_game") setGameState(s);
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("playing");
      setTimeLeft(totalTimeRef.current);
      nextTrivia();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Play timer
  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const nextTrivia = () => {
    if (!gameState) return;
    const mode = gameState.mode;
    if (mode === "trivia_math") setTriviaQ({ type: "math", ...genMathQ() });
    else if (mode === "trivia_color") setTriviaQ({ type: "color", ...genColorQ() });
    else if (mode === "trivia_highlow") setTriviaQ({ type: "highlow", ...genHighLowQ() });
  };

  const doPull = (power = 1) => {
    send({ type: "pull", teamId, power });
    scoreRef.current += power;
    setScore(scoreRef.current);
  };

  const handleTap = () => {
    if (phase !== "playing") return;
    doPull(1);
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 80);
  };

  const handleMathAnswer = (ans) => {
    if (triviaQ?.answer === ans) {
      doPull(5);
      setFeedback("✓");
    } else {
      setFeedback("✗");
    }
    setTimeout(() => { setFeedback(null); nextTrivia(); }, 400);
  };

  const handleColorTap = (colorName) => {
    if (triviaQ?.target === colorName) {
      doPull(5);
      setFeedback("✓");
    } else {
      setFeedback("✗");
    }
    setTimeout(() => { setFeedback(null); nextTrivia(); }, 400);
  };

  const handleHighLow = (zone) => {
    const q = triviaQ;
    let correct = false;
    if (zone === "top" && q.topHigher) correct = true;
    if (zone === "bottom" && q.botLower) correct = true;
    if (correct) {
      doPull(5);
      setFeedback("✓");
    } else {
      setFeedback("✗");
    }
    setTimeout(() => { setFeedback(null); nextTrivia(); }, 400);
  };

  const joinGame = () => {
    setJoined(true);
    setPhase("lobby");
  };

  const teamColor = teamId !== null ? TEAM_COLORS[teamId] : null;

  // JOIN screen
  if (phase === "join") {
    const gs = gameState;
    const availableTeams = gs?.teams || [];
    return (
      <div style={playerShell}>
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <h1 style={{
            fontSize: 28, fontWeight: 300, letterSpacing: 4,
            background: "linear-gradient(90deg, #E53935, #FDD835, #43A047, #1E88E5)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 32,
          }}>TUG OF WAR</h1>

          {availableTeams.length === 0 && (
            <p style={{ color: "#778", fontSize: 14 }}>Waiting for game to be created...</p>
          )}

          {availableTeams.length > 0 && (
            <>
              <p style={{ color: "#aab", fontSize: 14, marginBottom: 20 }}>Choose your team</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300, margin: "0 auto" }}>
                {availableTeams.map((t) => {
                  const c = TEAM_COLORS[t.colorIdx];
                  const selected = teamId === t.id;
                  return (
                    <button key={t.id} onClick={() => setTeamId(t.id)} style={{
                      padding: "16px 20px", borderRadius: 12, cursor: "pointer",
                      background: selected ? c.bg + "30" : "rgba(255,255,255,0.04)",
                      border: `2px solid ${selected ? c.bg : "rgba(255,255,255,0.06)"}`,
                      color: selected ? c.light : "#aab",
                      fontSize: 16, fontWeight: 500, transition: "all 0.2s",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: c.bg }} />
                      {t.name}
                    </button>
                  );
                })}
              </div>
              {teamId !== null && (
                <button onClick={joinGame} style={{
                  marginTop: 24, padding: "14px 48px", borderRadius: 12,
                  background: TEAM_COLORS[teamId].bg, border: "none",
                  color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                  letterSpacing: 1,
                }}>
                  JOIN
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // LOBBY
  if (phase === "lobby") {
    return (
      <div style={{ ...playerShell, background: teamColor ? teamColor.dark : "#0a0a1a" }}>
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", margin: "0 auto 20px",
            background: teamColor?.bg, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, boxShadow: `0 0 40px ${teamColor?.glow}`,
          }}>💪</div>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 500, marginBottom: 8 }}>{
            gameState?.teams?.find((t) => t.id === teamId)?.name
          }</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Get ready...</p>
        </div>
      </div>
    );
  }

  // COUNTDOWN
  if (phase === "countdown") {
    return (
      <div style={{ ...playerShell, background: teamColor?.dark || "#0a0a1a" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100vh", flexDirection: "column",
        }}>
          <div style={{
            fontSize: 120, fontWeight: 200, color: "#fff",
            textShadow: `0 0 60px ${teamColor?.glow}`,
            animation: "countPulse 1s ease-in-out infinite",
          }}>{countdown}</div>
          <style>{`@keyframes countPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }`}</style>
        </div>
      </div>
    );
  }

  // PLAYING
  if (phase === "playing") {
    const mode = gameState?.mode || "tap";
    return (
      <div style={{
        ...playerShell,
        background: tapFlash ? teamColor?.bg : (teamColor?.dark || "#0a0a1a"),
        transition: "background 0.08s",
      }}>
        {/* Top bar: timer + score */}
        <div style={{
          display: "flex", justifyContent: "space-between", padding: "12px 20px",
          background: "rgba(0,0,0,0.3)",
        }}>
          <div style={{ color: timeLeft <= 5 ? "#E53935" : "#fff", fontSize: 28, fontWeight: 300 }}>
            {timeLeft}s
          </div>
          <div style={{ color: teamColor?.light, fontSize: 28, fontWeight: 600 }}>
            {score}
          </div>
        </div>

        {/* Feedback flash */}
        {feedback && (
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            fontSize: 80, zIndex: 100, pointerEvents: "none",
            color: feedback === "✓" ? "#4CAF50" : "#E53935",
            textShadow: feedback === "✓" ? "0 0 30px #4CAF50" : "0 0 30px #E53935",
          }}>{feedback}</div>
        )}

        {/* TAP MODE */}
        {mode === "tap" && (
          <div onClick={handleTap} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
            flexDirection: "column",
          }}>
            <div style={{
              fontSize: 64, marginBottom: 12,
              animation: "tapBounce 0.5s ease infinite",
            }}>👆</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 18, fontWeight: 500, letterSpacing: 2 }}>
              TAP! TAP! TAP!
            </div>
            <style>{`@keyframes tapBounce { 0%,100%{transform:scale(1)} 50%{transform:scale(0.9)} }`}</style>
          </div>
        )}

        {/* MATH MODE */}
        {mode === "trivia_math" && triviaQ?.type === "math" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20 }}>
            <div style={{
              textAlign: "center", fontSize: 28, color: "#fff", fontWeight: 300,
              marginBottom: 24, marginTop: 40,
            }}>
              {triviaQ.question}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 300, margin: "0 auto", width: "100%" }}>
              {triviaQ.options.map((opt, i) => (
                <button key={i} onClick={() => handleMathAnswer(opt)} style={{
                  padding: "18px 20px", borderRadius: 12, cursor: "pointer",
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff", fontSize: 22, fontWeight: 500,
                }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* COLOR MODE */}
        {mode === "trivia_color" && triviaQ?.type === "color" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{
              textAlign: "center", fontSize: 24, color: "#fff", fontWeight: 500,
              padding: "20px 0", letterSpacing: 2,
            }}>
              {triviaQ.prompt}
            </div>
            <div style={{
              flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr", gap: 4, padding: 4,
            }}>
              {triviaQ.colors.map((c) => (
                <button key={c.name} onClick={() => handleColorTap(c.name)} style={{
                  background: c.hex, border: "none", cursor: "pointer",
                  borderRadius: 8, fontSize: 18, fontWeight: 700,
                  color: c.name === "YELLOW" ? "#333" : "#fff",
                  textShadow: c.name === "YELLOW" ? "none" : "0 1px 3px rgba(0,0,0,0.5)",
                }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* HIGH/LOW MODE */}
        {mode === "trivia_highlow" && triviaQ?.type === "highlow" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <button onClick={() => handleHighLow("top")} style={{
              flex: 1, background: "rgba(76,175,80,0.15)", border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column",
            }}>
              <div style={{ fontSize: 56, fontWeight: 300, color: "#fff" }}>{triviaQ.top}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>TAP IF HIGHER ▲</div>
            </button>
            <div style={{
              padding: "16px 0", textAlign: "center", background: "rgba(255,255,255,0.05)",
            }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>MIDDLE</div>
              <div style={{ fontSize: 42, fontWeight: 600, color: "#5eb7f1" }}>{triviaQ.mid}</div>
            </div>
            <button onClick={() => handleHighLow("bottom")} style={{
              flex: 1, background: "rgba(229,57,53,0.15)", border: "none",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column",
            }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>TAP IF LOWER ▼</div>
              <div style={{ fontSize: 56, fontWeight: 300, color: "#fff" }}>{triviaQ.bot}</div>
            </button>
          </div>
        )}
      </div>
    );
  }

  // DONE
  if (phase === "done") {
    return (
      <div style={{ ...playerShell, background: teamColor?.dark || "#0a0a1a" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100vh", flexDirection: "column", padding: 24,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", letterSpacing: 2, marginBottom: 8 }}>
            ROUND OVER
          </div>
          <div style={{
            fontSize: 56, fontWeight: 600, color: teamColor?.light,
            textShadow: `0 0 30px ${teamColor?.glow}`,
          }}>{score}</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            points contributed
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const playerShell = {
  minHeight: "100vh",
  background: "#0a0a1a",
  color: "#e0e0e0",
  fontFamily: "'Segoe UI', sans-serif",
  display: "flex",
  flexDirection: "column",
};
