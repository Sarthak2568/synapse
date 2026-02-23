# AI Sports & Fitness Motion Analysis Platform

## 1. End-to-End System Architecture

- Capture Layer
  - Live camera stream from browser/mobile
  - Uploaded video processing
- Perception Layer
  - MoveNet pose estimation (17 keypoints)
  - Temporal smoothing and tracking
- Motion Intelligence Layer
  - Activity detection (`squat`, `cricket_cover_drive`, `auto`)
  - Kinematics extraction (angles, position, velocity, acceleration)
- Technique Evaluation Layer
  - Rule-based comparison to ideal ranges
  - Weighted scoring engine
  - Joint-level pass/fail assessment
- Biomechanics Approximation Layer
  - Interpretable estimates: force, torque, momentum, power, balance, stability
- Feedback Layer
  - Deterministic technical feedback with numerical deviation
  - Optional LLM rewrite (`gpt-4o-mini`) for coaching tone
- Experience Layer
  - Real-time skeleton overlay
  - Multi-lapse ghost skeleton trails
  - Red/green joint highlighting
  - Angle/kinematics charts and live telemetry tables

## 2. AI/ML Models Used

- Pose Estimation
  - TensorFlow.js MoveNet SinglePose Lightning (real-time)
- Activity Detection
  - Lightweight heuristic detector (hip vertical excursion vs wrist lateral excursion)
  - Hackathon-feasible and robust enough for squat vs cover drive
- Technique Comparison
  - Reference-range matching for key metrics (angles, symmetry, timing)
  - Weighted aggregate scoring
- Feedback LLM (optional)
  - `gpt-4o-mini` for language rewrite only
  - No scoring delegated to LLM

## 3. Tech Stack

- Frontend
  - Vanilla JS, HTML, CSS
  - TensorFlow.js + Pose Detection model
  - Chart.js for time-series graphs
- Backend
  - FastAPI + Pydantic
  - Modular analysis services (`activity`, `features`, `scoring`, `feedback`, `biomechanics`)
- Deployment
  - Uvicorn local runtime
  - Docker + docker-compose for demo portability

## 4. Data Flow

1. Input
- Live frame or uploaded frame enters frontend
- Pose model outputs 17 keypoints per frame

2. Client-Side Streaming
- Normalize keypoints in [0, 1]
- Build timestamped frame sequence
- Compute quick live telemetry for UI

3. API Analysis (`POST /api/analyze`)
- Backend auto-detects activity (unless forced)
- Extracts kinematic series:
  - knee/trunk angles
  - hip trajectory
  - velocity and acceleration
- Computes activity-specific features and score
- Generates joint assessment and coaching feedback
- Computes biomechanics approximations

4. Output
- Frontend renders:
  - score, metrics, numerical deviations
  - biomechanics cards
  - kinematic tables/charts
  - joint status overlays

## 5. Squat Workflow

- Detect squat cycle from hip descent/ascent trend
- Compute primary metrics:
  - `min_knee_angle`
  - `trunk_angle_bottom`
  - `depth_ratio`
  - `knee_symmetry`
- Compare against target ranges
- Score each metric and overall form
- Produce coaching lines, e.g.
  - "knee angle off by 15°"
- Explain performance impact
  - Better knee/trunk alignment improves torque and force transfer

## 6. Cricket Cover Drive Workflow

- Detect shot timing landmarks:
  - wrist lateral max (impact proxy)
  - hip transfer timing
- Compute metrics:
  - `front_knee_angle_impact`
  - `weight_transfer_delay`
  - `bat_swing_compactness`
  - `follow_through_alignment`
- Score and create corrective guidance
- Explain impact on momentum and power transfer at contact

## 7. Real-Time Visual Analytics

- Skeleton overlay on live video
- Joint correctness coloring
  - Green = within target behavior
  - Red = out-of-range behavior
- Multi-lapse ghost trails
  - Visual progression across recent frames
- Live table stream with timestamps:
  - knee angle, trunk angle, hip Y, velocity, acceleration
- Post-session charts:
  - angle trajectories
  - velocity/acceleration trends

## 8. Biomechanics Approximation (MVP)

- Approximations from kinematics and anthropometric assumptions:
  - Force: `m * (g + k * a_peak)`
  - Torque: `force * moment_arm`
  - Momentum: `m * v_peak`
  - Power: `force * v_peak`
  - Balance index: lateral hip variance
- Clear caveat in demo:
  - Interpretable coaching estimates, not lab-grade instrumented biomechanics

## 9. Scalability

- Add activity plugin registry
  - New movement = new metric template + thresholds + weights
- Upgrade detector
  - multi-person + 3D pose for depth-heavy sports
- Personalized baselines
  - Anthropometry-aware normalization and injury constraints
- Cloud pipeline
  - async video jobs, session history DB, coach dashboard
- Model evolution
  - move from heuristic classification to temporal deep models (TCN/LSTM)

## 10. Hackathon Demo Flow

1. Problem
- Technique coaching is expensive and inconsistent

2. Live Demo: Squat
- Real-time red/green joints, live telemetry, immediate score

3. Upload Demo: Cover Drive
- Timing + alignment + momentum-oriented feedback

4. Explainability
- Show metric table, deviation values, and biomechanics cards

5. Impact
- Smartphone-only AI coach for gyms, academies, and consumers

6. Future
- Multi-sport template marketplace and coach dashboard
