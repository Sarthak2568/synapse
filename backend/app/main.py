from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.analysis.activity import detect_activity
from app.analysis.biomechanics import biomechanics_summary
from app.analysis.cricket_shot_classifier import classify_shot_from_series
from app.analysis.cricket_cnn_inference import predict_from_pose_frames
from app.analysis.features import (
    bowling_features_from_series,
    cover_drive_features_from_series,
    extract_common_series,
    kinematics_stream,
    pushup_features_from_series,
    squat_features_from_series,
)
from app.analysis.feedback import (
    deterministic_feedback,
    joint_assessment,
    maybe_rewrite_with_llm,
    performance_explanations,
)
from app.analysis.scoring import score_activity
from app.schemas import AnalysisRequest, AnalysisResponse, CNNShotSignal

app = FastAPI(title="Sports Motion Analysis API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT / "frontend"


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest) -> AnalysisResponse:
    frames = payload.frames
    activity = detect_activity(frames, payload.activity_hint)

    series = extract_common_series(frames)

    if activity == "squat":
        feature_values = squat_features_from_series(series)
    elif activity == "cricket_cover_drive":
        feature_values = cover_drive_features_from_series(series, payload.fps)
    elif activity == "pushup":
        feature_values = pushup_features_from_series(series)
    else:
        feature_values = bowling_features_from_series(series)

    overall, metrics = score_activity(activity, feature_values)
    bio = biomechanics_summary(activity, series)

    feedback = deterministic_feedback(activity, metrics)
    feedback = maybe_rewrite_with_llm(activity, feedback, metrics, bio)

    explanations = performance_explanations(activity, metrics, bio)
    joints = joint_assessment(activity, metrics)
    live_stream = kinematics_stream(series)

    timeline = {k: [round(v, 4) for v in vals] for k, vals in series.items()}
    shot = classify_shot_from_series(series) if activity == "cricket_cover_drive" else None
    cnn_shot_payload = predict_from_pose_frames(frames) if activity == "cricket_cover_drive" else None
    cnn_shot = CNNShotSignal(**cnn_shot_payload) if cnn_shot_payload else None

    return AnalysisResponse(
        activity=activity,
        overall_score=overall,
        metrics=metrics,
        feedback=feedback,
        coaching_explanations=explanations,
        timeline=timeline,
        kinematics_stream=live_stream,
        biomechanics=bio,
        joint_assessment=joints,
        cricket_shot=shot,
        cnn_shot=cnn_shot,
    )


if FRONTEND_DIR.exists() and (FRONTEND_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")


@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
