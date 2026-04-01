/**
 * SVG center knot — layered texture, strain indicators, jiggle, pulse ring.
 */
export default function KnotRenderer({
  x,
  y,
  size = 12,
  totalTension = 0,
  dominantColor = "#888888",
  isActive = false,
  recentPull = false,
  id = "knot",
}) {
  const t = Math.max(0, Math.min(1, totalTension));

  const scaleX = 1 + t * 0.12;
  const scaleY = 1 - t * 0.08;

  const strainR = Math.round(180 + t * 75);
  const strainG = Math.round(165 - t * 100);
  const strainB = Math.round(140 - t * 100);
  const strainColor = `rgb(${strainR},${strainG},${strainB})`;

  const glowIntensity = isActive ? 0.3 + t * 0.5 : 0.1;

  return (
    <g transform={`translate(${x},${y})`} aria-label="Center knot">
      <defs>
        <radialGradient id={`${id}-body`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#D4C4A8" />
          <stop offset="50%" stopColor={strainColor} />
          <stop offset="100%" stopColor="#6B5B42" />
        </radialGradient>
        <radialGradient id={`${id}-wrap`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C4B494" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8B7B5E" stopOpacity="0.6" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={3 + t * 4} />
        </filter>
      </defs>

      {/* Outer glow ring (dominant team color) */}
      {isActive && (
        <circle cx={0} cy={0} r={size * 1.8}
          fill={dominantColor} opacity={glowIntensity * 0.4}
          filter={`url(#${id}-glow)`}
        >
          <animate attributeName="r"
            values={`${size * 1.6};${size * 2.0};${size * 1.6}`}
            dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity"
            values={`${glowIntensity * 0.3};${glowIntensity * 0.5};${glowIntensity * 0.3}`}
            dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Shadow */}
      <ellipse cx={1.5} cy={2} rx={size * scaleX * 0.9} ry={size * scaleY * 0.7}
        fill="rgba(0,0,0,0.3)"
      />

      {/* Knot body */}
      <g transform={`scale(${scaleX},${scaleY})`}
        style={{ transition: "transform 0.2s ease-out" }}>

        <circle cx={0} cy={0} r={size}
          fill={`url(#${id}-body)`} stroke="#5A4B35" strokeWidth={1.2}
        />

        {/* Cross-wrap strands */}
        {[0, 60, 120].map((angle) => (
          <ellipse key={angle} cx={0} cy={0}
            rx={size * 0.95} ry={size * 0.35}
            fill="none" stroke="#8B7B5E"
            strokeWidth={size * 0.18} opacity={0.6}
            transform={`rotate(${angle})`}
          />
        ))}

        {/* Inner core */}
        <circle cx={0} cy={0} r={size * 0.5}
          fill={`url(#${id}-wrap)`} stroke="#6B5B42" strokeWidth={0.8}
        />

        {/* Highlight */}
        <circle cx={-size * 0.15} cy={-size * 0.15} r={size * 0.2}
          fill="rgba(255,255,255,0.15)"
        />

        {/* Strain lines at high tension */}
        {t > 0.5 && [0, 90, 180, 270].map((angle) => {
          const len = (t - 0.5) * 2 * size * 0.4;
          const inner = size * 1.1;
          const rad = (angle * Math.PI) / 180;
          return (
            <line key={`strain-${angle}`}
              x1={Math.cos(rad) * inner} y1={Math.sin(rad) * inner}
              x2={Math.cos(rad) * (inner + len)} y2={Math.sin(rad) * (inner + len)}
              stroke="#FF6B4A" strokeWidth={0.8}
              opacity={(t - 0.5) * 1.5} strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Pulse ring on recent pull */}
      {recentPull && (
        <circle cx={0} cy={0} r={size * 0.8}
          fill="none" stroke={dominantColor} strokeWidth={1.5} opacity={0}>
          <animate attributeName="r"
            from={`${size * 0.8}`} to={`${size * 2.5}`} dur="0.4s" fill="freeze" />
          <animate attributeName="opacity" from="0.7" to="0" dur="0.4s" fill="freeze" />
        </circle>
      )}
    </g>
  );
}
