/**
 * Standalone WebSocket relay for Tug of War dev server.
 * Run alongside Vite via: concurrently "node server/relay.js" "vite"
 * In production this logic lives in server/index.js (Express + ws on the same port).
 */

const { WebSocketServer } = require("ws");

const PORT = 3041;

const rooms = new Map();      // code → Set<ws>
const wsInfo = new Map();     // code → Map<ws, {role, teamId}>
const roomState = new Map();  // code → last start_game JSON string
const lobbyState = new Map(); // code → last lobby_state JSON string

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace(/^.*\?/, ""));
  const code = params.get("code");
  const role = params.get("role") || "client";
  if (!code) { ws.close(1008, "Missing code"); return; }

  if (!rooms.has(code)) rooms.set(code, new Set());
  if (!wsInfo.has(code)) wsInfo.set(code, new Map());
  const room = rooms.get(code);
  const info = wsInfo.get(code);
  room.add(ws);
  info.set(ws, { role, teamId: null });

  // Deliver cached state to late joiners
  if (lobbyState.has(code)) ws.send(lobbyState.get(code));
  if (roomState.has(code))  ws.send(roomState.get(code));

  // Broadcast player count + per-team counts to everyone in room
  const broadcastCount = () => {
    const r = rooms.get(code);
    const inf = wsInfo.get(code);
    if (!r || !inf) return;
    const teamCounts = {};
    let playerCount = 0;
    inf.forEach((d) => {
      if (d.role === "player" && d.teamId !== null) {
        playerCount++;
        teamCounts[d.teamId] = (teamCounts[d.teamId] || 0) + 1;
      }
    });
    const msg = JSON.stringify({ type: "connected", count: playerCount, teamCounts });
    r.forEach(c => { if (c.readyState === 1) c.send(msg); });
  };
  broadcastCount();

  ws.on("message", (data) => {
    const raw = data.toString();
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "start_game")  roomState.set(code, raw);
      if (msg.type === "reset")       roomState.delete(code);
      if (msg.type === "lobby_state") lobbyState.set(code, raw);
      if (msg.type === "join_team") {
        const prev = info.get(ws) || { role, teamId: null };
        info.set(ws, { ...prev, teamId: msg.teamId });
        broadcastCount();
        return; // relay-internal, not forwarded
      }
    } catch {}

    // Relay to all other clients in the room
    room.forEach((client) => {
      if (client !== ws && client.readyState === 1) client.send(raw);
    });
  });

  ws.on("close", () => {
    room.delete(ws);
    info.delete(ws);
    if (room.size === 0) {
      rooms.delete(code);
      wsInfo.delete(code);
    } else {
      broadcastCount();
    }
  });
  ws.on("error", () => {
    room.delete(ws);
    info.delete(ws);
    broadcastCount();
  });
});

wss.on("listening", () =>
  console.log(`[relay] WS relay listening on :${PORT}`)
);

wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[relay] Port ${PORT} already in use. Run: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  } else {
    console.error("[relay] WSS error:", err.message);
  }
});

