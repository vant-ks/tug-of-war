import { useRef, useEffect, useCallback } from "react";

/**
 * useSocket(handler, code, role)
 *
 * Connects to the WebSocket relay at /ws?code=CODE&role=ROLE.
 * Works in both dev (via Vite's embedded WS plugin on :3040) and production.
 * Messages queued before socket opens are flushed on connect.
 */
export function useSocket(handler, code, role = "client") {
  const connRef = useRef(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const sendQueueRef = useRef([]);

  useEffect(() => {
    if (!code) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws?code=${encodeURIComponent(code)}&role=${role}`;
    const ws = new WebSocket(url);
    connRef.current = ws;

    ws.onopen = () => {
      sendQueueRef.current.forEach((msg) => ws.send(msg));
      sendQueueRef.current = [];
    };

    ws.onmessage = (e) => {
      try { handlerRef.current(JSON.parse(e.data)); } catch {}
    };

    ws.onclose = () => { connRef.current = null; };

    return () => {
      ws.close();
      connRef.current = null;
      sendQueueRef.current = [];
    };
  }, [code, role]);

  const send = useCallback((msg) => {
    const ws = connRef.current;
    if (!ws) return;
    const json = JSON.stringify(msg);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    } else {
      sendQueueRef.current.push(json);
    }
  }, []);

  return send;
}
