# AI Sports & Fitness Motion Analysis MVP

Hackathon-ready end-to-end project for live camera and uploaded video motion analysis.

## What It Does
- Live camera mode and video upload mode
- Pose detection using MoveNet in browser
- Activity detection (auto/squat/pushup/bowling/cricket cover drive)
- Technique scoring against reference ranges
- Deterministic coaching feedback
- Cricket shot subtype classification with notebook labels (`drive`, `legglance-flick`, `pullshot`, `sweep`)
- Optional CNN shot helper (`cnn_shot`) with safe fallback to pose inference
- Optional LLM rewriting layer (`gpt-4o-mini`) for human-friendly feedback
- Visual analytics: skeleton overlay + angle charts + metric table

## Architecture
- Frontend: HTML/CSS/JS + TensorFlow.js MoveNet + Chart.js
- Backend: FastAPI
- Scoring pipeline:
  1. Browser extracts normalized 17-point keypoints timeline
  2. POST keypoints to `/api/analyze`
  3. Backend detects activity, computes biomechanical metrics
  4. Scores deviations against target ranges
  5. Returns score + feedback + timeline for charts

## Project Structure
```
backend/
  app/
    analysis/
      activity.py
      angles.py
      constants.py
      features.py
      feedback.py
      reference_library.py
      scoring.py
    main.py
    schemas.py
  requirements.txt
frontend/
  index.html
  assets/
    app.js
    styles.css
```

## Run Locally
1. Create environment and install dependencies:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2. (Optional) Enable LLM rewrite:
```bash
cp .env.example .env
# set OPENAI_API_KEY in .env or export in shell
export OPENAI_API_KEY=your_key
export OPENAI_MODEL=gpt-4o-mini
```

3. Start API + frontend server:
```bash
uvicorn app.main:app --app-dir backend --reload
```

Optional CNN helper setup:
```bash
pip install -r backend/requirements-cnn.txt
# train/export model artifacts to backend/models/
python backend/ml/train_cricket_cnn.py --data-dir /path/to/cricket-dataset/data --arch mobilenet_v3_small --epochs 10
# optional toggles
export CNN_SHOT_ENABLED=1
export CNN_MODEL_DIR=backend/models
export CNN_WINDOW_SIZE=7
```

4. Open:
- http://127.0.0.1:8000

## Run with Docker
```bash
docker compose up --build
```

## Notes for Hackathon Demo
- Start with `Gym: Squat` in live mode for consistent scoring.
- Use a side-view clip for cricket cover drive.
- Keep full body visible in frame for stable keypoints.

## API Contract
### POST `/api/analyze`
```json
{
  "activity_hint": "auto",
  "fps": 10,
  "frames": [
    {
      "timestamp": 0.0,
      "keypoints": [
        {"x": 0.5, "y": 0.3, "score": 0.9}
      ]
    }
  ]
}
```

### Response
```json
{
  "activity": "squat",
  "overall_score": 82.5,
  "metrics": [],
  "feedback": [],
  "timeline": {},
  "cricket_shot": null,
  "cnn_shot": null
}
```
