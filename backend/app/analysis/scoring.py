from __future__ import annotations

from app.analysis.reference_library import REFERENCE_LIBRARY
from app.schemas import MetricResult


def _metric_score(value: float, lo: float, hi: float) -> tuple[float, float]:
    if lo <= value <= hi:
        return 0.0, 100.0
    deviation = min(abs(value - lo), abs(value - hi))
    width = max(hi - lo, 1e-6)
    penalty = (deviation / width) * 100.0
    return deviation, max(0.0, 100.0 - penalty)


def score_activity(activity: str, feature_values: dict[str, float]) -> tuple[float, list[MetricResult]]:
    ref = REFERENCE_LIBRARY[activity]
    targets = ref["targets"]
    weights = ref["weights"]

    metrics: list[MetricResult] = []
    weighted_sum = 0.0
    total_weight = 0.0

    for name, value in feature_values.items():
        lo, hi = targets[name]
        deviation, score = _metric_score(value, lo, hi)
        weight = weights[name]
        weighted_sum += score * weight
        total_weight += weight
        metrics.append(
            MetricResult(
                name=name,
                value=round(value, 4),
                target_min=lo,
                target_max=hi,
                deviation=round(deviation, 4),
                score=round(score, 2),
            )
        )

    overall = weighted_sum / max(total_weight, 1e-6)
    return round(overall, 2), metrics
