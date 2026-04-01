import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { WebSocketServer } from "ws";

/**
 * Embeds the TugOfWar WebSocket relay directly in the Vite dev server.
 * This means `npm run dev` is all you need — no separate WS server process.
 * All browsers and incognito windows communicate through the same relay on :3040.
 */
function towWsPlugin() {
  const rooms = new Map();
  const roomState = new Map();
  const lobbyState = new Map();

  return {
    name: "tow-ws",
    configureServer(viteServer) {
      const wss = new WebSocketServer({ noServer: true });

      // Intercept HTTP upgrade events — only handle our /ws path,
      // leave everything else (Vite HMR) untouched.
      viteServer.httpServer?.on("upgrade", (req, socket, head) => {
        try {
          const pathname = new URL(req.url, "http://localhost").pathname;
          if (pathname !== "/ws") return;
        } catch { return; }

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      });

      wss.on("connection", (ws, req) => {
        const params = new URLSearchParams(req.url.replace(/^.*\?/, ""));
        const code = params.get("code");
        if (!code) { ws.close(1008, "Missing code"); return; }

        if (!rooms.has(code)) rooms.set(code, new Set());
        const room = rooms.get(code);
        room.add(ws);

        // Send cached state to late joiners
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
      });

      viteServer.httpServer?.once("close", () => wss.close());
    },
  };
}

export default defineConfig({
  plugins: [react(), towWsPlugin()],
  server: { port: 3040 },
});
