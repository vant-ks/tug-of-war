export function broadcastState(state) {
  try { localStorage.setItem("tow-state", JSON.stringify(state)); } catch {}
}

export function readState() {
  try { return JSON.parse(localStorage.getItem("tow-state") || "null"); } catch { return null; }
}
