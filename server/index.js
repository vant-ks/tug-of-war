const express = require("express");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// rooms: Map<code, Set<WebSocket>>
const rooms = new Map();
// wsInfo: Map<code, Map<ws, {role, teamId}>>
const wsInfo = new Map();
// roomState: Map<code, string> — last start_game payload for late joiners
const roomState = new Map();
// lobbyState: Map<code, string> — latest lobby_state (teams config) for late joiners
const lobbyState = new Map();
// qrState: Map<code, string> — latest toggle_qr for late joiners
const qrState = new Map();

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace(/^.*\?/, ""));
  const code = params.get("code");
  const role = params.get("role") || "client";

  if (!code) {
    ws.close(1008, "Missing code");
    return;
  }

  if (!rooms.has(code)) rooms.set(code, new Set());
  if (!wsInfo.has(code)) wsInfo.set(code, new Map());
  const room = rooms.get(code);
  const info = wsInfo.get(code);
  room.add(ws);
  info.set(ws, { role, teamId: null });

  // Send cached lobby config then last game state to late joiners
  if (lobbyState.has(code)) ws.send(lobbyState.get(code));
  if (roomState.has(code)) ws.send(roomState.get(code));
  if (qrState.has(code)) ws.send(qrState.get(code));

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
    r.forEach(c => { if (c.readyState === ws.OPEN) c.send(msg); });
  };
  broadcastCount();

  ws.on("message", (data) => {
    const raw = data.toString();
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "start_game") roomState.set(code, raw);
      if (msg.type === "reset") {
        roomState.delete(code);
        qrState.delete(code);
      }
      if (msg.type === "lobby_state") lobbyState.set(code, raw);
      if (msg.type === "toggle_qr") qrState.set(code, raw);
      if (msg.type === "join_team") {
        const prev = info.get(ws) || { role, teamId: null };
        info.set(ws, { ...prev, teamId: msg.teamId });
        broadcastCount();
        return; // relay-internal, not forwarded
      }
    } catch {}

    // Relay to all other clients in the room
    room.forEach((client) => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(raw);
      }
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

// Heartbeat — keeps Railway WebSocket connections alive (20s ping)
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.ping();
  });
}, 20000);

wss.on("close", () => clearInterval(heartbeat));

// Serve Vite build
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Tug of War server running on port ${PORT}`);
});
