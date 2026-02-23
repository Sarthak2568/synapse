from __future__ import annotations

import math

from app.analysis.constants import KEYPOINT_INDEX
from app.schemas import FramePose


def _point(frame: FramePose, name: str) -> tuple[float, float]:
    kp = frame.keypoints[KEYPOINT_INDEX[name]]
    return kp.x, kp.y


def angle_abc(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
    ab = (a[0] - b[0], a[1] - b[1])
    cb = (c[0] - b[0], c[1] - b[1])
    dot = ab[0] * cb[0] + ab[1] * cb[1]
    mag_ab = math.hypot(*ab)
    mag_cb = math.hypot(*cb)
    if mag_ab == 0 or mag_cb == 0:
        return 180.0
    cosine = max(-1.0, min(1.0, dot / (mag_ab * mag_cb)))
    return math.degrees(math.acos(cosine))


def joint_angle(frame: FramePose, a_name: str, b_name: str, c_name: str) -> float:
    return angle_abc(_point(frame, a_name), _point(frame, b_name), _point(frame, c_name))


def midpoint(frame: FramePose, left_name: str, right_name: str) -> tuple[float, float]:
    lx, ly = _point(frame, left_name)
    rx, ry = _point(frame, right_name)
    return (lx + rx) / 2.0, (ly + ry) / 2.0
