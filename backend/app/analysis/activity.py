from __future__ import annotations

from app.analysis.angles import midpoint
from app.schemas import FramePose


def detect_activity(frames: list[FramePose], hint: str) -> str:
    if hint in {"squat", "cricket_cover_drive"}:
        return hint

    hip_y = [midpoint(f, "left_hip", "right_hip")[1] for f in frames]
    wrist_x = [midpoint(f, "left_wrist", "right_wrist")[0] for f in frames]

    hip_span = max(hip_y) - min(hip_y)
    wrist_span = max(wrist_x) - min(wrist_x)

    if hip_span > wrist_span * 0.8:
        return "squat"
    return "cricket_cover_drive"
