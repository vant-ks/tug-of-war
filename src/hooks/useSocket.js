import { useRef, useEffect, useCallback } from "react";

const CH_NAME = "tug-of-war-game";

/**
 * useSocket(handler, code, role)
 *
 * In dev (npm run dev): uses BroadcastChannel so local testing works unchanged.
 * In production: connects to the WebSocket server at /ws?code=CODE&role=ROLE.
 *
 * Returns a `send(msg)` function — same interface as useBus.
 * Reconnects automatically if `code` changes (e.g. editor regenerates code).
 */
export function useSocket(handler, code, role = "client") {
  const connRef = useRef(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const sendQueueRef = useRef([]);

  useEffect(() => {
    // ── Dev: BroadcastChannel fallback ──────────────────────────────────────
    if (import.meta.env.DEV) {
      const ch = new BroadcastChannel(CH_NAME);
      connRef.current = { type: "bc", conn: ch };
      ch.onmessage = (e) => handlerRef.current(e.data);
      return () => {
        ch.close();
        connRef.current = null;
      };
    }

    // ── Production: WebSocket ───────────────────────────────────────────────
    if (!code) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws?code=${encodeURIComponent(code)}&role=${role}`;
    const ws = new WebSocket(url);
    connRef.current = { type: "ws", conn: ws };

    ws.onopen = () => {
      sendQueueRef.current.forEach((msg) => ws.send(msg));
      sendQueueRef.current = [];
    };

    ws.onmessage = (e) => {
      try {
        handlerRef.current(JSON.parse(e.data));
      } catch {}
    };

    ws.onclose = () => {
      connRef.current = null;
    };

    return () => {
      ws.close();
      connRef.current = null;
      sendQueueRef.current = [];
    };
  }, [code, role]);

  const send = useCallback((msg) => {
    const c = connRef.current;
    if (!c) return;
    if (c.type === "bc") {
      c.conn.postMessage(msg);
    } else if (c.type === "ws") {
      const json = JSON.stringify(msg);
      if (c.conn.readyState === WebSocket.OPEN) {
        c.conn.send(json);
      } else {
        sendQueueRef.current.push(json);
      }
    }
  }, []);

  return send;
}
