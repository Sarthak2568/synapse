import { statusPill } from '../../utils/poseUtils';
import { TinySparkline } from './TinySparkline';

export function MetricsCard({ label, value, unit, status, sparkValues }) {
  return (
    <div className="card-hover soft-border rounded-2xl bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-subtxt">{label}</p>
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: statusPill(status) }}
        />
      </div>
      <div className="mb-2 flex items-end gap-1">
        <strong className="font-heading text-2xl leading-none">{value}</strong>
        <span className="text-sm text-subtxt">{unit}</span>
      </div>
      <TinySparkline values={sparkValues} color={statusPill(status)} />
    </div>
  );
}
