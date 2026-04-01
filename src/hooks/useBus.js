import { useRef, useEffect, useCallback } from "react";

const CH_NAME = "tug-of-war-game";

export function useBus(handler) {
  const chRef = useRef(null);
  useEffect(() => {
    const ch = new BroadcastChannel(CH_NAME);
    chRef.current = ch;
    ch.onmessage = (e) => handler(e.data);
    return () => ch.close();
  }, []);
  const send = useCallback((msg) => {
    chRef.current?.postMessage(msg);
  }, []);
  return send;
}
