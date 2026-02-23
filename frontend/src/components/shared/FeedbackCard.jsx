import { COLORS } from '../../utils/constants';

export function FeedbackCard({ msg, severity }) {
  const icon = severity === "high" ? "⚠" : severity === "medium" ? "△" : "✓";
  const color =
    severity === "high"
      ? COLORS.warn
      : severity === "medium"
        ? "#f5c344"
        : COLORS.secondary;
  return (
    <div className="soft-border rounded-xl bg-card/90 p-3">
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: `${color}22`, color }}
        >
          {icon}
        </span>
        <p className="text-sm leading-snug text-txt">{msg}</p>
      </div>
    </div>
  );
}
