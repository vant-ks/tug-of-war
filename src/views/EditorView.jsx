import { useState } from "react";
import { TEAM_COLORS, GAME_MODES, TIMER_OPTIONS } from "../constants";
import { useSocket } from "../hooks/useSocket";
import { broadcastState } from "../utils/storage";

export default function EditorView() {
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
  const [showQR, setShowQR] = useState(false);
  const send = useSocket((msg) => {
    if (msg.type === "round_end") setRoundResults(msg.results);
  }, gameCode, "editor");

  const enabledTeams = teams.filter((t) => t.enabled);

  const startGame = () => {
    const state = {
      type: "start_game",
      mode: gameMode,
      timer: timerLen,
      teams: enabledTeams.map((t) => ({ ...t, colorIdx: t.id })),
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
    window.open(window.location.href.split("?")[0] + `?view=arena&code=${gameCode}`, "tow-arena",
      "width=1200,height=800,menubar=no,toolbar=no");
  };

  const openPlayer = () => {
    window.open(window.location.href.split("?")[0] + `?view=player&code=${gameCode}`, "tow-player",
      "width=390,height=844,menubar=no,toolbar=no");
  };

  const toggleQR = () => {
    const next = !showQR;
    setShowQR(next);
    send({ type: "toggle_qr", show: next, code: gameCode });
  };

  const regenerateCode = () => {
    const next = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGameCode(next);
    if (showQR) send({ type: "toggle_qr", show: true, code: next });
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
          <button onClick={regenerateCode}
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
          </button>          <button onClick={openPlayer} style={{
            flex: 1, padding: "14px 0", borderRadius: 10, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#ccd", fontSize: 14, fontWeight: 500,
          }}>
            📱 Open Player View
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <button onClick={toggleQR} style={{
            width: "100%", padding: "12px 0", borderRadius: 10, cursor: "pointer",
            background: showQR ? "rgba(94,183,241,0.15)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${showQR ? "rgba(94,183,241,0.5)" : "rgba(255,255,255,0.08)"}`,
            color: showQR ? "#5eb7f1" : "#889", fontSize: 14, fontWeight: 500,
          }}>
            📷 {showQR ? "Hide QR Code on Arena" : "Show QR Code on Arena"}
          </button>        </div>

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
