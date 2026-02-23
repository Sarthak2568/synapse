from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI

from app.analysis.reference_library import REFERENCE_LIBRARY
from app.schemas import BiomechanicsSummary, MetricResult


SYSTEM_PROMPT = """
You are a biomechanics coaching assistant.
Rewrite deterministic findings into concise, practical coaching feedback.
Rules:
- Keep each bullet actionable and specific.
- Mention concrete numbers when provided.
- Do not invent metrics.
- Max 5 bullets.
""".strip()


def deterministic_feedback(activity: str, metrics: list[MetricResult]) -> list[str]:
    messages = REFERENCE_LIBRARY[activity]["messages"]
    findings: list[str] = []
    for m in metrics:
        if m.score >= 85:
            continue
        delta_text = f"{m.name}={m.value:.2f} (target {m.target_min:.2f}-{m.target_max:.2f})"
        findings.append(f"{messages[m.name]} [{delta_text}]")

    if not findings:
        findings.append("Great form consistency. Keep tempo controlled and repeat this pattern.")
    return findings[:5]


def joint_assessment(activity: str, metrics: list[MetricResult]) -> dict[str, str]:
    by_name = {m.name: m for m in metrics}

    def status(metric_name: str) -> str:
        m = by_name.get(metric_name)
        if not m:
            return "neutral"
        return "correct" if m.score >= 85 else "incorrect"

    if activity == "squat":
        return {
            "left_knee": status("min_knee_angle"),
            "right_knee": status("min_knee_angle"),
            "trunk": status("trunk_angle_bottom"),
            "head": status("head_stability"),
        }
    if activity == "pushup":
        return {
            "left_elbow": status("min_elbow_angle"),
            "right_elbow": status("min_elbow_angle"),
            "trunk": status("torso_line_stability"),
            "head": status("head_stability"),
        }
    if activity == "bowling":
        return {
            "release": status("release_timing_index"),
            "trunk": status("trunk_rotation_span"),
            "hips": status("hip_drive_velocity_span"),
            "arm_path": status("release_height_index"),
        }

    return {
        "front_knee": status("front_knee_angle_impact"),
        "trunk": status("follow_through_alignment"),
        "head": status("head_stability"),
        "timing": status("weight_transfer_delay"),
    }


def performance_explanations(activity: str, metrics: list[MetricResult], bio: BiomechanicsSummary) -> list[str]:
    out: list[str] = []
    for m in metrics:
        if m.score >= 85:
            continue

        if activity == "squat" and m.name == "min_knee_angle":
            out.append(
                f"Improving knee angle toward {m.target_min:.0f}-{m.target_max:.0f} degrees can increase effective leg drive and stabilize estimated torque ({bio.torque_estimate_nm:.1f} Nm)."
            )
        elif activity == "squat" and m.name == "trunk_angle_bottom":
            out.append(
                f"A more neutral trunk angle helps transfer force vertically, improving usable power (currently ~{bio.power_estimate_w:.1f} W estimate)."
            )
        elif activity == "cricket_cover_drive" and m.name == "weight_transfer_delay":
            out.append(
                f"Reducing transfer delay moves momentum earlier into impact, improving bat-ball energy transfer (momentum estimate {bio.momentum_estimate:.1f})."
            )
        elif activity == "cricket_cover_drive" and m.name == "front_knee_angle_impact":
            out.append(
                f"Front-knee alignment near target improves ground-reaction direction and helps convert lower-body force (~{bio.force_estimate_n:.1f} N estimate) into shot power."
            )
        elif activity == "pushup" and m.name == "min_elbow_angle":
            out.append(
                f"Reaching elbow depth targets increases pressing ROM and can raise usable power output (current estimate ~{bio.power_estimate_w:.1f} W)."
            )
        elif activity == "pushup" and m.name == "torso_line_stability":
            out.append(
                f"A steadier torso line reduces energy leaks and improves force transfer through the kinetic chain."
            )
        elif activity == "bowling" and m.name == "release_timing_index":
            out.append(
                f"Tighter release timing improves momentum transfer at ball release (momentum estimate {bio.momentum_estimate:.1f})."
            )
        elif activity == "bowling" and m.name == "hip_drive_velocity_span":
            out.append(
                f"Stronger hip drive can increase delivery power by improving lower-body contribution (~{bio.force_estimate_n:.1f} N estimate)."
            )

    if not out:
        out.append(
            f"Current mechanics are efficient: stability score {bio.stability_score:.1f}/100 with estimated force {bio.force_estimate_n:.1f} N."
        )

    return out[:4]


def maybe_rewrite_with_llm(
    activity: str,
    findings: list[str],
    metrics: list[MetricResult],
    biomechanics: BiomechanicsSummary,
) -> list[str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return findings

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=api_key)

    payload: dict[str, Any] = {
        "activity": activity,
        "metrics": [m.model_dump() for m in metrics],
        "biomechanics": biomechanics.model_dump(),
        "findings": findings,
    }

    try:
        resp = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Rewrite these coaching findings as bullets:\n{json.dumps(payload)}",
                },
            ],
            max_output_tokens=260,
            temperature=0.2,
        )
        text = (resp.output_text or "").strip()
        rewritten = [line.strip("- ").strip() for line in text.splitlines() if line.strip()]
        return rewritten[:5] if rewritten else findings
    except Exception:
        return findings
