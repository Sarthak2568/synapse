import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { Chart } from "chart.js/auto"; // Ensure Chart.js is imported
import {
  COLORS,
  NAV_ITEMS,
  ACTIVITY_OPTIONS,
  BOWLING_SPEED,
  ACTIVITY_BACKEND_HINT,
} from "./utils/constants";
import {
  loadScript,
  clamp,
  scoreColor,
  severityRank,
  angleABC,
  torsoLeanFromVertical,
  gradeDeviation,
  distanceToRange,
  pickWorseSeverity,
  statusPill,
  stabilizePose,
  drawAnatomyCore,
  clonePose,
  fitPoseToCanvas,
  poseBounds,
  confidence,
  inferLiveSquatPhase,
  sleep,
} from "./utils/poseUtils";
import { activityConfig, getWorstFrame } from "./config/activityConfig";
import { useCricketSimulation } from "./hooks/useCricketSimulation";
import { Navbar } from "./components/layout/Navbar";
import { Sidebar } from "./components/layout/Sidebar";
import { TinySparkline } from "./components/shared/TinySparkline";
import { CircularScore } from "./components/shared/CircularScore";
import { MetricsCard } from "./components/shared/MetricsCard";
import { FeedbackCard } from "./components/shared/FeedbackCard";
import { SessionModal } from "./components/shared/SessionModal";

const FULL_SKELETON_EDGES = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [5, 6],
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [5, 11],
  [6, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
];

const KEYPOINT_INDEX = {
  nose: 0,
  left_shoulder: 5,
  right_shoulder: 6,
  left_hip: 11,
  right_hip: 12,
  left_knee: 13,
  right_knee: 14,
  left_ankle: 15,
  right_ankle: 16,
  left_wrist: 9,
  right_wrist: 10,
};

// We redefine drawSkeleton here since it relies on FULL_SKELETON_EDGES and statusPill etc.
// But it's part of App.jsx in the old file anyway.

