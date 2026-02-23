from __future__ import annotations

REFERENCE_LIBRARY = {
    "squat": {
        "weights": {
            "depth_ratio": 0.25,
            "min_knee_angle": 0.30,
            "trunk_angle_bottom": 0.20,
            "knee_symmetry": 0.15,
            "head_stability": 0.10,
        },
        "targets": {
            "depth_ratio": (0.20, 0.55),
            "min_knee_angle": (70.0, 105.0),
            "trunk_angle_bottom": (145.0, 180.0),
            "knee_symmetry": (0.0, 12.0),
            "head_stability": (0.0, 0.045),
        },
        "messages": {
            "depth_ratio": "Increase squat depth while keeping heels grounded.",
            "min_knee_angle": "Your knee bend is outside ideal depth range; adjust stance and descent control.",
            "trunk_angle_bottom": "Back posture deviates from neutral at the bottom; brace core and hinge from hips.",
            "knee_symmetry": "Left/right knee movement is imbalanced; focus on even force through both legs.",
            "head_stability": "Head is moving too much; keep gaze fixed and torso stable.",
        },
    },
    "cricket_cover_drive": {
        "weights": {
            "head_stability": 0.20,
            "front_knee_angle_impact": 0.25,
            "bat_swing_compactness": 0.20,
            "weight_transfer_delay": 0.25,
            "follow_through_alignment": 0.10,
        },
        "targets": {
            "head_stability": (0.0, 0.04),
            "front_knee_angle_impact": (110.0, 150.0),
            "bat_swing_compactness": (0.10, 0.50),
            "weight_transfer_delay": (0.0, 0.12),
            "follow_through_alignment": (145.0, 180.0),
        },
        "messages": {
            "head_stability": "Keep your head still through contact for cleaner timing.",
            "front_knee_angle_impact": "Front knee angle at impact is off; align front leg to drive through the ball.",
            "bat_swing_compactness": "Swing arc is too wide; stay compact through downswing.",
            "weight_transfer_delay": "Weight transfer is late; load front foot earlier before impact.",
            "follow_through_alignment": "Follow-through body line is misaligned; finish with chest and bat flowing toward target.",
        },
    },
}
