import { useState, useEffect, useRef } from "react";
import { TEAM_COLORS, GAME_MODES } from "../constants";
import { useSocket } from "../hooks/useSocket";
import { readState } from "../utils/storage";
import { genMathQ, genColorQ, genHighLowQ } from "../utils/trivia";

const playerShell = {
  minHeight: "100vh",
  background: "#0a0a1a",
  color: "#e0e0e0",
  fontFamily: "'Segoe UI', sans-serif",
  display: "flex",
  flexDirection: "column",
};

export default function PlayerView() {
  const urlCode = new URLSearchParams(window.location.search).get("code");
  const [joined, setJoined] = useState(false);
  const [teamId, setTeamId] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [gameInProgress, setGameInProgress] = useState(false);
  const [lobbyMode, setLobbyMode] = useState(null);
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

  const send = useSocket((msg) => {
    if (msg.type === "lobby_state") {
      setAvailableTeams(msg.teams);
      if (msg.mode) setLobbyMode(msg.mode);
    }
    if (msg.type === "start_game") {
      setGameState(msg);
      totalTimeRef.current = msg.timer;
      setAvailableTeams(msg.teams);
      setGameInProgress(true);
      if (joined) {
        setPhase("countdown");
        setCountdown(3);
        scoreRef.current = 0;
        setScore(0);
      }
      // if not yet joined, player stays on join screen to pick team for next round
    }
    if (msg.type === "reset") {
      setGameInProgress(false);
      setPhase(joined ? "lobby" : "join");
      setGameState(null);
      setScore(0);
      scoreRef.current = 0;
    }
  }, urlCode, "player");
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
    return (
      <div style={playerShell}>
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <h1 style={{
            fontSize: 28, fontWeight: 300, letterSpacing: 4,
            background: "linear-gradient(90deg, #E53935, #FDD835, #43A047, #1E88E5)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 32,
          }}>TUG OF WAR</h1>

          {urlCode && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#556", letterSpacing: 2, marginBottom: 4 }}>GAME CODE</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6, color: "#5eb7f1", fontFamily: "monospace" }}>
                {urlCode}
              </div>
            </div>
          )}

          {gameInProgress && (
            <div style={{
              marginBottom: 16, padding: "8px 16px", borderRadius: 8,
              background: "rgba(253,216,53,0.1)", border: "1px solid rgba(253,216,53,0.3)",
              color: "#FDD835", fontSize: 13, letterSpacing: 1,
            }}>GAME IN PROGRESS — pick team for next round</div>
          )}

          {availableTeams.length === 0 && (
            <p style={{ color: "#778", fontSize: 14 }}>Waiting for host to set up game...</p>
          )}

          {availableTeams.length > 0 && (
            <>
              {lobbyMode && (
                <div style={{ marginBottom: 16, color: "#778", fontSize: 13, letterSpacing: 1 }}>
                  {GAME_MODES.find(m => m.id === lobbyMode)?.icon} {GAME_MODES.find(m => m.id === lobbyMode)?.label}
                </div>
              )}
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
                  {gameInProgress ? "JOIN NEXT ROUND" : "JOIN"}
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
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
            {gameState?.teams?.find((t) => t.id === teamId)?.name || availableTeams.find((t) => t.id === teamId)?.name}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
            {gameInProgress ? "Waiting for next round..." : "Get ready..."}
          </p>
          {lobbyMode && !gameInProgress && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 8, letterSpacing: 1 }}>
              {GAME_MODES.find(m => m.id === lobbyMode)?.icon} {GAME_MODES.find(m => m.id === lobbyMode)?.label}
            </div>
          )}
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
