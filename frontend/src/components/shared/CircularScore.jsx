import { COLORS } from '../../utils/constants';
import { scoreColor } from '../../utils/poseUtils';

export function CircularScore({ score = 0 }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - progress / 100);
  const color = scoreColor(progress);

  return (
    <div className="flex items-center justify-center">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        className="drop-shadow-[0_0_22px_rgba(0,229,255,.15)]"
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="rgba(255,255,255,.08)"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset .55s ease" }}
        />
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="font-heading"
          fill={COLORS.subtxt}
          fontSize="12"
        >
          Performance
        </text>
        <text
          x="70"
          y="87"
          textAnchor="middle"
          className="font-heading"
          fill={COLORS.txt}
          fontSize="28"
        >
          {Math.round(progress)}
        </text>
      </svg>
    </div>
  );
}
