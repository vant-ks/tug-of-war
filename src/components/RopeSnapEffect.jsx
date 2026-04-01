import { useEffect, useState, useRef } from "react";

const FALLBACK_COLORS = ["#E53935", "#43A047", "#1E88E5", "#FDD835"];

export default function RopeSnapEffect({
  active,
  knotX,
  knotY,
  teams,
  arenaSize = 800,
  onComplete,
}) {
  const [particles, setParticles] = useState([]);
  const [snapPhase, setSnapPhase] = useState("idle");
  const rafRef = useRef(0);
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!active || hasTriggered.current) return;
    hasTriggered.current = true;
    setSnapPhase("snap");

    const cx = arenaSize / 2;
    const cy = arenaSize / 2;
    const kx = cx + knotX * (arenaSize * 0.375);
    const ky = cy + knotY * (arenaSize * 0.375);
    const n = teams.length;
    const allParticles = [];
    let pid = 0;

    teams.forEach((team, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const edgeX = cx + Math.cos(angle) * (arenaSize * 0.4);
      const edgeY = cy + Math.sin(angle) * (arenaSize * 0.4);
      const color = FALLBACK_COLORS[team.colorIdx] || "#888";

      for (let j = 0; j < 12; j++) {
        const frac = j / 11;
        const px = kx + (edgeX - kx) * frac;
        const py = ky + (edgeY - ky) * frac;
        const dx = edgeX - kx;
        const dy = edgeY - ky;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const scatter = (Math.random() - 0.5) * 6;
        const outward = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);

        allParticles.push({
          id: pid++,
          x: px + (Math.random() - 0.5) * 4,
          y: py + (Math.random() - 0.5) * 4,
          vx: nx * outward + scatter * 0.3,
          vy: ny * outward + scatter * 0.3 + (Math.random() - 0.5) * 2,
          color,
          size: 2 + Math.random() * 4,
          life: 1,
          decay: 0.015 + Math.random() * 0.01,
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 15,
        });
      }

      for (let j = 0; j < 6; j++) {
        const burstAngle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        allParticles.push({
          id: pid++,
          x: kx, y: ky,
          vx: Math.cos(burstAngle) * speed,
          vy: Math.sin(burstAngle) * speed,
          color: "#FFFFFF",
          size: 3 + Math.random() * 3,
          life: 1, decay: 0.025,
          rotation: 0, rotSpeed: (Math.random() - 0.5) * 20,
        });
      }
    });

    setParticles(allParticles);
    setTimeout(() => setSnapPhase("settle"), 600);
    setTimeout(() => {
      setSnapPhase("idle");
      hasTriggered.current = false;
      onComplete?.();
    }, 1500);
  }, [active]);

  // Particle animation loop
  useEffect(() => {
    if (particles.length === 0) return;

    const tick = () => {
      setParticles(prev => {
        const next = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.12,
            vx: p.vx * 0.98,
            life: p.life - p.decay,
            rotation: p.rotation + p.rotSpeed,
          }))
          .filter(p => p.life > 0);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [particles.length > 0]);

  if (snapPhase === "idle" && particles.length === 0) return null;

  return (
    <g aria-label="Rope snap effect">
      {snapPhase === "snap" && (
        <rect x={0} y={0} width={arenaSize} height={arenaSize}
          fill="white" opacity={0.15}>
          <animate attributeName="opacity" from="0.15" to="0" dur="0.3s" fill="freeze" />
        </rect>
      )}
      {particles.map(p => (
        <g key={p.id} transform={`translate(${p.x},${p.y}) rotate(${p.rotation})`}>
          {p.size > 4 ? (
            <rect x={-p.size / 2} y={-p.size / 4}
              width={p.size} height={p.size / 2}
              fill={p.color} opacity={p.life} rx={1}
            />
          ) : (
            <circle cx={0} cy={0} r={p.size / 2}
              fill={p.color} opacity={p.life}
            />
          )}
        </g>
      ))}
    </g>
  );
}
