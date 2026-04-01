import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { WebSocketServer } from "ws";

/**
 * Starts a standalone WS relay on port 3041 when the dev server starts.
 * Vite proxies /ws → 3041, so clients always connect to the same host:port.
 * Avoids conflicts with Vite's internal HMR WebSocket handler.
 * In production, server/index.js handles /ws directly on the Express server.
 */
const WS_DEV_PORT = 3041;

function towWsPlugin() {
  const rooms = new Map();
  const roomState = new Map();
  const lobbyState = new Map();

  function handleConnection(ws, req) {
    const params = new URLSearchParams(req.url.replace(/^.*\?/, ""));
    const code = params.get("code");
    if (!code) { ws.close(1008, "Missing code"); return; }

    if (!rooms.has(code)) rooms.set(code, new Set());
    const room = rooms.get(code);
    room.add(ws);

    if (lobbyState.has(code)) ws.send(lobbyState.get(code));
    if (roomState.has(code)) ws.send(roomState.get(code));

    ws.on("message", (data) => {
      const raw = data.toString();
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "start_game") roomState.set(code, raw);
        if (msg.type === "reset") roomState.delete(code);
        if (msg.type === "lobby_state") lobbyState.set(code, raw);
      } catch {}
      room.forEach((client) => {
        if (client !== ws && client.readyState === 1) client.send(raw);
      });
    });

    ws.on("close", () => room.delete(ws));
    ws.on("error", () => room.delete(ws));
  }

  return {
    name: "tow-ws",
    configureServer(viteServer) {
      const wss = new WebSocketServer({ port: WS_DEV_PORT });
      wss.on("connection", handleConnection);
      // Clean up when Vite dev server stops
      viteServer.httpServer?.once("close", () => wss.close());
      console.log(`[tow-ws] WS relay listening on :${WS_DEV_PORT}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), towWsPlugin()],
  server: { port: 3040 },
});
