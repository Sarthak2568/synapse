import { statusPill } from '../../utils/poseUtils';
import { TinySparkline } from './TinySparkline';

export function MetricsCard({ label, value, referenceValue, unit, status, sparkValues }) {
  return (
    <div className="card-hover soft-border rounded-2xl bg-card p-4 border border-white/5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-subtxt">{label}</p>
        <div className="flex items-center gap-2">
           {referenceValue !== undefined && (
             <span className="text-[10px] uppercase font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-sm">
               Pro VS
             </span>
           )}
          <span
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor]"
            style={{ color: statusPill(status), background: statusPill(status) }}
          />
        </div>
      </div>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <strong className="font-heading text-3xl leading-none text-white font-bold">{value}</strong>
              <span className="text-sm text-subtxt font-medium">{unit}</span>
            </div>
            {referenceValue !== undefined && (
              <div className="flex flex-col items-end text-right">
                 <span className="text-[10px] text-subtxt uppercase font-bold tracking-widest mb-0.5">Reference</span>
                 <strong className="font-heading text-xl leading-none text-secondary drop-shadow-[0_0_8px_rgba(0,255,157,0.3)]">{referenceValue}</strong>
              </div>
            )}
        </div>
      </div>
      <TinySparkline values={sparkValues} color={statusPill(status)} />
    </div>
  );
}
