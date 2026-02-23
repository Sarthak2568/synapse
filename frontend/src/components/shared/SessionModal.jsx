export function SessionModal({ open, onClose, summary }) {
  if (!open || !summary) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-card p-5 shadow-card">
        <h3 className="font-heading text-xl">Session Summary</h3>
        <p className="mt-1 text-sm text-subtxt">
          {summary.activity} • {new Date(summary.createdAt).toLocaleString()}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="soft-border rounded-xl p-3">
            <p className="text-xs text-subtxt">Score</p>
            <p className="font-heading text-xl">{summary.score}/100</p>
          </div>
          <div className="soft-border rounded-xl p-3">
            <p className="text-xs text-subtxt">Risk</p>
            <p className="font-heading text-xl">{summary.risk}</p>
          </div>
          <div className="soft-border rounded-xl p-3">
            <p className="text-xs text-subtxt">Consistency</p>
            <p className="font-heading text-xl">{summary.consistency}</p>
          </div>
          <div className="soft-border rounded-xl p-3">
            <p className="text-xs text-subtxt">Power</p>
            <p className="font-heading text-xl">{summary.power}</p>
          </div>
        </div>
        <button
          className="btn-press mt-4 w-full rounded-xl bg-primary px-4 py-2 font-semibold text-black"
          onClick={onClose}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
