export type RadarDatum = { domain: string; mastery: number; weight: number };

/**
 * Hand-drawn radar, deliberately not Recharts.
 *
 * This renders on the landing route, so pulling in Recharts' polar bundle cost
 * ~250KB over the wire on every first visit for one eight-axis chart. Making it
 * lazy only deferred that past first paint; it still downloaded. Plain SVG is a
 * few hundred bytes and needs no runtime.
 */

const SIZE = 240;
const CENTRE = SIZE / 2;
const RADIUS = 88;
const RINGS = [0.25, 0.5, 0.75, 1];

/** Polar to cartesian, starting at 12 o'clock and going clockwise. */
function point(index: number, count: number, distance: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTRE + Math.cos(angle) * RADIUS * distance,
    y: CENTRE + Math.sin(angle) * RADIUS * distance,
  };
}

function polygon(distances: number[]): string {
  return distances
    .map((d, i) => {
      const { x, y } = point(i, distances.length, d);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function MasteryRadar({ data }: { data: RadarDatum[] }) {
  if (data.length === 0) return null;

  const values = data.map((d) => Math.max(0, Math.min(100, d.mastery)) / 100);
  const summary = data.map((d) => `${d.domain} ${d.mastery}%`).join(", ");

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full"
      style={{ maxHeight: 240 }}
      role="img"
      aria-label={`Domain mastery: ${summary}`}
    >
      {/* Rings */}
      {RINGS.map((r) => (
        <polygon
          key={r}
          points={polygon(data.map(() => r))}
          fill="none"
          stroke="#243046"
          strokeWidth="1"
        />
      ))}

      {/* Spokes */}
      {data.map((d, i) => {
        const { x, y } = point(i, data.length, 1);
        return <line key={d.domain} x1={CENTRE} y1={CENTRE} x2={x} y2={y} stroke="#243046" strokeWidth="1" />;
      })}

      {/* The mastery shape */}
      <polygon
        points={polygon(values)}
        fill="#6ee7b7"
        fillOpacity="0.3"
        stroke="#6ee7b7"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Axis labels, nudged outside the outer ring */}
      {data.map((d, i) => {
        const { x, y } = point(i, data.length, 1.16);
        return (
          <text
            key={d.domain}
            x={x}
            y={y}
            fill="#8b97ab"
            fontSize="11"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {d.domain}
          </text>
        );
      })}
    </svg>
  );
}
