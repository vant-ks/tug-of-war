import { useState } from "react";

/**
 * Floating dev-only reset button (bottom-right corner).
 * Two-click confirmation prevents accidental resets.
 * Clears localStorage and hard-reloads the page.
 * Invisible in production builds.
 */
export default function DevReset() {
  const [confirming, setConfirming] = useState(false);

  if (import.meta.env.PROD) return null;

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    } else {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, textAlign: "center" }}>
      {confirming && (
        <div style={{
          background: "#E53935", color: "#fff",
          padding: "5px 10px", borderRadius: 6, fontSize: 11,
          marginBottom: 6, whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}>
          Tap again to reset
        </div>
      )}
      <button
        onClick={handleClick}
        title="Dev reset (clears localStorage + reload)"
        style={{
          width: 40, height: 40, borderRadius: "50%", border: "none",
          background: confirming ? "#E53935" : "rgba(180,40,40,0.65)",
          color: "#fff", fontSize: 18, cursor: "pointer",
          boxShadow: confirming
            ? "0 0 0 4px rgba(229,57,53,0.35)"
            : "0 2px 8px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
          animation: confirming ? "devResetPulse 0.8s ease infinite" : "none",
        }}
      >
        ↺
      </button>
      <style>{`
        @keyframes devResetPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
