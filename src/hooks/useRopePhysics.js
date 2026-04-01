import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Spring-based physics hook for the center knot.
 * Returns normalized knot position (-1..1), per-team tensions, and control functions.
 */
export default function useRopePhysics({
  teamCount,
  damping = 0.92,
  stiffness = 0.004,
  maxForceDecay = 0.995,
  arenaRadius = 0.9,
}) {
  const teamAngles = useRef([]);
  useEffect(() => {
    teamAngles.current = Array.from({ length: teamCount }, (_, i) =>
      (i / teamCount) * Math.PI * 2 - Math.PI / 2
    );
  }, [teamCount]);

  const forces = useRef(new Array(teamCount).fill(0));
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });

  const [state, setState] = useState({
    knotX: 0,
    knotY: 0,
    teamTensions: new Array(teamCount).fill(0),
    totalTension: 0,
    dominantTeamIdx: 0,
  });

  const rafRef = useRef(0);
  const activeRef = useRef(true);

  const applyPull = useCallback((teamIdx, power = 1) => {
    if (teamIdx >= 0 && teamIdx < forces.current.length) {
      forces.current[teamIdx] += power;
    }
  }, []);

  const reset = useCallback(() => {
    forces.current = new Array(teamCount).fill(0);
    posRef.current = { x: 0, y: 0 };
    velRef.current = { x: 0, y: 0 };
    setState({
      knotX: 0,
      knotY: 0,
      teamTensions: new Array(teamCount).fill(0),
      totalTension: 0,
      dominantTeamIdx: 0,
    });
  }, [teamCount]);

  useEffect(() => {
    activeRef.current = true;

    const tick = () => {
      if (!activeRef.current) return;

      const angles = teamAngles.current;
      const n = angles.length;
      if (n < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const totalForce = forces.current.reduce((a, b) => a + b, 0) || 1;
      let tx = 0, ty = 0;
      let maxForce = 0, maxIdx = 0;

      for (let i = 0; i < n; i++) {
        const f = forces.current[i];
        const ratio = f / totalForce;
        tx += Math.cos(angles[i]) * ratio;
        ty += Math.sin(angles[i]) * ratio;
        if (f > maxForce) { maxForce = f; maxIdx = i; }
      }

      // Clamp target to arena
      const tDist = Math.sqrt(tx * tx + ty * ty);
      if (tDist > arenaRadius) {
        tx = (tx / tDist) * arenaRadius;
        ty = (ty / tDist) * arenaRadius;
      }

      // Spring step
      const pos = posRef.current;
      const vel = velRef.current;
      vel.x = (vel.x + (tx - pos.x) * stiffness) * damping;
      vel.y = (vel.y + (ty - pos.y) * stiffness) * damping;
      pos.x += vel.x;
      pos.y += vel.y;

      // Bounce off arena boundary
      const pDist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (pDist > arenaRadius) {
        pos.x = (pos.x / pDist) * arenaRadius;
        pos.y = (pos.y / pDist) * arenaRadius;
        const dot = (vel.x * pos.x + vel.y * pos.y) / (arenaRadius * arenaRadius);
        vel.x -= dot * pos.x * 0.5;
        vel.y -= dot * pos.y * 0.5;
      }

      // Decay forces
      for (let i = 0; i < n; i++) forces.current[i] *= maxForceDecay;

      const tensionMax = Math.max(...forces.current, 1);
      const tensions = forces.current.map(f => Math.min(f / tensionMax, 1));
      const overallTension = Math.min(pDist / arenaRadius, 1);

      setState({
        knotX: pos.x,
        knotY: pos.y,
        teamTensions: tensions,
        totalTension: overallTension,
        dominantTeamIdx: maxIdx,
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [teamCount, damping, stiffness, maxForceDecay, arenaRadius]);

  return { ...state, applyPull, reset };
}
