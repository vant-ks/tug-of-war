import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { TEAM_COLORS } from "../constants";
import { useBus } from "../hooks/useBus";
import { readState } from "../utils/storage";

export default function ArenaDisplay() {
  const [gameState, setGameState] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [teamForces, setTeamForces] = useState({});
  const [knotPos, setKnotPos] = useState({ x: 0, y: 0 });
  const [phase, setPhase] = useState("idle"); // idle, countdown, playing, results
  const [particles, setParticles] = useState([]);
  const [strobeOn, setStrobeOn] = useState(false);
  const [showQR, setShowQR] = useState(false);
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
    if (msg.type === "toggle_qr") {
      setShowQR(msg.show);
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
      {/* Background glow */}
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

      {showQR && (() => {
        const playerUrl = `${window.location.origin}${window.location.pathname}?view=player`;
        return (
          <div style={{
            position: "absolute", bottom: 24, right: 24, zIndex: 50,
            background: "#fff", borderRadius: 14, padding: "16px 20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", textAlign: "center",
          }}>
            <QRCodeSVG value={playerUrl} size={160} level="M" />
            <div style={{
              fontSize: 11, color: "#444", marginTop: 10,
              fontFamily: "monospace", maxWidth: 160, wordBreak: "break-all",
            }}>
              {playerUrl}
            </div>
          </div>
        );
      })()}

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
