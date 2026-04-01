import { useState, useRef, useCallback } from "react";

/**
 * Manages per-team "pulse active" booleans for rope light-travel effects.
 * Call triggerPulse(teamIdx) when a pull arrives; pass pulseStates[i] to RopeRenderer.
 */
export default function usePullPulse(teamCount, pulseDurationMs = 300) {
  const [pulseStates, setPulseStates] = useState(() => new Array(teamCount).fill(false));
  const timers = useRef(new Array(teamCount).fill(null));

  const triggerPulse = useCallback((teamIdx) => {
    if (teamIdx < 0 || teamIdx >= teamCount) return;
    if (timers.current[teamIdx]) clearTimeout(timers.current[teamIdx]);

    setPulseStates(prev => {
      const next = [...prev];
      next[teamIdx] = true;
      return next;
    });

    timers.current[teamIdx] = setTimeout(() => {
      setPulseStates(prev => {
        const next = [...prev];
        next[teamIdx] = false;
        return next;
      });
      timers.current[teamIdx] = null;
    }, pulseDurationMs);
  }, [teamCount, pulseDurationMs]);

  const resetAll = useCallback(() => {
    timers.current.forEach(t => t && clearTimeout(t));
    timers.current = new Array(teamCount).fill(null);
    setPulseStates(new Array(teamCount).fill(false));
  }, [teamCount]);

  return { pulseStates, triggerPulse, resetAll };
}
