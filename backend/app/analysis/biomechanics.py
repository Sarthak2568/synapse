from __future__ import annotations

import statistics

from app.schemas import BiomechanicsSummary


def _safe_max_abs(values: list[float]) -> float:
    if not values:
        return 0.0
    return max(abs(v) for v in values)


def biomechanics_summary(activity: str, series: dict[str, list[float]]) -> BiomechanicsSummary:
    # Hackathon-safe approximations (interpretable, not force-plate grade).
    mass_kg = 75.0
    gravity = 9.81
    body_height_m = 1.70

    hip_x = series["hip_x"]
    hip_v = series["hip_velocity"]
    hip_a = series["hip_acceleration"]

    # Camera normalized coordinates converted to meters with a fixed anthropometric assumption.
    meters_per_norm = body_height_m
    peak_velocity_ms = _safe_max_abs(hip_v) * meters_per_norm
    peak_accel_ms2 = _safe_max_abs(hip_a) * meters_per_norm

    if activity == "squat":
        force_n = mass_kg * (gravity + 0.5 * peak_accel_ms2)
        moment_arm_m = 0.40
    elif activity == "pushup":
        # Approximate 65% body mass effectively loaded through upper body in push-up.
        force_n = (mass_kg * 0.65) * (gravity + 0.35 * peak_accel_ms2)
        moment_arm_m = 0.32
    elif activity == "bowling":
        force_n = mass_kg * (gravity + 0.6 * peak_accel_ms2)
        moment_arm_m = 0.60
    else:
        force_n = mass_kg * (gravity + 0.3 * peak_accel_ms2)
        moment_arm_m = 0.55

    torque_nm = force_n * moment_arm_m
    momentum = mass_kg * peak_velocity_ms
    power_w = force_n * peak_velocity_ms

    balance_index = statistics.pstdev(hip_x) if len(hip_x) > 1 else 0.0
    stability_score = max(0.0, min(100.0, 100.0 - (balance_index * 1000.0)))

    return BiomechanicsSummary(
        force_estimate_n=round(force_n, 2),
        torque_estimate_nm=round(torque_nm, 2),
        momentum_estimate=round(momentum, 2),
        power_estimate_w=round(power_w, 2),
        balance_index=round(balance_index, 5),
        stability_score=round(stability_score, 2),
    )
