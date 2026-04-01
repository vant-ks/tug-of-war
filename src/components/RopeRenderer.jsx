import { useMemo } from "react";

// ─── Catenary sag path ────────────────────────────────────────────────────────
function buildRopePath(sx, sy, ex, ey, tension, sagMax) {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return `M${sx},${sy}L${ex},${ey}`;

  const nx = -dy / len;
  const ny = dx / len;
  const sag = sagMax * (1 - tension * 0.85);

  const cp1x = sx + dx * 0.3 + nx * sag;
  const cp1y = sy + dy * 0.3 + ny * sag;
  const cp2x = sx + dx * 0.7 + nx * sag * 0.9;
  const cp2y = sy + dy * 0.7 + ny * sag * 0.9;

  return `M${sx},${sy} C${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;
}

// ─── Braided strand paths ─────────────────────────────────────────────────────
function buildStrandPaths(sx, sy, ex, ey, tension, sagMax, strandCount, thickness) {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return [buildRopePath(sx, sy, ex, ey, tension, sagMax)];

  const nx = -dy / len;
  const ny = dx / len;
  const spread = thickness * 0.35;
  const paths = [];

  for (let i = 0; i < strandCount; i++) {
    const tOff = strandCount === 1 ? 0 : (i / (strandCount - 1) - 0.5) * 2;
    const offset = tOff * spread;
    const points = [];
    const segments = 20;

    for (let s = 0; s <= segments; s++) {
      const frac = s / segments;
      const sag = sagMax * (1 - tension * 0.85);
      const bx = sx + dx * frac + nx * sag * 4 * frac * (1 - frac);
      const by = sy + dy * frac + ny * sag * 4 * frac * (1 - frac);
      const weaveFreq = 3 + strandCount;
      const weaveAmp = spread * 0.6;
      const weavePhase = (i / strandCount) * Math.PI * 2;
      const weave = Math.sin(frac * Math.PI * 2 * weaveFreq + weavePhase) * weaveAmp;
      const totalOffset = offset + weave * (1 - tension * 0.5);
      points.push({ x: bx + nx * totalOffset, y: by + ny * totalOffset });
    }

    let d = `M${points[0].x},${points[0].y}`;
    for (let p = 1; p < points.length - 1; p++) {
      const cpx = points[p].x;
      const cpy = points[p].y;
      const epx = (points[p].x + points[p + 1].x) / 2;
      const epy = (points[p].y + points[p + 1].y) / 2;
      d += ` Q${cpx},${cpy} ${epx},${epy}`;
    }
    const last = points[points.length - 1];
    d += ` L${last.x},${last.y}`;
    paths.push(d);
  }
  return paths;
}

function adjustBrightness(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RopeRenderer({
  id,
  startX, startY,
  endX, endY,
  color,
  tension = 0,
  teamName = "",
  pulseActive = false,
  thickness = 4,
  strandCount = 3,
  sagAmount = 30,
}) {
  const t = Math.max(0, Math.min(1, tension));
  const dynThickness = thickness * (1 - t * 0.3);
  const colorDark = adjustBrightness(color, -40);
  const colorLight = adjustBrightness(color, 40);
  const glowOpacity = 0.15 + t * 0.45;
  const glowRadius = 2 + t * 6;

  const corePath = useMemo(
    () => buildRopePath(startX, startY, endX, endY, t, sagAmount),
    [startX, startY, endX, endY, t, sagAmount]
  );
  const strands = useMemo(
    () => buildStrandPaths(startX, startY, endX, endY, t, sagAmount, strandCount, dynThickness),
    [startX, startY, endX, endY, t, sagAmount, strandCount, dynThickness]
  );

  return (
    <g aria-label={`Rope for ${teamName}`}>
      <defs>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={glowRadius} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`${id}-pulse`} x1="0%" y1="0%" x2="100%" y2="0%"
          gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="40%" stopColor="#fff" stopOpacity={pulseActive ? 0.6 : 0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={pulseActive ? 0.9 : 0} />
          <stop offset="60%" stopColor="#fff" stopOpacity={pulseActive ? 0.6 : 0} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
          {pulseActive && (
            <>
              <animate attributeName="x1" values="-100%;100%" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="x2" values="0%;200%" dur="0.6s" repeatCount="indefinite" />
            </>
          )}
        </linearGradient>
      </defs>

      {/* Outer glow */}
      <path d={corePath} fill="none" stroke={color}
        strokeWidth={dynThickness * 2.5} strokeLinecap="round"
        opacity={glowOpacity} filter={`url(#${id}-glow)`}
        style={{ transition: "stroke-width 0.3s, opacity 0.3s" }}
      />

      {/* Shadow depth */}
      <path d={corePath} fill="none" stroke={colorDark}
        strokeWidth={dynThickness * 1.4} strokeLinecap="round"
        opacity={0.6} style={{ transition: "stroke-width 0.3s" }}
      />

      {/* Braid strands */}
      {strands.map((strandPath, i) => (
        <path key={i} d={strandPath} fill="none"
          stroke={i % 2 === 0 ? color : colorLight}
          strokeWidth={dynThickness * (0.35 - (i % 2) * 0.05)}
          strokeLinecap="round"
          opacity={0.85 + (i % 2) * 0.15}
          style={{ transition: "stroke-width 0.3s" }}
        />
      ))}

      {/* Specular highlight */}
      <path d={corePath} fill="none" stroke={colorLight}
        strokeWidth={dynThickness * 0.15} strokeLinecap="round"
        opacity={0.4 + t * 0.3}
        style={{ transition: "stroke-width 0.3s, opacity 0.3s" }}
      />

      {/* Pulse overlay */}
      {pulseActive && (
        <path d={corePath} fill="none"
          stroke={`url(#${id}-pulse)`}
          strokeWidth={dynThickness * 1.2} strokeLinecap="round"
          opacity={0.8}
        />
      )}

      {/* Anchor nub at team edge */}
      <circle cx={startX} cy={startY} r={dynThickness * 0.7}
        fill={colorDark} stroke={color} strokeWidth={1} opacity={0.9}
      />
    </g>
  );
}