function App() {
  const [activeNav, setActiveNav] = useState("analyze");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activity, setActivity] = useState("auto");
  const [analysisMode, setAnalysisMode] = useState("standard");
  const [status, setStatus] = useState("idle");
  const [isLoading, setIsLoading] = useState(false);

  const [liveMetrics, setLiveMetrics] = useState({
    knee: 0,
    hip: 0,
    back: 0,
    timing: 0,
    balance: 0,
    path: 0,
  });
  const [trend, setTrend] = useState({ knee: [], hip: [], back: [] });
  const [liveFeedback, setLiveFeedback] = useState(
    "Ready when you are. Start live analysis to get coaching cues.",
  );
  const [liveConfidence, setLiveConfidence] = useState(0);
  const [repCount, setRepCount] = useState(0);

  const [analysis, setAnalysis] = useState(null);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const [sessions, setSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("synapse_sessions") || "[]");
    } catch {
      return [];
    }
  });

  const [coachMode, setCoachMode] = useState(false);
  const [rawPreview, setRawPreview] = useState("");
  const [timelineMeta, setTimelineMeta] = useState({
    total: 0,
    current: 0,
    worst: 0,
    phase: "n/a",
    playing: false,
  });

  const liveVideoRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const uploadVideoRef = useRef(null);
  const uploadCanvasRef = useRef(null);
  const timelineCanvasRef = useRef(null);
  const timelineSliderRef = useRef(null);
  const cricketSceneMountRef = useRef(null);
  const fileInputRef = useRef(null);

  const detectorRef = useRef(null);
  const tfRef = useRef(null);
  const poseRef = useRef(null);
  const streamRef = useRef(null);
  const liveRunningRef = useRef(false);
  const framesRef = useRef([]);
  const trailRef = useRef([]);
  const idealGhostRef = useRef(null);
  const lastSampleTsRef = useRef(0);
  const startTsRef = useRef(0);
  const lastRtRef = useRef(null);

  const uploadedFramesRef = useRef(null);
  const [hasGoldenSkeleton, setHasGoldenSkeleton] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareScore, setCompareScore] = useState(null);
  const pipVideoRef = useRef(null);
  const timelineDataRef = useRef([]);
  const timelinePlayRef = useRef(false);
  const timelineRafRef = useRef(null);
  const timelineFrameIdxRef = useRef(0);
  const timelineLastRenderTsRef = useRef(0);
  const timelineTickRef = useRef(0);
  const swingRef = useRef({
    prev: null,
    smoothVel: 0,
    lastSwingTs: 0,
    lastTriggerTs: 0,
  });

  const kneeChartRef = useRef(null);
  const trunkChartRef = useRef(null);
  const kneeChartInstRef = useRef(null);
  const trunkChartInstRef = useRef(null);

  const cricketModeEnabled = analysisMode === "cricket";
  const {
    sceneReady: cricketSceneReady,
    speedKey: cricketSpeed,
    setSpeedKey: setCricketSpeed,
    startDelivery,
    result: cricketResult,
    deliveryCount,
    hitCount,
  } = useCricketSimulation({
    enabled: cricketModeEnabled,
    mountRef: cricketSceneMountRef,
    swingRef,
  });

  const homeSummary = useMemo(() => {
    if (!sessions.length) {
      return { performance: "--", consistency: "--", risk: "--" };
    }
    const latest = sessions[0];
    return {
      performance: `${latest.score}/100`,
      consistency: latest.consistency,
      risk: latest.risk,
    };
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(
      "synapse_sessions",
      JSON.stringify(sessions.slice(0, 20)),
    );
  }, [sessions]);

  useEffect(() => {
    if (!analysis?.timeline) return;

    const labels = (analysis.timeline.avg_knee || []).map((_, i) => i + 1);

    if (kneeChartInstRef.current) kneeChartInstRef.current.destroy();
    if (trunkChartInstRef.current) trunkChartInstRef.current.destroy();

    if (kneeChartRef.current) {
      kneeChartInstRef.current = new Chart(kneeChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Knee Angle",
              data: analysis.timeline.avg_knee || [],
              borderColor: COLORS.primary,
              pointRadius: 0,
              tension: 0.28,
            },
            {
              label: "Hip Velocity",
              data: analysis.timeline.hip_velocity || [],
              borderColor: COLORS.secondary,
              pointRadius: 0,
              tension: 0.28,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: COLORS.subtxt } } },
          scales: {
            x: {
              ticks: { color: COLORS.subtxt },
              grid: { color: "rgba(155,163,175,.14)" },
            },
            y: {
              ticks: { color: COLORS.subtxt },
              grid: { color: "rgba(155,163,175,.14)" },
            },
          },
        },
      });
    }

    if (trunkChartRef.current) {
      trunkChartInstRef.current = new Chart(trunkChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Back Angle",
              data: analysis.timeline.trunk || [],
              borderColor: "#88a9ff",
              pointRadius: 0,
              tension: 0.28,
            },
            {
              label: "Hip Acceleration",
              data: analysis.timeline.hip_acceleration || [],
              borderColor: COLORS.warn,
              pointRadius: 0,
              tension: 0.28,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: COLORS.subtxt } } },
          scales: {
            x: {
              ticks: { color: COLORS.subtxt },
              grid: { color: "rgba(155,163,175,.14)" },
            },
            y: {
              ticks: { color: COLORS.subtxt },
              grid: { color: "rgba(155,163,175,.14)" },
            },
          },
        },
      });
    }

    return () => {
      if (kneeChartInstRef.current) kneeChartInstRef.current.destroy();
      if (trunkChartInstRef.current) trunkChartInstRef.current.destroy();
    };
  }, [analysis]);

  useEffect(
    () => () => {
      stopTimelinePlayback();
      liveRunningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    },
    [],
  );

  async function ensurePoseLibs() {
    if (!window.tf) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.19.0/dist/tf.min.js",
      );
    }
    if (!window.poseDetection) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection",
      );
    }
    tfRef.current = window.tf;
    poseRef.current = window.poseDetection;
    if (!tfRef.current || !poseRef.current) {
      throw new Error("Pose libraries failed to initialize.");
    }
  }

  async function ensureDetector() {
    if (detectorRef.current) return detectorRef.current;
    setStatus("loading model");
    await ensurePoseLibs();
    await tfRef.current.ready();
    detectorRef.current = await poseRef.current.createDetector(
      poseRef.current.SupportedModels.MoveNet,
      {
        modelType: poseRef.current.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
      },
    );
    setStatus("model ready");
    return detectorRef.current;
  }

  function normalizeKeypoints(kps, w, h) {
    return kps.slice(0, 17).map((k) => ({
      x: Number((k.x / Math.max(w, 1)).toFixed(6)),
      y: Number((k.y / Math.max(h, 1)).toFixed(6)),
      score: Number((k.score ?? 0).toFixed(6)),
    }));
  }

  function getAngle(pose, a, b, c) {
    if (!pose?.keypoints) return 180;
    return angleABC(
      pose.keypoints[KEYPOINT_INDEX[a]],
      pose.keypoints[KEYPOINT_INDEX[b]],
      pose.keypoints[KEYPOINT_INDEX[c]],
    );
  }

  function evaluateRealtime(pose) {
    if (!pose?.keypoints) {
      return {
        knee: 0,
        hip: 0,
        back: 0,
        path: 0,
        timing: 0,
        balance: 0,
        feedback: "Keep full body visible for tracking.",
        phase: "n/a",
        jointSeverity: {},
        status: { knee: "neutral", hip: "neutral", back: "neutral" },
      };
    }

    const selectedActivity = activity === "auto" ? "squat" : activity;
    const cfg = activityConfig[selectedActivity] || activityConfig.squat;
    const kp = pose.keypoints;

    const hipY = (kp[11].y + kp[12].y) / 2;
    const phase =
      selectedActivity === "squat"
        ? inferLiveSquatPhase(
            (getAngle(pose, "left_hip", "left_knee", "left_ankle") +
              getAngle(pose, "right_hip", "right_knee", "right_ankle")) /
              2,
            lastRtRef.current?.hipY,
            hipY,
          )
        : "work";

    const baselineHeelY =
      lastRtRef.current?.baselineHeelY ?? (kp[15].y + kp[16].y) / 2;
    const angleCache = {
      leftKneeAngle: angleABC(kp[11], kp[13], kp[15]),
      rightKneeAngle: angleABC(kp[12], kp[14], kp[16]),
      torsoLean: torsoLeanFromVertical(kp[5], kp[6], kp[11], kp[12]),
    };
    const evaluated = cfg.evaluateFrame(
      { keypoints: kp },
      { phase, baselineHeelY, angleCache },
    );

    const leftKnee = getAngle(pose, "left_hip", "left_knee", "left_ankle");
    const rightKnee = getAngle(pose, "right_hip", "right_knee", "right_ankle");
    const knee = (leftKnee + rightKnee) / 2;
    const hip = getAngle(pose, "left_shoulder", "left_hip", "left_knee");
    const back = torsoLeanFromVertical(kp[5], kp[6], kp[11], kp[12]);
    const hipX = (kp[11].x + kp[12].x) / 2;
    const path = Math.abs(kp[9].x - kp[10].x);
    const timing = Math.round(Math.abs(hipX - 0.5) * 1000);
    const balance = Number((Math.abs(hipX - 0.5) * 100).toFixed(1));

    let feedback = "Movement detected. Maintain controlled tempo.";
    if (evaluated.reasons.length) {
      feedback = `Phase: ${phase}. ${evaluated.reasons[0]}.`;
    } else if (selectedActivity === "squat") {
      feedback =
        "Strong squat pattern. Keep depth and knee tracking consistent.";
    }

    const kneeStatus = pickWorseSeverity(
      evaluated.checks.kneeGrade?.level || "neutral",
      evaluated.checks.trackGrade?.level || "neutral",
    );
    const hipStatus = evaluated.checks.depthGrade?.level || "neutral";
    const backStatus = evaluated.checks.torsoGrade?.level || "neutral";

    return {
      knee,
      hip,
      back,
      path,
      timing,
      balance,
      feedback,
      phase,
      hipY,
      baselineHeelY,
      jointSeverity: evaluated.jointSeverity,
      status: { knee: kneeStatus, hip: hipStatus, back: backStatus },
    };
  }

  function drawSkeleton(ctx, pose, alpha, jointSeverityMap, pulse = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;

    drawAnatomyCore(ctx, pose, Math.min(alpha * 0.95, 1));

    for (const [a, b] of FULL_SKELETON_EDGES) {
      const p1 = pose.keypoints[a];
      const p2 = pose.keypoints[b];
      if ((p1.score ?? 0) <= 0.08 || (p2.score ?? 0) <= 0.08) continue;

      const s1 = jointSeverityMap[a] || "neutral";
      const s2 = jointSeverityMap[b] || "neutral";
      const edgeSeverity = pickWorseSeverity(s1, s2);
      const edgeColor = statusPill(edgeSeverity);

      ctx.shadowBlur = edgeSeverity === "bad" ? 12 : 0;
      ctx.shadowColor =
        edgeSeverity === "bad" ? "rgba(255,77,79,0.75)" : "transparent";
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = edgeSeverity === "bad" ? 3.4 : 2.8;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let i = 0; i < 17; i += 1) {
      const kp = pose.keypoints[i];
      if ((kp.score ?? 0) <= 0.08) continue;
      const st = jointSeverityMap[i] || "neutral";
      const r = st === "bad" ? 4 + pulse : 4;
      ctx.fillStyle = statusPill(st);
      ctx.shadowBlur = st === "bad" ? 10 : 0;
      ctx.shadowColor = st === "bad" ? "rgba(255,77,79,0.7)" : "transparent";
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (st === "bad") {
        ctx.strokeStyle = "rgba(255,77,79,0.38)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawPose(videoEl, canvasEl, pose, jointSeverity) {
    const ctx = canvasEl.getContext("2d");
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    canvasEl.width = w;
    canvasEl.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(videoEl, 0, 0, w, h);

    if (!pose?.keypoints) return;

    const stablePose = stabilizePose(
      pose,
      trailRef.current.length
        ? trailRef.current[trailRef.current.length - 1]
        : null,
    );

    if (idealGhostRef.current) {
      drawSkeleton(ctx, idealGhostRef.current, 0.22, {});
    }

    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i += 1) {
      const alpha = 0.08 + ((i + 1) / Math.max(trail.length, 1)) * 0.2;
      drawSkeleton(ctx, trail[i], alpha, {});
    }

    const pulse = (Math.sin(performance.now() / 240) + 1) * 1.2;
    drawSkeleton(ctx, stablePose, 1, jointSeverity, pulse);
  }

  function preprocessActivityFrames(frames, selectedActivity) {
    if (!frames?.length) return [];
    const cfg = activityConfig[selectedActivity] || activityConfig.squat;
    const phaseData = cfg.detectPhases(frames);
    const baselineHeelY =
      frames
        .slice(0, Math.min(frames.length, 10))
        .reduce(
          (acc, f) => acc + (f.keypoints[15].y + f.keypoints[16].y) / 2,
          0,
        ) / Math.min(frames.length, 10);

    const smoothed = frames.map((frame, i) => {
      if (i === 0) return frame;
      const prev = frames[i - 1];
      return {
        ...frame,
        keypoints: frame.keypoints.map((kp, idx) => ({
          ...kp,
          x: prev.keypoints[idx].x * 0.35 + kp.x * 0.65,
          y: prev.keypoints[idx].y * 0.35 + kp.y * 0.65,
        })),
      };
    });

    const prepared = smoothed.map((frame, i) => {
      const phase = phaseData.phases[i] || "work";
      const angleCache = {
        leftKneeAngle: angleABC(
          frame.keypoints[11],
          frame.keypoints[13],
          frame.keypoints[15],
        ),
        rightKneeAngle: angleABC(
          frame.keypoints[12],
          frame.keypoints[14],
          frame.keypoints[16],
        ),
        torsoLean: torsoLeanFromVertical(
          frame.keypoints[5],
          frame.keypoints[6],
          frame.keypoints[11],
          frame.keypoints[12],
        ),
      };
      const evalResult = cfg.evaluateFrame(frame, {
        phase,
        baselineHeelY,
        frameIndex: i,
        bottomIndex: phaseData.bottomIdx,
        angleCache,
      });
      return {
        ...frame,
        phase,
        frameError: evalResult.frameError,
        jointSeverity: evalResult.jointSeverity,
        metrics: evalResult.metrics,
        reasons: evalResult.reasons,
      };
    });

    return prepared;
  }

  function drawTimelineFrame(idx, shouldSetState = true) {
    const frames = timelineDataRef.current;
    const canvas = timelineCanvasRef.current;
    if (!frames.length || !canvas) return;
    const frame = frames[clamp(idx, 0, frames.length - 1)];
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#070d15";
    ctx.fillRect(0, 0, w, h);

    const rawPose = {
      keypoints: frame.keypoints.map((k) => ({
        x: k.x,
        y: k.y,
        score: k.score,
      })),
    };

    const prevFrame = frames[Math.max(0, idx - 1)];
    const prevRawPose = prevFrame
      ? {
          keypoints: prevFrame.keypoints.map((k) => ({
            x: k.x,
            y: k.y,
            score: k.score,
          })),
        }
      : null;
    const stable = stabilizePose(rawPose, prevRawPose);
    const fitted = fitPoseToCanvas(stable, w, h, 26);

    drawSkeleton(ctx, fitted, 1, frame.jointSeverity, 0);

    ctx.fillStyle = "rgba(230,237,243,0.9)";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`t=${frame.timestamp.toFixed(2)}s`, 10, 18);
    ctx.fillText(`phase=${frame.phase}`, 10, 34);
    if (frame.reasons?.length) {
      ctx.fillStyle = "rgba(255,200,87,0.95)";
      ctx.fillText(frame.reasons[0], 10, 50);
    }

    timelineFrameIdxRef.current = idx;
    if (timelineSliderRef.current)
      timelineSliderRef.current.value = String(idx);
    if (shouldSetState) {
      setTimelineMeta((prev) => ({
        ...prev,
        current: idx,
        phase: frame.phase,
      }));
    }
  }

  function stopTimelinePlayback() {
    timelinePlayRef.current = false;
    if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current);
    timelineRafRef.current = null;
    setTimelineMeta((prev) => ({ ...prev, playing: false }));
  }

  function playTimeline() {
    const frames = timelineDataRef.current;
    if (!frames.length) return;

    timelinePlayRef.current = true;
    timelineTickRef.current = 0;
    setTimelineMeta((prev) => ({ ...prev, playing: true }));
    timelineLastRenderTsRef.current = 0;

    const fpsInterval = 1000 / 27;
    const tick = (ts) => {
      if (!timelinePlayRef.current) return;

      if (!timelineLastRenderTsRef.current)
        timelineLastRenderTsRef.current = ts;
      if (ts - timelineLastRenderTsRef.current >= fpsInterval) {
        timelineLastRenderTsRef.current = ts;
        const next = (timelineFrameIdxRef.current + 1) % frames.length;
        timelineTickRef.current += 1;
        const syncState = timelineTickRef.current % 6 === 0;
        drawTimelineFrame(next, syncState);
      }
      timelineRafRef.current = requestAnimationFrame(tick);
    };

    timelineRafRef.current = requestAnimationFrame(tick);
  }
  async function openCameraStream() {
    const constraints = [
      {
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: { facingMode: "environment" }, audio: false },
      { video: true, audio: false },
    ];

    let lastErr = null;
    for (const c of constraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("Could not access camera.");
  }

  function updateTrends(rt) {
    setTrend((prev) => {
      const push = (arr, v) => [...arr.slice(-24), Number(v.toFixed(2))];
      return {
        knee: push(prev.knee, rt.knee),
        hip: push(prev.hip, rt.hip),
        back: push(prev.back, rt.back),
      };
    });
  }

  function updateConfidence(statusObj) {
    const vals = Object.values(statusObj);
    const ratio = vals.length
      ? vals.reduce(
          (acc, v) => acc + (v === "good" ? 1 : v === "warning" ? 0.5 : 0),
          0,
        ) / vals.length
      : 0;
    setLiveConfidence((prev) => {
      const next = Math.max(0, Math.min(100, prev * 0.75 + ratio * 100 * 0.25));
      return next;
    });
  }

  function updateRepCounter(knee) {
    if (activity !== "squat") return;
    const prev = lastRtRef.current;
    if (!prev) return;
    if (prev.knee > 125 && knee < 95) {
      setRepCount((r) => r + 1);
    }
  }

  function updateSwingDetection(pose, nowTs) {
    const wrist = pose?.keypoints?.[10];
    if (!wrist) return;

    const s = swingRef.current;
    if (!s.prev) {
      s.prev = { x: wrist.x, y: wrist.y, ts: nowTs };
      return;
    }

    const dt = Math.max((nowTs - s.prev.ts) / 1000, 1 / 120);
    const dx = wrist.x - s.prev.x;
    const dy = wrist.y - s.prev.y;
    const vel = Math.hypot(dx, dy) / dt;
    s.smoothVel = s.smoothVel * 0.72 + vel * 0.28;

    const threshold = 250;
    if (s.smoothVel > threshold && nowTs - s.lastTriggerTs > 320) {
      s.lastTriggerTs = nowTs;
      s.lastSwingTs = nowTs;
    }

    s.prev = { x: wrist.x, y: wrist.y, ts: nowTs };

    // New 3D Bat Tracking Data
    const leftWrist = pose?.keypoints?.[9];
    const rightWrist = pose?.keypoints?.[10];
    if (leftWrist && rightWrist) {
      // Calculate normalized center position (assuming 640x480 default TFJS video feed, will refine in Three.js)
      const cx = (leftWrist.x + rightWrist.x) / 2;
      const cy = (leftWrist.y + rightWrist.y) / 2;

      const videoEl = liveVideoRef.current;
      const vw = videoEl ? videoEl.videoWidth || 640 : 640;
      const vh = videoEl ? videoEl.videoHeight || 480 : 480;

      s.batPos = {
        x: (cx / vw) * 2 - 1, // Normalized -1 to 1
        y: -((cy / vh) * 2 - 1), // Normalized -1 to 1, flipped Y for 3D
      };

      // Calculate angle
      s.batAngle = Math.atan2(
        rightWrist.y - leftWrist.y,
        rightWrist.x - leftWrist.x,
      );
    }
  }

  async function startLiveCapture() {
    try {
      await ensureDetector();
      const videoEl = liveVideoRef.current;
      const canvasEl = liveCanvasRef.current;

      streamRef.current = await openCameraStream();
      videoEl.srcObject = streamRef.current;
      await videoEl.play();

      framesRef.current = [];
      trailRef.current = [];
      idealGhostRef.current = null;
      lastSampleTsRef.current = 0;
      startTsRef.current = performance.now();
      lastRtRef.current = null;
      setRepCount(0);
      setLiveConfidence(0);
      setCompareScore(null);

      if (compareMode && pipVideoRef.current && uploadVideoRef.current?.src) {
        pipVideoRef.current.src = uploadVideoRef.current.src;
        pipVideoRef.current.currentTime = 0;
        pipVideoRef.current.play().catch(() => {});
      }
      setStatus("live running");
      liveRunningRef.current = true;

      while (liveRunningRef.current) {
        const poses = await detectorRef.current.estimatePoses(videoEl, {
          maxPoses: 1,
          flipHorizontal: false,
        });
        const pose = poses[0];

        if (pose?.keypoints) {
          const rt = evaluateRealtime(pose);
          drawPose(videoEl, canvasEl, pose, rt.jointSeverity);

          const statusVals = Object.values(rt.status);
          if (!statusVals.includes("bad") && !idealGhostRef.current) {
            idealGhostRef.current = {
              keypoints: pose.keypoints.map((k) => ({ ...k })),
            };
          }

          const now = performance.now();
          if (cricketModeEnabled) {
            updateSwingDetection(pose, now);
          }
          if (now - lastSampleTsRef.current >= 100) {
            lastSampleTsRef.current = now;
            updateTrends(rt);
            updateConfidence(rt.status);
            updateRepCounter(rt.knee);

            setLiveMetrics({
              knee: rt.knee,
              hip: rt.hip,
              back: rt.back,
              timing: rt.timing,
              balance: rt.balance,
              path: rt.path,
            });

            let finalFeedback = rt.feedback;

            if (
              compareMode &&
              uploadedFramesRef.current &&
              pipVideoRef.current
            ) {
              const uploadTime = pipVideoRef.current.currentTime || 0;
              const goldenFrames = uploadedFramesRef.current;

              let nearest = goldenFrames[0];
              let minDiff = Infinity;
              for (const gf of goldenFrames) {
                const diff = Math.abs(gf.timestamp - uploadTime);
                if (diff < minDiff) {
                  minDiff = diff;
                  nearest = gf;
                }
              }

              if (nearest && nearest.angles) {
                let diffs = [];
                if (nearest.angles.knee != null)
                  diffs.push(Math.abs(rt.knee - nearest.angles.knee));
                if (nearest.angles.hip != null)
                  diffs.push(Math.abs(rt.hip - nearest.angles.hip));
                if (nearest.angles.back != null)
                  diffs.push(Math.abs(rt.back - nearest.angles.back));

                if (diffs.length > 0) {
                  const avgDiff =
                    diffs.reduce((a, b) => a + b, 0) / diffs.length;
                  const simScore = Math.max(0, 100 - avgDiff * 2);
                  setCompareScore(simScore);

                  if (simScore > 85) {
                    finalFeedback = `[PRO MATCH] Excellent alignment (${Math.round(simScore)}%)`;
                  } else {
                    finalFeedback = `[PRO COMPARE] Adjust form to match video. Similarity: ${Math.round(simScore)}%`;
                  }
                }
              }
            } else {
              setCompareScore(null);
            }

            setLiveFeedback(finalFeedback);

            if (framesRef.current.length < 350) {
              framesRef.current.push({
                timestamp: Number(
                  ((now - startTsRef.current) / 1000).toFixed(3),
                ),
                keypoints: normalizeKeypoints(
                  pose.keypoints,
                  videoEl.videoWidth,
                  videoEl.videoHeight,
                ),
              });
            }

            trailRef.current.push(
              stabilizePose(
                { keypoints: pose.keypoints.map((k) => ({ ...k })) },
                trailRef.current.length
                  ? trailRef.current[trailRef.current.length - 1]
                  : null,
              ),
            );
            if (trailRef.current.length > 14) trailRef.current.shift();
          }

          lastRtRef.current = rt;
        }

        await sleep(16);
      }
    } catch (err) {
      setStatus("live start failed");
      alert(String(err?.message || err));
    }
  }

  function stopLiveCapture() {
    liveRunningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  }

  function deriveRisk(score, balance = 0) {
    if (score < 60 || balance > 0.06) return "High";
    if (score < 80 || balance > 0.04) return "Medium";
    return "Low";
  }

  function deriveConsistency(timeline = {}) {
    const arr = timeline.avg_knee || [];
    if (arr.length < 3) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
      arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / arr.length;
    const std = Math.sqrt(variance);
    return Math.max(0, Math.min(100, 100 - std));
  }

  function buildFeedbackCards(result) {
    const cards = [];
    (result.feedback || []).forEach((f) => {
      const low = f.toLowerCase();
      let severity = "low";
      if (low.includes("off") || low.includes("late") || low.includes("deviat"))
        severity = "high";
      else if (low.includes("adjust") || low.includes("focus"))
        severity = "medium";
      cards.push({ msg: f, severity });
    });

    (result.coaching_explanations || []).forEach((f) =>
      cards.push({ msg: f, severity: "medium" }),
    );
    if (cricketModeEnabled) {
      cards.unshift({
        msg:
          cricketResult.outcome === "HIT"
            ? `Cricket delivery result: HIT${cricketResult.reactionMs != null ? ` • Reaction ${cricketResult.reactionMs} ms` : ""}.`
            : cricketResult.outcome === "MISS"
              ? "Cricket delivery result: MISS. Swing earlier as ball enters the hitting zone."
              : "Cricket mode active: release a ball and swing through the zone to register HIT.",
        severity:
          cricketResult.outcome === "HIT"
            ? "low"
            : cricketResult.outcome === "MISS"
              ? "high"
              : "medium",
      });
    }
    return cards.slice(0, 6);
  }

  async function analyzeFrames(frames) {
    if (!frames || frames.length < 10) {
      alert("Capture longer movement before analysis.");
      return;
    }

    setIsLoading(true);
    setStatus("analyzing");

    try {
      const backendHint = ACTIVITY_BACKEND_HINT[activity] || "auto";
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_hint: backendHint, fps: 10, frames }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setAnalysis(data);
      setRawPreview(JSON.stringify(data, null, 2));
      setStatus("analysis complete");

      const resolvedActivity =
        activity === "auto"
          ? data.activity === "cricket_cover_drive"
            ? "coverDrive"
            : "squat"
          : activity;
      const preparedFrames = preprocessActivityFrames(frames, resolvedActivity);
      timelineDataRef.current = preparedFrames;
      const worstIdx = getWorstFrame(preparedFrames);
      const worstFrameReason = preparedFrames[worstIdx]?.reasons?.[0];
      const cards = buildFeedbackCards(data);
      if (worstFrameReason) {
        cards.unshift({
          msg: `Worst frame at ${preparedFrames[worstIdx].timestamp.toFixed(2)}s: ${worstFrameReason}`,
          severity: "high",
        });
      }
      setFeedbackItems(cards.slice(0, 6));
      setTimelineMeta({
        total: preparedFrames.length,
        current: worstIdx,
        worst: worstIdx,
        phase: preparedFrames[worstIdx]?.phase || "n/a",
        playing: false,
      });
      if (timelineSliderRef.current) {
        timelineSliderRef.current.max = String(
          Math.max(0, preparedFrames.length - 1),
        );
        timelineSliderRef.current.value = String(worstIdx);
      }
      drawTimelineFrame(worstIdx);

      const consistency = deriveConsistency(data.timeline);
      const risk = deriveRisk(
        data.overall_score,
        data.biomechanics?.balance_index || 0,
      );
      const session = {
        createdAt: Date.now(),
        activity: data.activity,
        score: Number(data.overall_score.toFixed(1)),
        consistency: Number(consistency.toFixed(1)),
        risk,
        power: Number((data.biomechanics?.power_estimate_w || 0).toFixed(0)),
      };
      setSessions((prev) => [session, ...prev].slice(0, 20));

      setSummaryData(session);
      setShowSummary(true);
    } catch (err) {
      setStatus("analysis failed");
      alert(String(err?.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeUploadedVideo() {
    const videoEl = uploadVideoRef.current;
    const canvasEl = uploadCanvasRef.current;
    if (!videoEl?.src) {
      alert("Upload a video first.");
      return;
    }

    await ensureDetector();
    await videoEl.play();
    videoEl.muted = true;

    const frames = [];
    let lastSample = 0;
    const start = performance.now();
    trailRef.current = [];

    setStatus("processing upload");

    while (!videoEl.ended) {
      const poses = await detectorRef.current.estimatePoses(videoEl, {
        maxPoses: 1,
        flipHorizontal: false,
      });
      const pose = poses[0];
      if (pose?.keypoints) {
        const rt = evaluateRealtime(pose);
        drawPose(videoEl, canvasEl, pose, rt.jointSeverity);

        const now = performance.now();
        if (now - lastSample >= 100) {
          lastSample = now;
          if (frames.length < 350) {
            frames.push({
              timestamp: Number(((now - start) / 1000).toFixed(3)),
              keypoints: normalizeKeypoints(
                pose.keypoints,
                videoEl.videoWidth,
                videoEl.videoHeight,
              ),
            });
          }
          trailRef.current.push({
            keypoints: pose.keypoints.map((k) => ({ ...k })),
          });
          if (trailRef.current.length > 14) trailRef.current.shift();
        }
      }
      await sleep(16);
    }

    videoEl.pause();
    videoEl.currentTime = 0;
    await analyzeFrames(frames);

    if (timelineDataRef.current && timelineDataRef.current.length > 0) {
      uploadedFramesRef.current = timelineDataRef.current;
      setHasGoldenSkeleton(true);
    }
  }

  function exportJSON() {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `synapse-analysis-${Date.now()}.json`;
    a.click();
  }

  function exportCSV() {
    if (!analysis?.kinematics_stream?.length) return;
    const headers = [
      "timestamp",
      "knee_angle",
      "trunk_angle",
      "hip_y",
      "hip_velocity",
      "hip_acceleration",
    ];
    const rows = analysis.kinematics_stream.map((row) =>
      headers.map((h) => row[h]).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `synapse-kinematics-${Date.now()}.csv`;
    a.click();
  }

  const avgScore = useMemo(() => {
    if (!sessions.length) return 0;
    return sessions.reduce((a, b) => a + b.score, 0) / sessions.length;
  }, [sessions]);

  const sidebarClass = sidebarCollapsed ? "w-20" : "w-64";

  const metricStatus = {
    knee: gradeDeviation(distanceToRange(liveMetrics.knee, 80, 100), 0, 10)
      .level,
    hip: gradeDeviation(distanceToRange(liveMetrics.hip, 20, 45), 0, 12).level,
    back: gradeDeviation(distanceToRange(liveMetrics.back, 20, 45), 0, 12)
      .level,
  };

  return (
    <div className="bg-grid min-h-screen">
      <SessionModal
        open={showSummary}
        onClose={() => setShowSummary(false)}
        summary={summaryData}
      />

      <header className="glass-nav sticky top-0 z-40 border-b border-white/10">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-primary">
              Synapse Sports Tech
            </p>
            <h1 className="font-heading text-xl">
              AI Motion Analysis Platform
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card px-3 py-1 text-xs text-subtxt">
              <span className="pulse-dot h-2 w-2 rounded-full bg-secondary" />
              {status}
            </span>
            <button
              className="btn-press rounded-xl border border-white/15 bg-card px-3 py-2 text-sm text-subtxt"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              {sidebarCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 p-4 lg:grid-cols-[auto_1fr_380px] lg:p-6">
        <aside
          className={`${sidebarClass} rounded-2xl border border-white/10 bg-card p-3 transition-all duration-300`}
        >
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`sidebar-item btn-press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active ? "border border-primary/55 bg-primary/10 text-txt" : "border border-transparent text-subtxt"}`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main
          className={`space-y-4 ${activeNav === "analyze" ? "" : "lg:col-span-2"}`}
        >
          {activeNav === "home" && (
            <>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <p className="text-xs uppercase tracking-wide text-primary">
                  Welcome Back
                </p>
                <h2 className="mt-1 font-heading text-2xl">
                  Sports Motion Command Center
                </h2>
                <p className="mt-1 text-sm text-subtxt">
                  Start a live session, upload a clip, or review past
                  biomechanics trends.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-press rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-black"
                    onClick={() => setActiveNav("analyze")}
                  >
                    Start Analysis
                  </button>
                  <button
                    className="btn-press rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black"
                    onClick={() => setActiveNav("history")}
                  >
                    View History
                  </button>
                </div>
              </section>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <h3 className="font-heading text-lg">Recent Sessions</h3>
                <div className="mt-3 grid gap-2">
                  {sessions.slice(0, 6).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/10 bg-bg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s.activity}</span>
                        <span className="text-subtxt">
                          {new Date(s.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-subtxt">
                        <span>Score {s.score}/100</span>
                        <span>Risk {s.risk}</span>
                      </div>
                    </div>
                  ))}
                  {!sessions.length && (
                    <p className="text-sm text-subtxt">
                      No sessions yet. Run your first analysis.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          {activeNav === "history" && (
            <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-xl">Session History</h2>
                <span className="text-sm text-subtxt">
                  {sessions.length} sessions
                </span>
              </div>
              <div className="space-y-2">
                {sessions.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-bg p-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <strong>{s.activity}</strong>
                      <span className="text-subtxt">
                        {new Date(s.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg border border-white/10 bg-card p-2">
                        <p className="text-subtxt">Score</p>
                        <p>{s.score}/100</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-card p-2">
                        <p className="text-subtxt">Consistency</p>
                        <p>{s.consistency}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-card p-2">
                        <p className="text-subtxt">Risk</p>
                        <p>{s.risk}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-card p-2">
                        <p className="text-subtxt">Power</p>
                        <p>{s.power}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!sessions.length && (
                  <p className="text-sm text-subtxt">
                    No history available yet.
                  </p>
                )}
              </div>
            </section>
          )}

          {activeNav === "insights" && (
            <>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <h2 className="font-heading text-xl">Performance Insights</h2>
                <p className="mt-1 text-sm text-subtxt">
                  Use these trends to prioritize technique work.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-bg p-3">
                    <p className="text-xs text-subtxt">Best Score</p>
                    <p className="font-heading text-2xl">
                      {sessions.length
                        ? Math.max(...sessions.map((s) => s.score)).toFixed(1)
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg p-3">
                    <p className="text-xs text-subtxt">Avg Score</p>
                    <p className="font-heading text-2xl">
                      {sessions.length ? avgScore.toFixed(1) : "--"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-bg p-3">
                    <p className="text-xs text-subtxt">Total Sessions</p>
                    <p className="font-heading text-2xl">{sessions.length}</p>
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <h3 className="font-heading text-lg">Technique Trend</h3>
                <p className="mt-1 text-sm text-subtxt">
                  Recent sessions with risk and consistency overview.
                </p>
                <div className="mt-3 space-y-2">
                  {sessions.slice(0, 8).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/10 bg-bg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span>{s.activity}</span>
                        <span className="text-subtxt">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-subtxt">
                        <span>Consistency {s.consistency}</span>
                        <span>Risk {s.risk}</span>
                      </div>
                    </div>
                  ))}
                  {!sessions.length && (
                    <p className="text-sm text-subtxt">
                      Run sessions to unlock insight trends.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          {activeNav === "profile" && (
            <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
              <h2 className="font-heading text-xl">Athlete Profile</h2>
              <p className="mt-1 text-sm text-subtxt">
                Manage athlete preferences and coaching mode setup.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Coaching Style</p>
                  <p className="mt-1">Technical + Encouraging</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Preferred Activity</p>
                  <p className="mt-1">
                    {ACTIVITY_OPTIONS.find((x) => x.key === activity)?.label ||
                      "Auto Detect"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Coach Mode</p>
                  <p className="mt-1">{coachMode ? "Enabled" : "Disabled"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Sessions Logged</p>
                  <p className="mt-1">{sessions.length}</p>
                </div>
              </div>
            </section>
          )}

          {activeNav === "analyze" && (
            <>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-xl">Live Analysis</h2>
                    <p className="text-sm text-subtxt">
                      Real-time skeletal tracking and biomechanics coaching
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasGoldenSkeleton && (
                      <button
                        className={`btn-press rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${compareMode ? "bg-secondary text-black drop-shadow-[0_0_8px_rgba(0,255,170,0.5)]" : "border border-secondary/50 text-secondary hover:bg-secondary/10"}`}
                        onClick={() => setCompareMode(!compareMode)}
                      >
                        {compareMode ? "Compare Active" : "Pro-Compare"}
                      </button>
                    )}
                    <select
                      value={analysisMode}
                      onChange={(e) => setAnalysisMode(e.target.value)}
                      className="rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-txt outline-none"
                    >
                      <option value="standard">Standard Mode</option>
                      <option value="cricket">Cricket Mode</option>
                    </select>
                    <select
                      value={activity}
                      onChange={(e) => setActivity(e.target.value)}
                      className="rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-txt outline-none"
                    >
                      {ACTIVITY_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-press rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-black"
                      onClick={ensureDetector}
                    >
                      Init Model
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_310px]">
                  <div className="flex flex-col gap-4">
                    <div className="neon-border relative overflow-hidden rounded-2xl bg-black">
                      <video
                        ref={liveVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="aspect-video w-full object-cover"
                      />
                      <canvas
                        ref={liveCanvasRef}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      />

                      {compareMode && hasGoldenSkeleton && (
                        <div className="absolute right-3 top-14 w-1/3 overflow-hidden rounded-xl border-2 border-secondary shadow-2xl z-20">
                          <video
                            ref={pipVideoRef}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full aspect-video object-cover"
                          />
                        </div>
                      )}

                      <div className="absolute left-3 top-3 flex items-center gap-2 z-30">
                        <span className="rounded-full bg-primary/85 px-3 py-1 text-xs font-semibold text-black">
                          {(
                            ACTIVITY_OPTIONS.find((x) => x.key === activity)
                              ?.label || activity
                          )
                            .replace("Gym: ", "")
                            .replace("Cricket: ", "")}
                        </span>
                        <span className="rounded-full bg-card/80 px-3 py-1 text-xs text-subtxt">
                          Rep {repCount}
                        </span>
                      </div>

                      <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-xs text-subtxt">
                        <span className="pulse-dot h-2 w-2 rounded-full bg-secondary" />
                        Live
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/15 bg-card/80 p-3 backdrop-blur z-30">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wide text-primary">
                            AI Coach
                          </p>
                          {compareScore !== null && (
                            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
                              Pro Sim: {compareScore.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-snug">{liveFeedback}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-warn via-yellow-400 to-secondary transition-all duration-300"
                              style={{ width: `${liveConfidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-subtxt">
                            {Math.round(liveConfidence)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {cricketModeEnabled && (
                      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-primary/25 bg-card">
                        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-bg/80 p-3 backdrop-blur">
                          <div className="flex items-center gap-3">
                            <h4 className="flex items-center gap-2 font-heading text-sm text-primary">
                              <span
                                className={`inline-flex h-2 w-2 rounded-full ${cricketSceneReady ? "pulse-dot bg-secondary" : "bg-warn"}`}
                              />
                              3D Stadium
                            </h4>
                            <div className="flex rounded-lg border border-white/5 bg-black/50 p-1">
                              <div className="px-3 py-1 text-center">
                                <p className="text-[9px] uppercase tracking-wider text-subtxt">
                                  Balls
                                </p>
                                <p className="font-mono text-sm font-bold leading-none text-white">
                                  {deliveryCount}
                                </p>
                              </div>
                              <div className="w-px bg-white/10" />
                              <div className="px-3 py-1 text-center">
                                <p className="text-[9px] uppercase tracking-wider text-subtxt">
                                  Hits
                                </p>
                                <p className="font-mono text-sm font-bold leading-none text-secondary">
                                  {hitCount}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {cricketResult.reactionMs != null && (
                              <span className="flex items-center gap-1 rounded bg-black/40 px-2 py-1 text-[10px] uppercase text-subtxt">
                                Reaction:{" "}
                                <strong className="text-white">
                                  {cricketResult.reactionMs}ms
                                </strong>
                              </span>
                            )}
                            <div className="flex min-w-[80px] items-center justify-center rounded-lg border border-white/5 bg-black/50 px-3 py-1.5">
                              <p
                                className={`font-mono text-xs font-bold ${
                                  cricketResult.outcome === "HIT" ||
                                  cricketResult.outcome === "PERFECT" ||
                                  cricketResult.outcome === "EARLY" ||
                                  cricketResult.outcome === "LATE"
                                    ? "text-secondary"
                                    : cricketResult.outcome === "MISS"
                                      ? "text-warn"
                                      : cricketResult.outcome === "in_flight"
                                        ? "animate-pulse text-primary"
                                        : "text-subtxt"
                                }`}
                              >
                                {cricketResult.outcome === "idle"
                                  ? "READY"
                                  : cricketResult.outcome === "in_flight"
                                    ? "IN FLIGHT"
                                    : cricketResult.outcome.toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          ref={cricketSceneMountRef}
                          className="relative z-0 h-[320px] w-full bg-[#060c14]"
                        />

                        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-md">
                          <select
                            value={cricketSpeed}
                            onChange={(e) => setCricketSpeed(e.target.value)}
                            className="cursor-pointer rounded-lg bg-transparent px-2 py-1 text-xs text-white outline-none hover:bg-white/5"
                          >
                            {Object.entries(BOWLING_SPEED).map(([k, v]) => (
                              <option
                                key={k}
                                value={k}
                                className="bg-bg text-white"
                              >
                                {v.label}
                              </option>
                            ))}
                          </select>
                          <div className="h-4 w-px bg-white/20"></div>
                          <button
                            className="btn-press rounded-lg bg-secondary/90 px-4 py-1.5 text-xs font-bold text-black shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={startDelivery}
                            disabled={!cricketSceneReady}
                          >
                            BOWL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {isLoading ? (
                      <>
                        <div className="metric-skeleton h-28 rounded-2xl" />
                        <div className="metric-skeleton h-28 rounded-2xl" />
                        <div className="metric-skeleton h-28 rounded-2xl" />
                      </>
                    ) : (
                      <>
                        <MetricsCard
                          label="Knee Angle"
                          value={liveMetrics.knee.toFixed(1)}
                          unit="deg"
                          status={metricStatus.knee}
                          sparkValues={trend.knee}
                        />
                        <MetricsCard
                          label="Hip Angle"
                          value={liveMetrics.hip.toFixed(1)}
                          unit="deg"
                          status={metricStatus.hip}
                          sparkValues={trend.hip}
                        />
                        <MetricsCard
                          label="Back Angle"
                          value={liveMetrics.back.toFixed(1)}
                          unit="deg"
                          status={metricStatus.back}
                          sparkValues={trend.back}
                        />
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="btn-press rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-black"
                        onClick={startLiveCapture}
                      >
                        Start Live
                      </button>
                      <button
                        className="btn-press rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-black"
                        onClick={() => {
                          stopLiveCapture();
                          analyzeFrames(framesRef.current);
                        }}
                      >
                        Stop + Analyze
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-bg p-3 text-xs text-subtxt">
                      <div className="mb-1 flex justify-between">
                        <span>Timing Offset</span>
                        <strong className="text-txt">
                          {liveMetrics.timing} ms
                        </strong>
                      </div>
                      <div className="mb-1 flex justify-between">
                        <span>Path Width</span>
                        <strong className="text-txt">
                          {liveMetrics.path.toFixed(3)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Balance Drift</span>
                        <strong className="text-txt">
                          {liveMetrics.balance}%
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-heading text-lg">
                    Upload Video Analysis
                  </h3>
                  <button
                    className="btn-press rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-subtxt"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose Video
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    uploadVideoRef.current.src = URL.createObjectURL(f);
                    setStatus(`loaded: ${f.name}`);
                  }}
                />
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <video
                    ref={uploadVideoRef}
                    controls
                    playsInline
                    muted
                    className="aspect-video w-full object-cover"
                  />
                  <canvas
                    ref={uploadCanvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />
                </div>
                <button
                  className="btn-press mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black"
                  onClick={analyzeUploadedVideo}
                >
                  Analyze Upload
                </button>
              </section>

              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <h3 className="font-heading text-lg">Data Visualization</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-bg p-3">
                    <canvas ref={kneeChartRef} className="h-64" />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-bg p-3">
                    <canvas ref={trunkChartRef} className="h-64" />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-bg p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-heading text-sm">
                      Skeleton Time-Lapse (Activity-Aware)
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-subtxt">
                      <span>
                        Frame {timelineMeta.current + 1}/
                        {Math.max(1, timelineMeta.total)}
                      </span>
                      <span>•</span>
                      <span>Phase: {timelineMeta.phase}</span>
                      <span>•</span>
                      <span className="text-warn">
                        Worst: #{timelineMeta.worst + 1}
                      </span>
                    </div>
                  </div>

                  <canvas
                    ref={timelineCanvasRef}
                    width="780"
                    height="360"
                    className="w-full rounded-xl border border-white/10 bg-[#070d15]"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      className="btn-press rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-black"
                      onClick={() => {
                        if (timelineMeta.playing) stopTimelinePlayback();
                        else playTimeline();
                      }}
                      disabled={!timelineMeta.total}
                    >
                      {timelineMeta.playing ? "Pause" : "Play"}
                    </button>
                    <button
                      className="btn-press rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-black"
                      onClick={() => {
                        stopTimelinePlayback();
                        drawTimelineFrame(timelineMeta.worst || 0);
                      }}
                      disabled={!timelineMeta.total}
                    >
                      Jump To Worst
                    </button>
                    <input
                      ref={timelineSliderRef}
                      type="range"
                      min="0"
                      max={Math.max(0, timelineMeta.total - 1)}
                      defaultValue="0"
                      className="h-2 flex-1 cursor-pointer accent-primary"
                      onChange={(e) => {
                        stopTimelinePlayback();
                        drawTimelineFrame(Number(e.target.value));
                      }}
                    />
                  </div>
                </div>
              </section>
            </>
          )}
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <h3 className="font-heading text-lg">Performance Score</h3>
            <CircularScore score={analysis?.overall_score || 0} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-subtxt">
              <div className="rounded-xl border border-white/10 bg-bg p-2">
                <p>Activity</p>
                <strong className="text-sm text-txt">
                  {analysis?.activity || "--"}
                </strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-bg p-2">
                <p>Status</p>
                <strong className="text-sm text-txt">{status}</strong>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg">AI Coaching</h3>
              <span className="rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">
                Prioritized
              </span>
            </div>
            <div className="space-y-2">
              {(feedbackItems.length
                ? feedbackItems
                : [
                    {
                      msg: "Run an analysis to get personalized feedback.",
                      severity: "low",
                    },
                  ]
              ).map((f, i) => (
                <FeedbackCard key={i} msg={f.msg} severity={f.severity} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <h3 className="font-heading text-lg">Session Controls</h3>
            <div className="mt-2 space-y-2">
              <button
                className="btn-press w-full rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-subtxt"
                onClick={() => setShowSummary(true)}
                disabled={!summaryData}
              >
                Open Session Summary
              </button>
              <button
                className="btn-press w-full rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-subtxt"
                onClick={exportJSON}
                disabled={!analysis}
              >
                Export JSON
              </button>
              <button
                className="btn-press w-full rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-subtxt"
                onClick={exportCSV}
                disabled={!analysis}
              >
                Export CSV
              </button>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-subtxt">
              <input
                type="checkbox"
                checked={coachMode}
                onChange={(e) => setCoachMode(e.target.checked)}
              />
              Coach Mode (advanced)
            </label>
            {coachMode && (
              <pre className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-bg p-3 text-[11px] text-primary">
                {rawPreview || "{}"}
              </pre>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <h3 className="font-heading text-lg">Session Snapshot</h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-white/10 bg-bg p-2">
                <p className="text-[11px] text-subtxt">Perf.</p>
                <strong>{homeSummary.performance}</strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-bg p-2">
                <p className="text-[11px] text-subtxt">Consist.</p>
                <strong>{homeSummary.consistency}</strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-bg p-2">
                <p className="text-[11px] text-subtxt">Risk</p>
                <strong>{homeSummary.risk}</strong>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {sessions.slice(0, 4).map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-bg p-2 text-xs"
                >
                  <div className="flex items-center justify-between text-subtxt">
                    <span>{s.activity}</span>
                    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <strong>{s.score}/100</strong>
                    <span className="text-subtxt">Risk: {s.risk}</span>
                  </div>
                </div>
              ))}
              {!sessions.length && (
                <p className="text-xs text-subtxt">No sessions yet.</p>
              )}
            </div>
          </section>

          {activeNav === "insights" && (
            <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
              <h3 className="font-heading text-lg">Insights</h3>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-bg p-2">
                  <p className="text-[11px] text-subtxt">Best</p>
                  <strong>
                    {sessions.length
                      ? Math.max(...sessions.map((s) => s.score)).toFixed(1)
                      : "--"}
                  </strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-2">
                  <p className="text-[11px] text-subtxt">Avg</p>
                  <strong>
                    {sessions.length ? avgScore.toFixed(1) : "--"}
                  </strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-2">
                  <p className="text-[11px] text-subtxt">Total</p>
                  <strong>{sessions.length}</strong>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
