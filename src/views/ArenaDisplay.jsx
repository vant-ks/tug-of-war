import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { TEAM_COLORS } from "../constants";
import { useSocket } from "../hooks/useSocket";
import { readState } from "../utils/storage";
import useRopePhysics from "../hooks/useRopePhysics";
import usePullPulse from "../hooks/usePullPulse";
import RopeRenderer from "../components/RopeRenderer";
import KnotRenderer from "../components/KnotRenderer";
import RopeSnapEffect from "../components/RopeSnapEffect";

const CX = 400, CY = 400, ARENA_R = 320;

export default function ArenaDisplay() {
  const arenaCode = new URLSearchParams(window.location.search).get("code");

  const [gameState, setGameState] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [strobeOn, setStrobeOn] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [snapActive, setSnapActive] = useState(false);
  const [recentPull, setRecentPull] = useState(false);
  const [teamCount, setTeamCount] = useState(2);

  const timerRef = useRef();
  const teamsRef = useRef([]);
  const totalTimeRef = useRef(20);
  const recentPullTimerRef = useRef();

  const {
    knotX, knotY, teamTensions, totalTension, dominantTeamIdx,
    applyPull, reset: resetPhysics,
  } = useRopePhysics({ teamCount });

  const { pulseStates, triggerPulse, resetAll: resetPulses } = usePullPulse(teamCount);

  const send = useSocket((msg) => {
    if (msg.type === "start_game") {
      teamsRef.current = msg.teams;
      totalTimeRef.current = msg.timer;
      setTeamCount(msg.teams.length);
      setGameState(msg);
      setPhase("countdown");
      setCountdown(3);
      resetPhysics();
      resetPulses();
      setSnapActive(false);
    }
    if (msg.type === "pull") {
      const teamIdx = teamsRef.current.findIndex(t => t.id === msg.teamId);
      if (teamIdx >= 0) {
        applyPull(teamIdx, msg.power || 1);
        triggerPulse(teamIdx);
        setRecentPull(true);
        clearTimeout(recentPullTimerRef.current);
        recentPullTimerRef.current = setTimeout(() => setRecentPull(false), 200);
      }
    }
    if (msg.type === "reset") {
      setPhase("idle");
      setGameState(null);
      setCountdown(null);
      resetPhysics();
      resetPulses();
      setSnapActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    if (msg.type === "toggle_qr") {
      setShowQR(msg.show);
      if (msg.code) setQrCode(msg.code);
    }
  }, arenaCode, "arena");

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

  // Send results when round ends
  useEffect(() => {
    if (phase !== "results" || !gameState) return;
    const teams = teamsRef.current;
    const n = teams.length;
    setSnapActive(true);
    const knotAngle = Math.atan2(knotY, knotX);
    let bestTeam = -1, bestDiff = Infinity;
    teams.forEach((t, i) => {
      const tAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      let diff = Math.abs(knotAngle - tAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < bestDiff) { bestDiff = diff; bestTeam = i; }
    });
    const maxDist = Math.sqrt(knotX * knotX + knotY * knotY);
    const pct = Math.min(maxDist * 100, 100);
    const results = teams.map((t, i) => ({
      ...t,
      points: i === bestTeam && pct > 5 ? Math.round(pct * 10) : 0,
    }));
    send({ type: "round_end", results });
  }, [phase]);

  const teams = gameState?.teams || [];
  const n = teams.length;

  const knotSvgX = CX + knotX * (ARENA_R * 0.85);
  const knotSvgY = CY + knotY * (ARENA_R * 0.85);

  const teamAnchors = teams.map((_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: CX + Math.cos(angle) * ARENA_R, y: CY + Math.sin(angle) * ARENA_R };
  });

  const dominantColor = TEAM_COLORS[teams[dominantTeamIdx]?.colorIdx ?? 0]?.bg || "#888888";

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

      <svg viewBox="0 0 800 800" style={{
        width: "min(85vw, 85vh)", height: "min(85vw, 85vh)",
        filter: phase === "playing" ? "drop-shadow(0 0 20px rgba(94,183,241,0.15))" : "none",
        overflow: "visible",
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
        </defs>

        {/* Arena background */}
        <circle cx={CX} cy={CY} r={ARENA_R}
          fill="url(#arenaGlow)" stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />

        {/* Grid rings */}
        {[0.25, 0.5, 0.75].map(f => (
          <circle key={f} cx={CX} cy={CY} r={ARENA_R * f}
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.75} />
        ))}

        {/* Team sectors */}
        {n > 0 && teams.map((t, i) => {
          const startAngle = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
          const endAngle = startAngle + (Math.PI * 2) / n;
          const x1 = CX + Math.cos(startAngle) * ARENA_R;
          const y1 = CY + Math.sin(startAngle) * ARENA_R;
          const x2 = CX + Math.cos(endAngle) * ARENA_R;
          const y2 = CY + Math.sin(endAngle) * ARENA_R;
          const large = n <= 2 ? 1 : 0;
          return (
            <path key={`sec${i}`}
              d={`M${CX},${CY} L${x1},${y1} A${ARENA_R},${ARENA_R} 0 ${large},1 ${x2},${y2} Z`}
              fill={`url(#tg${i})`}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1}
              style={{ opacity: 0.08 + (teamTensions[i] || 0) * 0.12, transition: "opacity 0.3s" }}
            />
          );
        })}

        {/* Ropes */}
        {teams.map((t, i) => (
          <RopeRenderer key={`rope-${i}`} id={`rope-${i}`}
            startX={teamAnchors[i].x} startY={teamAnchors[i].y}
            endX={knotSvgX} endY={knotSvgY}
            color={TEAM_COLORS[t.colorIdx].bg}
            tension={teamTensions[i] || 0}
            teamName={t.name} pulseActive={pulseStates[i] || false}
            thickness={5} strandCount={3} sagAmount={40} />
        ))}

        {/* Center knot */}
        {n > 0 && (
          <KnotRenderer x={knotSvgX} y={knotSvgY} size={14}
            totalTension={totalTension} dominantColor={dominantColor}
            isActive={phase === "playing"} recentPull={recentPull} id="center-knot" />
        )}

        {/* Snap effect on round end */}
        <RopeSnapEffect active={snapActive} knotX={knotX} knotY={knotY}
          teams={teams} arenaSize={800} onComplete={() => setSnapActive(false)} />

        {/* Team labels */}
        {teams.map((t, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = CX + Math.cos(angle) * (ARENA_R * 0.68);
          const ly = CY + Math.sin(angle) * (ARENA_R * 0.68);
          const c = TEAM_COLORS[t.colorIdx];
          return (
            <text key={`lbl${i}`} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="central"
              fill={c.light} fontSize={22} fontWeight="600"
              fontFamily="'Segoe UI', sans-serif"
              style={{ filter: `drop-shadow(0 0 6px ${c.bg}80)` }}>
              {t.name}
            </text>
          );
        })}
      </svg>

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
            const totalT = teamTensions.reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round(((teamTensions[i] || 0) / totalT) * 100);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: TEAM_COLORS[t.colorIdx].bg }} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 15, color: "#dde" }}>{t.name}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: TEAM_COLORS[t.colorIdx].light }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Idle screen */}
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
        const code = qrCode || gameState?.code;
        const playerUrl = `${window.location.origin}${window.location.pathname}?view=player${code ? `&code=${code}` : ""}`;
        return (
          <div style={{
            position: "absolute", bottom: 24, right: 24, zIndex: 50,
            background: "#fff", borderRadius: 14, padding: "16px 20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", textAlign: "center",
          }}>
            <QRCodeSVG value={playerUrl} size={160} level="M" />
            {code && (
              <div style={{
                fontSize: 22, fontWeight: 700, color: "#111",
                letterSpacing: 4, marginTop: 10, fontFamily: "monospace",
              }}>
                {code}
              </div>
            )}
            <div style={{
              fontSize: 10, color: "#888", marginTop: 6,
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
