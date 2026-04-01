/**
 * Standalone WebSocket relay for Tug of War dev server.
 * Run alongside Vite via: concurrently "node server/relay.js" "vite"
 * In production this logic lives in server/index.js (Express + ws on the same port).
 */

const { WebSocketServer } = require("ws");

const PORT = 3041;

const rooms = new Map();     // code → Set<ws>
const roomState = new Map(); // code → last start_game JSON string
const lobbyState = new Map(); // code → last lobby_state JSON string

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace(/^.*\?/, ""));
  const code = params.get("code");
  if (!code) { ws.close(1008, "Missing code"); return; }

  if (!rooms.has(code)) rooms.set(code, new Set());
  const room = rooms.get(code);
  room.add(ws);

  // Deliver cached state to late joiners
  if (lobbyState.has(code)) ws.send(lobbyState.get(code));
  if (roomState.has(code))  ws.send(roomState.get(code));

  ws.on("message", (data) => {
    const raw = data.toString();
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "start_game")  roomState.set(code, raw);
      if (msg.type === "reset")       roomState.delete(code);
      if (msg.type === "lobby_state") lobbyState.set(code, raw);
    } catch {}

    // Relay to all other clients in the room
    room.forEach((client) => {
      if (client !== ws && client.readyState === 1) client.send(raw);
    });
  });

  ws.on("close", () => {
    room.delete(ws);
    if (room.size === 0) rooms.delete(code);
  });
  ws.on("error", () => room.delete(ws));
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
