from __future__ import annotations

import statistics

from app.analysis.angles import joint_angle, midpoint
from app.schemas import FramePose, LiveDataPoint


def _argmax(values: list[float]) -> int:
    return max(range(len(values)), key=lambda i: values[i])


def _argmin(values: list[float]) -> int:
    return min(range(len(values)), key=lambda i: values[i])


def _derivative(values: list[float], timestamps: list[float]) -> list[float]:
    if len(values) != len(timestamps):
        return [0.0 for _ in values]

    out: list[float] = [0.0]
    for i in range(1, len(values)):
        dt = max(timestamps[i] - timestamps[i - 1], 1e-6)
        out.append((values[i] - values[i - 1]) / dt)
    return out


def extract_common_series(frames: list[FramePose]) -> dict[str, list[float]]:
    timestamps = [f.timestamp for f in frames]
    left_knee = [joint_angle(f, "left_hip", "left_knee", "left_ankle") for f in frames]
    right_knee = [joint_angle(f, "right_hip", "right_knee", "right_ankle") for f in frames]
    trunk = [joint_angle(f, "left_shoulder", "left_hip", "left_knee") for f in frames]
    nose_x = [f.keypoints[0].x for f in frames]
    hip_y = [midpoint(f, "left_hip", "right_hip")[1] for f in frames]
    hip_x = [midpoint(f, "left_hip", "right_hip")[0] for f in frames]
    wrist_x = [midpoint(f, "left_wrist", "right_wrist")[0] for f in frames]

    hip_velocity = _derivative(hip_y, timestamps)
    hip_acceleration = _derivative(hip_velocity, timestamps)

    return {
        "timestamps": timestamps,
        "left_knee": left_knee,
        "right_knee": right_knee,
        "avg_knee": [(l + r) / 2.0 for l, r in zip(left_knee, right_knee)],
        "trunk": trunk,
        "nose_x": nose_x,
        "hip_y": hip_y,
        "hip_x": hip_x,
        "wrist_x": wrist_x,
        "hip_velocity": hip_velocity,
        "hip_acceleration": hip_acceleration,
    }


def kinematics_stream(series: dict[str, list[float]]) -> list[LiveDataPoint]:
    n = len(series["timestamps"])
    out: list[LiveDataPoint] = []
    for i in range(n):
        out.append(
            LiveDataPoint(
                timestamp=round(series["timestamps"][i], 3),
                knee_angle=round(series["avg_knee"][i], 2),
                trunk_angle=round(series["trunk"][i], 2),
                hip_y=round(series["hip_y"][i], 5),
                hip_velocity=round(series["hip_velocity"][i], 4),
                hip_acceleration=round(series["hip_acceleration"][i], 4),
            )
        )
    return out


def squat_features_from_series(s: dict[str, list[float]]) -> dict[str, float]:
    bottom_idx = _argmax(s["hip_y"])
    start_hip = s["hip_y"][0]
    bottom_hip = s["hip_y"][bottom_idx]
    full_hip_span = max(s["hip_y"]) - min(s["hip_y"]) + 1e-6

    return {
        "depth_ratio": (bottom_hip - start_hip) / full_hip_span,
        "min_knee_angle": min(s["avg_knee"]),
        "trunk_angle_bottom": s["trunk"][bottom_idx],
        "knee_symmetry": abs(s["left_knee"][bottom_idx] - s["right_knee"][bottom_idx]),
        "head_stability": statistics.pstdev(s["nose_x"]) if len(s["nose_x"]) > 1 else 0.0,
    }


def squat_features(frames: list[FramePose]) -> dict[str, float]:
    return squat_features_from_series(extract_common_series(frames))


def cover_drive_features_from_series(s: dict[str, list[float]], fps: float) -> dict[str, float]:
    impact_idx = _argmax(s["wrist_x"])
    transfer_idx = _argmax(s["hip_x"])
    delay_seconds = max(0.0, (transfer_idx - impact_idx) / max(fps, 1.0))

    return {
        "head_stability": statistics.pstdev(s["nose_x"]) if len(s["nose_x"]) > 1 else 0.0,
        "front_knee_angle_impact": s["left_knee"][impact_idx],
        "bat_swing_compactness": (max(s["wrist_x"]) - min(s["wrist_x"])) / (max(s["hip_x"]) - min(s["hip_x"]) + 1e-6),
        "weight_transfer_delay": delay_seconds,
        "follow_through_alignment": s["trunk"][_argmin(s["trunk"])],
    }


def cover_drive_features(frames: list[FramePose], fps: float) -> dict[str, float]:
    return cover_drive_features_from_series(extract_common_series(frames), fps)
