/**
 * The deco "signal burst": a quarter-fan of rays and broadcast arcs
 * radiating from the hero's top-left corner — the Crowdtone wordmark's
 * idea drawn as ornament, in the manner of a 1930s radio poster. Hand-set
 * vector, so it is exactly on palette, weighs about a kilobyte, and needs no
 * license. The arcs sweep themselves in on load; the rays follow, each a
 * beat behind the last.
 */

const CX = 0;
const CY = 0;
const RAY_INNER = 96;
const RAY_OUTER = 560;
const RAY_COUNT = 13;
const ARCS = [150, 250, 370, 500];

function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function arcPath(r: number): string {
  const [x1, y1] = polar(r, 4);
  const [x2, y2] = polar(r, 86);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export function SignalBurst() {
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
    const deg = 4 + (i * 82) / (RAY_COUNT - 1);
    // Every third ray runs long, the deco alternation.
    const outer = i % 3 === 0 ? RAY_OUTER : RAY_OUTER * 0.72;
    const [x1, y1] = polar(RAY_INNER, deg);
    const [x2, y2] = polar(outer, deg);
    return { x1, y1, x2, y2, red: i === 4 };
  });

  return (
    <svg
      className="burst"
      viewBox="0 0 620 620"
      aria-hidden
      focusable="false"
    >
      <g transform="translate(6 6)">
        {ARCS.map((r, i) => (
          <path
            key={r}
            className="barc"
            d={arcPath(r)}
            pathLength={1}
            style={{ ["--d" as string]: `${0.15 + i * 0.18}s` }}
          />
        ))}
        {rays.map((ray, i) => (
          <line
            key={i}
            className={`bray${ray.red ? " red" : ""}`}
            x1={ray.x1.toFixed(1)}
            y1={ray.y1.toFixed(1)}
            x2={ray.x2.toFixed(1)}
            y2={ray.y2.toFixed(1)}
            pathLength={1}
            style={{ ["--d" as string]: `${0.5 + i * 0.06}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
