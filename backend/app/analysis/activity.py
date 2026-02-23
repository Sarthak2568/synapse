from __future__ import annotations

from app.analysis.angles import midpoint
from app.schemas import FramePose


def detect_activity(frames: list[FramePose], hint: str) -> str:
    if hint in {"squat", "cricket_cover_drive", "pushup", "bowling"}:
        return hint

    hip_y = [midpoint(f, "left_hip", "right_hip")[1] for f in frames]
    wrist_x = [midpoint(f, "left_wrist", "right_wrist")[0] for f in frames]
    wrist_y = [midpoint(f, "left_wrist", "right_wrist")[1] for f in frames]
    shoulder_y = [midpoint(f, "left_shoulder", "right_shoulder")[1] for f in frames]

    hip_span = max(hip_y) - min(hip_y)
    wrist_span = max(wrist_x) - min(wrist_x)
    wrist_vertical_span = max(wrist_y) - min(wrist_y)
    torso_thickness = sum(abs(sh - hip) for sh, hip in zip(shoulder_y, hip_y)) / max(len(frames), 1)

    if torso_thickness < 0.11 and wrist_vertical_span > 0.08:
        return "pushup"

    if wrist_vertical_span > 0.22 and wrist_span < 0.20:
        return "bowling"

    if hip_span > wrist_span * 0.8:
        return "squat"
    return "cricket_cover_drive"
