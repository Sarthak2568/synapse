from __future__ import annotations

from app.schemas import CricketShotClassification


SHOT_CLASSES = ("drive", "legglance-flick", "pullshot", "sweep")


def _normalize_scores(raw: dict[str, float]) -> dict[str, float]:
    clipped = {k: max(0.01, v) for k, v in raw.items()}
    total = sum(clipped.values()) or 1.0
    return {k: round(v / total, 4) for k, v in clipped.items()}


def classify_shot_from_series(series: dict[str, list[float]]) -> CricketShotClassification:
    # Notebook labels integrated for MVP classification from pose trajectory.
    impact_idx = max(range(len(series["wrist_x"])), key=lambda i: series["wrist_x"][i])

    wrist_x_span = max(series["wrist_x"]) - min(series["wrist_x"])
    wrist_y_span = max(series["wrist_y"]) - min(series["wrist_y"])
    hip_x_span = max(series["hip_x"]) - min(series["hip_x"])
    contact_height = series["wrist_y"][impact_idx]
    trunk_at_impact = series["trunk"][impact_idx]
    horizontal_drive = abs(series["wrist_x"][-1] - series["wrist_x"][0])

    raw_scores = {
        "drive": max(0.05, horizontal_drive * 1.6 + max(0.0, trunk_at_impact - 145.0) / 40.0),
        "legglance-flick": max(0.05, (wrist_x_span - hip_x_span) * 2.2 + 0.35),
        "pullshot": max(0.05, wrist_y_span * 1.6 + (160.0 - trunk_at_impact) / 35.0),
        "sweep": max(0.05, max(0.0, contact_height - 0.62) * 2.8 + wrist_x_span * 0.6),
    }

    class_scores = _normalize_scores(raw_scores)
    label = max(class_scores, key=class_scores.get)
    confidence = class_scores[label]

    return CricketShotClassification(
        label=label, confidence=round(confidence, 4), class_scores=class_scores
    )
