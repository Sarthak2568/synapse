import { COLORS } from '../../utils/constants';

export function TinySparkline({ values = [], color = COLORS.primary }) {
  const width = 92;
  const height = 34;
  if (!values.length) {
    return <div className="h-8 w-24 rounded bg-white/5" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-6);
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="rounded-lg bg-white/5">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
