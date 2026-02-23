const appShell = document.getElementById('appShell');
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const screens = Array.from(document.querySelectorAll('.screen'));
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

const themeToggle = document.getElementById('themeToggle');
const homeStartBtn = document.getElementById('homeStartBtn');
const jumpLiveBtn = document.getElementById('jumpLiveBtn');
const jumpUploadBtn = document.getElementById('jumpUploadBtn');

const statusEl = document.getElementById('status');
const activitySelect = document.getElementById('activitySelect');
const initBtn = document.getElementById('initBtn');
const startLiveBtn = document.getElementById('startLiveBtn');
const stopLiveBtn = document.getElementById('stopLiveBtn');
const analyzeUploadBtn = document.getElementById('analyzeUploadBtn');

const liveVideo = document.getElementById('liveVideo');
const liveCanvas = document.getElementById('liveCanvas');
const liveCtx = liveCanvas.getContext('2d');
const liveStreamBody = document.querySelector('#liveStreamTable tbody');

const fileInput = document.getElementById('fileInput');
const uploadVideo = document.getElementById('uploadVideo');
const uploadCanvas = document.getElementById('uploadCanvas');
const uploadCtx = uploadCanvas.getContext('2d');

const metricsToggle = document.getElementById('metricsToggle');
const metricsContent = document.getElementById('metricsContent');
const liveFeedbackEl = document.getElementById('liveFeedback');
const confidenceBar = document.getElementById('confidenceBar');
const confidenceValue = document.getElementById('confidenceValue');

const metricKnee = document.getElementById('metricKnee');
const metricHip = document.getElementById('metricHip');
const metricPath = document.getElementById('metricPath');
const metricTiming = document.getElementById('metricTiming');
const metricBalance = document.getElementById('metricBalance');

const detectedActivityEl = document.getElementById('detectedActivity');
const overallScoreEl = document.getElementById('overallScore');
const feedbackListEl = document.getElementById('feedbackList');
const explanationListEl = document.getElementById('explanationList');
const metricsTableBody = document.querySelector('#metricsTable tbody');
const resultStreamBody = document.querySelector('#resultStreamTable tbody');

const efficiencyScoreEl = document.getElementById('efficiencyScore');
const powerScoreEl = document.getElementById('powerScore');
const injuryRiskEl = document.getElementById('injuryRisk');
const consistencyScoreEl = document.getElementById('consistencyScore');

const bioForceEl = document.getElementById('bioForce');
const bioTorqueEl = document.getElementById('bioTorque');
const bioPowerEl = document.getElementById('bioPower');
const bioMomentumEl = document.getElementById('bioMomentum');
const bioBalanceEl = document.getElementById('bioBalance');
const bioStabilityEl = document.getElementById('bioStability');

const forceBar = document.getElementById('forceBar');
const torqueBar = document.getElementById('torqueBar');
const momentumBar = document.getElementById('momentumBar');

const replayInsightsBtn = document.getElementById('replayInsightsBtn');
const shareCardBtn = document.getElementById('shareCardBtn');

const coachModeToggle = document.getElementById('coachModeToggle');
const coachModePanel = document.getElementById('coachModePanel');
const rawDataPreview = document.getElementById('rawDataPreview');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');

const homePerfScore = document.getElementById('homePerfScore');
const homeConsistency = document.getElementById('homeConsistency');
const homeRisk = document.getElementById('homeRisk');
const recentSessionsEl = document.getElementById('recentSessions');
const historyListEl = document.getElementById('historyList');

const insBest = document.getElementById('insBest');
const insAvg = document.getElementById('insAvg');
const insTotal = document.getElementById('insTotal');

const kneeChartCtx = document.getElementById('kneeChart').getContext('2d');
const trunkChartCtx = document.getElementById('trunkChart').getContext('2d');

let detector = null;
let tfLib = null;
let poseDetectionLib = null;
let liveStream = null;
let liveRunning = false;
let liveFrames = [];
let livePoseTrail = [];
let uploadPoseTrail = [];
let liveTelemetry = [];
let liveStartTime = 0;
let lastLiveSample = 0;
let kneeChart = null;
let trunkChart = null;
let lastResult = null;
let liveConfidence = 0;
let idealGhostPose = null;
let lastJointStatus = null;

const sampleMs = 100;
const maxFrames = 350;

const SESSION_KEY = 'synapse_sessions';

const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]
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
  right_wrist: 10
};

function setStatus(text) {
  statusEl.textContent = `Status: ${text}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortDate(ts) {
  return new Date(ts).toLocaleString();
}

function haptic(ms = 20) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function switchScreen(name) {
  screens.forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  navButtons.forEach((b) => b.classList.toggle('active', b.dataset.screen === name));
}

function switchTab(name) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
}

function loadTheme() {
  const saved = localStorage.getItem('synapse_theme') || 'dark';
  appShell.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const next = appShell.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  appShell.setAttribute('data-theme', next);
  localStorage.setItem('synapse_theme', next);
}

function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSession(session) {
  const sessions = getSessions();
  sessions.unshift(session);
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.slice(0, 20)));
  renderHomeSummary();
  renderHistory();
  renderInsights();
}

function renderSessionsList(targetEl, sessions, emptyText) {
  targetEl.innerHTML = '';
  if (!sessions.length) {
    targetEl.innerHTML = `<div class="session-item">${emptyText}</div>`;
    return;
  }

  sessions.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'session-item';
    div.innerHTML = `
      <strong>${s.activity}</strong> • Score ${s.score}
      <small>${shortDate(s.created_at)} • Risk: ${s.risk} • Consistency: ${s.consistency}</small>
    `;
    targetEl.appendChild(div);
  });
}

function renderHomeSummary() {
  const sessions = getSessions();
  const latest = sessions[0];

  homePerfScore.textContent = latest ? `${latest.score}/100` : '--';
  homeConsistency.textContent = latest ? `${latest.consistency}/100` : '--';
  homeRisk.textContent = latest ? latest.risk : '--';

  renderSessionsList(recentSessionsEl, sessions.slice(0, 3), 'No sessions yet. Run your first analysis.');
}

function renderHistory() {
  renderSessionsList(historyListEl, getSessions(), 'History is empty.');
}

function renderInsights() {
  const sessions = getSessions();
  if (!sessions.length) {
    insBest.textContent = '--';
    insAvg.textContent = '--';
    insTotal.textContent = '0';
    return;
  }

  const scores = sessions.map((s) => s.score);
  const best = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  insBest.textContent = `${best.toFixed(1)}/100`;
  insAvg.textContent = `${avg.toFixed(1)}/100`;
  insTotal.textContent = String(scores.length);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensurePoseLibraries() {
  if (!window.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.19.0/dist/tf.min.js');
  if (!window.poseDetection) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');

  tfLib = window.tf || null;
  poseDetectionLib = window.poseDetection || null;
  if (!tfLib || !poseDetectionLib) {
    throw new Error('Failed to initialize TensorFlow pose libraries.');
  }
}

async function ensureDetector() {
  if (detector) return detector;
  setStatus('loading model');
  await ensurePoseLibraries();
  await tfLib.ready();
  detector = await poseDetectionLib.createDetector(
    poseDetectionLib.SupportedModels.MoveNet,
    {
      modelType: poseDetectionLib.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true
    }
  );
  setStatus('model ready');
  return detector;
}

function normalizeKeypoints(keypoints, width, height) {
  return keypoints.slice(0, 17).map((k) => ({
    x: Number((k.x / Math.max(width, 1)).toFixed(6)),
    y: Number((k.y / Math.max(height, 1)).toFixed(6)),
    score: Number((k.score ?? 0.0).toFixed(6))
  }));
}

function angleABC(a, b, c) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (magAB === 0 || magCB === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cos) * (180 / Math.PI);
}

function getJointAngle(pose, a, b, c) {
  if (!pose?.keypoints) return 180;
  return angleABC(
    pose.keypoints[KEYPOINT_INDEX[a]],
    pose.keypoints[KEYPOINT_INDEX[b]],
    pose.keypoints[KEYPOINT_INDEX[c]]
  );
}

function getStatusColor(status) {
  if (status === 'correct') return '#32f7a0';
  if (status === 'incorrect') return '#ff6b76';
  return '#1ec8ff';
}

function mapStatusToKeypoints(jointStatus) {
  const idxStatus = {};
  const apply = (indices, status) => indices.forEach((i) => { idxStatus[i] = status; });

  if (jointStatus.left_knee) apply([13, 15], jointStatus.left_knee);
  if (jointStatus.right_knee) apply([14, 16], jointStatus.right_knee);
  if (jointStatus.front_knee) apply([13, 15], jointStatus.front_knee);
  if (jointStatus.trunk) apply([5, 6, 11, 12], jointStatus.trunk);
  if (jointStatus.head) apply([0], jointStatus.head);
  return idxStatus;
}

function evaluateRealtime(pose, activity) {
  if (!pose?.keypoints || activity === 'auto') {
    return {
      status: { left_knee: 'neutral', right_knee: 'neutral', trunk: 'neutral', head: 'neutral' },
      kneeAngle: 0,
      hipAngle: 0,
      trunkAngle: 0,
      hipY: 0,
      hipX: 0,
      timing: 0,
      coach: 'Select activity for precision coaching.'
    };
  }

  const leftKnee = getJointAngle(pose, 'left_hip', 'left_knee', 'left_ankle');
  const rightKnee = getJointAngle(pose, 'right_hip', 'right_knee', 'right_ankle');
  const avgKnee = (leftKnee + rightKnee) / 2;
  const trunk = getJointAngle(pose, 'left_shoulder', 'left_hip', 'left_knee');
  const hipAngle = getJointAngle(pose, 'left_shoulder', 'left_hip', 'left_knee');
  const hipY = (pose.keypoints[11].y + pose.keypoints[12].y) / 2;
  const hipX = (pose.keypoints[11].x + pose.keypoints[12].x) / 2;
  const wristPath = Math.abs(pose.keypoints[9].x - pose.keypoints[10].x);

  if (activity === 'squat') {
    const kneeOk = avgKnee >= 70 && avgKnee <= 105;
    const trunkOk = trunk >= 145 && trunk <= 180;
    const symmetryOk = Math.abs(leftKnee - rightKnee) <= 12;
    const status = {
      left_knee: kneeOk && symmetryOk ? 'correct' : 'incorrect',
      right_knee: kneeOk && symmetryOk ? 'correct' : 'incorrect',
      trunk: trunkOk ? 'correct' : 'incorrect',
      head: 'neutral'
    };

    const offBy = kneeOk ? 0 : Math.round(Math.min(Math.abs(avgKnee - 70), Math.abs(avgKnee - 105)));
    const coach = kneeOk
      ? 'Great depth and alignment. Keep controlled tempo.'
      : `Knee angle off by ~${offBy}°. Drive knees out and brace core.`;

    return {
      status,
      kneeAngle: avgKnee,
      hipAngle,
      trunkAngle: trunk,
      hipY,
      hipX,
      path: wristPath,
      timing: 0,
      coach
    };
  }

  const frontKneeOk = leftKnee >= 110 && leftKnee <= 150;
  const trunkOk = trunk >= 145 && trunk <= 180;
  const status = {
    front_knee: frontKneeOk ? 'correct' : 'incorrect',
    trunk: trunkOk ? 'correct' : 'incorrect',
    head: 'neutral'
  };
  const offBy = frontKneeOk ? 0 : Math.round(Math.min(Math.abs(leftKnee - 110), Math.abs(leftKnee - 150)));
  const coach = frontKneeOk
    ? 'Front leg stable. Keep weight transfer smooth to impact.'
    : `Front-knee angle off by ~${offBy}°. Stabilize front-foot plant earlier.`;

  return {
    status,
    kneeAngle: leftKnee,
    hipAngle,
    trunkAngle: trunk,
    hipY,
    hipX,
    path: wristPath,
    timing: Math.round((Math.abs(hipX - 0.5) * 1200)),
    coach
  };
}

function drawSkeleton(ctx, pose, alpha, jointStatusMap, pulse) {
  ctx.save();
  ctx.globalAlpha = alpha;

  for (const [a, b] of EDGES) {
    const kp1 = pose.keypoints[a];
    const kp2 = pose.keypoints[b];
    if ((kp1.score ?? 0) <= 0.25 || (kp2.score ?? 0) <= 0.25) continue;

    const s1 = jointStatusMap[a] || 'neutral';
    const s2 = jointStatusMap[b] || 'neutral';
    const edgeStatus = s1 === 'incorrect' || s2 === 'incorrect' ? 'incorrect' : (s1 === 'correct' && s2 === 'correct' ? 'correct' : 'neutral');

    ctx.strokeStyle = getStatusColor(edgeStatus);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(kp1.x, kp1.y);
    ctx.lineTo(kp2.x, kp2.y);
    ctx.stroke();
  }

  for (let i = 0; i < 17; i += 1) {
    const kp = pose.keypoints[i];
    if ((kp.score ?? 0) <= 0.2) continue;
    const status = jointStatusMap[i] || 'neutral';
    const radius = status === 'incorrect' ? 4 + pulse : 4;
    ctx.fillStyle = getStatusColor(status);
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPose(ctx, canvas, video, pose, trail, jointStatus, ghostPose) {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(video, 0, 0, w, h);

  if (!pose?.keypoints) return;

  if (ghostPose?.keypoints) {
    drawSkeleton(ctx, ghostPose, 0.22, {}, 0);
  }

  for (let i = 0; i < trail.length; i += 1) {
    const t = trail[i];
    drawSkeleton(ctx, t, 0.08 + ((i + 1) / trail.length) * 0.18, {}, 0);
  }

  const pulse = (Math.sin(performance.now() / 220) + 1) * 1.4;
  drawSkeleton(ctx, pose, 1.0, mapStatusToKeypoints(jointStatus), pulse);
}

function updateLiveTelemetryTable() {
  liveStreamBody.innerHTML = '';
  liveTelemetry.slice(-14).reverse().forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.timestamp.toFixed(3)}</td>
      <td>${r.knee_angle.toFixed(1)}</td>
      <td>${r.hip_angle.toFixed(1)}</td>
      <td>${r.trunk_angle.toFixed(1)}</td>
      <td>${r.hip_velocity.toFixed(4)}</td>
      <td>${r.hip_acceleration.toFixed(4)}</td>
    `;
    liveStreamBody.appendChild(tr);
  });
}

function pushLiveTelemetry(sample) {
  const prev = liveTelemetry[liveTelemetry.length - 1];
  let vel = 0;
  let acc = 0;
  if (prev) {
    const dt = Math.max(sample.timestamp - prev.timestamp, 1e-6);
    vel = (sample.hip_y - prev.hip_y) / dt;
    acc = (vel - prev.hip_velocity) / dt;
  }

  liveTelemetry.push({
    timestamp: sample.timestamp,
    knee_angle: sample.knee_angle,
    hip_angle: sample.hip_angle,
    trunk_angle: sample.trunk_angle,
    hip_y: sample.hip_y,
    hip_velocity: vel,
    hip_acceleration: acc
  });

  if (liveTelemetry.length > maxFrames) liveTelemetry.shift();
  updateLiveTelemetryTable();
}

function updateLiveCoach(rt) {
  metricKnee.textContent = `${rt.kneeAngle.toFixed(1)}°`;
  metricHip.textContent = `${rt.hipAngle.toFixed(1)}°`;
  metricPath.textContent = `${(rt.path || 0).toFixed(3)}`;
  metricTiming.textContent = `${Math.round(rt.timing || 0)} ms`;
  metricBalance.textContent = `${(Math.abs(rt.hipX - 0.5) * 100).toFixed(1)}%`;
  liveFeedbackEl.textContent = rt.coach;

  const statuses = Object.values(rt.status);
  const correct = statuses.filter((s) => s === 'correct').length;
  const ratio = statuses.length ? correct / statuses.length : 0;
  liveConfidence = Math.max(0, Math.min(100, (liveConfidence * 0.75) + ratio * 100 * 0.25));
  confidenceBar.style.width = `${liveConfidence.toFixed(0)}%`;
  confidenceValue.textContent = `${liveConfidence.toFixed(0)}%`;

  if (ratio > 0.7 && liveConfidence > 75) {
    liveFeedbackEl.textContent = `${rt.coach} Excellent correction. Keep this pattern.`;
  }

  if (lastJointStatus) {
    const hadIncorrect = Object.values(lastJointStatus).some((s) => s === 'incorrect');
    const nowIncorrect = statuses.some((s) => s === 'incorrect');
    if (hadIncorrect && !nowIncorrect) {
      haptic(18);
      liveFeedbackEl.textContent = `${rt.coach} Great fix detected.`;
    }
  }

  lastJointStatus = rt.status;
}

function getCameraErrorHint(err) {
  const name = err?.name || 'UnknownError';
  const message = err?.message || 'No error message provided.';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return `Camera API unavailable (${name}). Use modern browser + localhost/HTTPS.`;
  }
  if (window.isSecureContext === false) {
    return `Insecure context (${name}). Open via http://localhost or https.`;
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `Camera permission denied (${name}). Enable camera for this site.`;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return `No camera found (${name}). Connect a device and retry.`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `Camera busy (${name}). Close other apps using camera.`;
  }

  return `Camera start failed (${name}): ${message}`;
}

async function openCameraStream() {
  const constraintSets = [
    { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false }
  ];

  let lastErr = null;
  for (const c of constraintSets) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Unable to access camera.');
}

async function startLiveCapture() {
  await ensureDetector();
  switchScreen('analyze');

  liveStream = await openCameraStream();
  liveVideo.srcObject = liveStream;
  await liveVideo.play();

  liveFrames = [];
  livePoseTrail = [];
  liveTelemetry = [];
  liveConfidence = 0;
  idealGhostPose = null;
  lastJointStatus = null;
  liveStartTime = performance.now();
  lastLiveSample = 0;
  liveRunning = true;
  setStatus('live capture running');

  while (liveRunning) {
    const poses = await detector.estimatePoses(liveVideo, { maxPoses: 1, flipHorizontal: false });
    const pose = poses[0];

    if (pose?.keypoints) {
      const rt = evaluateRealtime(pose, activitySelect.value);
      updateLiveCoach(rt);
      drawPose(liveCtx, liveCanvas, liveVideo, pose, livePoseTrail, rt.status, idealGhostPose);

      const statuses = Object.values(rt.status);
      if (!statuses.includes('incorrect') && !idealGhostPose) {
        idealGhostPose = { keypoints: pose.keypoints.map((k) => ({ ...k })) };
      }

      const now = performance.now();
      if (now - lastLiveSample >= sampleMs) {
        lastLiveSample = now;
        const timestamp = Number(((now - liveStartTime) / 1000).toFixed(3));

        if (liveFrames.length < maxFrames) {
          liveFrames.push({
            timestamp,
            keypoints: normalizeKeypoints(pose.keypoints, liveVideo.videoWidth, liveVideo.videoHeight)
          });
        }

        pushLiveTelemetry({
          timestamp,
          knee_angle: rt.kneeAngle,
          hip_angle: rt.hipAngle,
          trunk_angle: rt.trunkAngle,
          hip_y: rt.hipY
        });

        livePoseTrail.push({ keypoints: pose.keypoints.map((k) => ({ ...k })) });
        if (livePoseTrail.length > 14) livePoseTrail.shift();
      }
    }

    await sleep(16);
  }
}

function stopLiveCapture() {
  liveRunning = false;
  if (liveStream) {
    liveStream.getTracks().forEach((t) => t.stop());
    liveStream = null;
  }
  liveVideo.srcObject = null;
}

function riskLabel(score, balanceIndex) {
  if (score < 60 || balanceIndex > 0.06) return 'High';
  if (score < 80 || balanceIndex > 0.04) return 'Medium';
  return 'Low';
}

function consistencyFromTimeline(timeline) {
  const arr = timeline?.avg_knee || [];
  if (arr.length < 3) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((acc, v) => acc + ((v - mean) ** 2), 0) / arr.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, 100 - std));
}

async function analyzeFrames(frames) {
  if (!frames || frames.length < 10) {
    alert('Not enough frames captured. Capture at least a short full movement.');
    return;
  }

  setStatus('sending frames for analysis');
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity_hint: activitySelect.value, fps: 10, frames })
  });

  if (!res.ok) {
    setStatus('analysis failed');
    alert(`Analysis error: ${await res.text()}`);
    return;
  }

  const data = await res.json();
  lastResult = data;
  renderResult(data);

  const consistency = consistencyFromTimeline(data.timeline);
  const risk = riskLabel(data.overall_score, data.biomechanics?.balance_index || 0);
  saveSession({
    created_at: Date.now(),
    activity: data.activity,
    score: Number(data.overall_score),
    consistency: Number(consistency.toFixed(1)),
    risk
  });

  switchTab('overview');
  setStatus('analysis complete');
}

function renderResult(data) {
  detectedActivityEl.textContent = data.activity;
  overallScoreEl.textContent = `${data.overall_score}/100`;

  const consistency = consistencyFromTimeline(data.timeline);
  const injuryRisk = riskLabel(data.overall_score, data.biomechanics?.balance_index || 0);

  efficiencyScoreEl.textContent = `${Math.round(data.overall_score)}%`;
  powerScoreEl.textContent = `${Math.min(100, Math.round((data.biomechanics?.power_estimate_w || 0) / 40))}%`;
  injuryRiskEl.textContent = injuryRisk;
  consistencyScoreEl.textContent = `${Math.round(consistency)}%`;

  feedbackListEl.innerHTML = '';
  (data.feedback || []).forEach((f) => {
    const li = document.createElement('li');
    li.textContent = f;
    feedbackListEl.appendChild(li);
  });

  explanationListEl.innerHTML = '';
  (data.coaching_explanations || []).forEach((f) => {
    const li = document.createElement('li');
    li.textContent = f;
    explanationListEl.appendChild(li);
  });

  const bio = data.biomechanics || {};
  const force = Number(bio.force_estimate_n || 0);
  const torque = Number(bio.torque_estimate_nm || 0);
  const momentum = Number(bio.momentum_estimate || 0);
  const power = Number(bio.power_estimate_w || 0);

  bioForceEl.textContent = force ? force.toFixed(1) : '--';
  bioTorqueEl.textContent = torque ? torque.toFixed(1) : '--';
  bioPowerEl.textContent = power ? power.toFixed(1) : '--';
  bioMomentumEl.textContent = momentum ? momentum.toFixed(1) : '--';
  bioBalanceEl.textContent = bio.balance_index ?? '--';
  bioStabilityEl.textContent = bio.stability_score ?? '--';

  forceBar.style.width = `${Math.min(100, force / 14)}%`;
  torqueBar.style.width = `${Math.min(100, torque / 8)}%`;
  momentumBar.style.width = `${Math.min(100, momentum / 3)}%`;

  metricsTableBody.innerHTML = '';
  (data.metrics || []).forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.name}</td><td>${m.value}</td><td>${m.target_min} - ${m.target_max}</td><td>${m.deviation}</td><td>${m.score}</td>`;
    metricsTableBody.appendChild(tr);
  });

  resultStreamBody.innerHTML = '';
  (data.kinematics_stream || []).slice(-20).reverse().forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.timestamp}</td><td>${r.knee_angle}</td><td>${r.trunk_angle}</td><td>${r.hip_y}</td><td>${r.hip_velocity}</td><td>${r.hip_acceleration}</td>`;
    resultStreamBody.appendChild(tr);
  });

  rawDataPreview.textContent = JSON.stringify(data, null, 2);

  renderCharts(data.timeline);
}

function renderCharts(timeline) {
  const labels = (timeline?.avg_knee || []).map((_, i) => i + 1);

  if (kneeChart) kneeChart.destroy();
  kneeChart = new Chart(kneeChartCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Knee Angle', data: timeline.avg_knee || [], borderColor: '#1ec8ff', tension: 0.25 },
        { label: 'Hip Velocity', data: timeline.hip_velocity || [], borderColor: '#ab7bff', tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#d7e6f7' } } },
      scales: { x: { ticks: { color: '#93a6bf' } }, y: { ticks: { color: '#93a6bf' } } }
    }
  });

  if (trunkChart) trunkChart.destroy();
  trunkChart = new Chart(trunkChartCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Trunk Angle', data: timeline.trunk || [], borderColor: '#32f7a0', tension: 0.25 },
        { label: 'Hip Acceleration', data: timeline.hip_acceleration || [], borderColor: '#ff6b76', tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#d7e6f7' } } },
      scales: { x: { ticks: { color: '#93a6bf' } }, y: { ticks: { color: '#93a6bf' } } }
    }
  });
}

async function analyzeUploadedVideo() {
  await ensureDetector();

  if (!uploadVideo.src) {
    alert('Upload a video first.');
    return;
  }

  await uploadVideo.play();
  uploadVideo.muted = true;

  const frames = [];
  const start = performance.now();
  let lastSample = 0;
  uploadPoseTrail = [];

  setStatus('processing upload');

  while (!uploadVideo.ended) {
    const poses = await detector.estimatePoses(uploadVideo, { maxPoses: 1, flipHorizontal: false });
    const pose = poses[0];

    if (pose?.keypoints) {
      const rt = evaluateRealtime(pose, activitySelect.value);
      drawPose(uploadCtx, uploadCanvas, uploadVideo, pose, uploadPoseTrail, rt.status, null);

      const now = performance.now();
      if (now - lastSample >= sampleMs) {
        lastSample = now;
        const timestamp = Number(((now - start) / 1000).toFixed(3));
        if (frames.length < maxFrames) {
          frames.push({
            timestamp,
            keypoints: normalizeKeypoints(pose.keypoints, uploadVideo.videoWidth, uploadVideo.videoHeight)
          });
        }

        uploadPoseTrail.push({ keypoints: pose.keypoints.map((k) => ({ ...k })) });
        if (uploadPoseTrail.length > 12) uploadPoseTrail.shift();
      }
    }

    await sleep(16);
  }

  uploadVideo.pause();
  uploadVideo.currentTime = 0;
  await analyzeFrames(frames);
}

function exportJson() {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `synapse-analysis-${Date.now()}.json`;
  a.click();
}

function exportCsv() {
  if (!lastResult?.kinematics_stream?.length) return;
  const headers = ['timestamp', 'knee_angle', 'trunk_angle', 'hip_y', 'hip_velocity', 'hip_acceleration'];
  const lines = [headers.join(',')];
  lastResult.kinematics_stream.forEach((r) => {
    lines.push(headers.map((h) => r[h]).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `synapse-kinematics-${Date.now()}.csv`;
  a.click();
}

async function sharePerformanceCard() {
  if (!lastResult) {
    alert('Run analysis first.');
    return;
  }
  const text = `Synapse Motion Coach\nActivity: ${lastResult.activity}\nScore: ${lastResult.overall_score}/100\nStability: ${lastResult.biomechanics?.stability_score ?? '--'}/100`;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'My Motion Analysis', text });
      return;
    } catch {}
  }

  await navigator.clipboard.writeText(text);
  alert('Performance card copied to clipboard.');
}

function replayWithInsights() {
  if (!lastResult) {
    alert('Run analysis first.');
    return;
  }
  switchTab('motion');
  document.getElementById('tab-motion').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

metricsToggle.addEventListener('click', () => {
  metricsContent.classList.toggle('collapsed');
});

themeToggle.addEventListener('click', toggleTheme);
homeStartBtn.addEventListener('click', () => switchScreen('analyze'));
jumpLiveBtn.addEventListener('click', () => switchScreen('analyze'));
jumpUploadBtn.addEventListener('click', () => switchScreen('analyze'));

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

initBtn.addEventListener('click', async () => {
  try {
    await ensureDetector();
  } catch (err) {
    console.error(err);
    setStatus('model init failed');
    alert(`Model init failed: ${String(err?.message || err)}`);
  }
});

startLiveBtn.addEventListener('click', async () => {
  try {
    await startLiveCapture();
  } catch (err) {
    console.error(err);
    setStatus('live start failed');
    alert(getCameraErrorHint(err));
  }
});

stopLiveBtn.addEventListener('click', async () => {
  stopLiveCapture();
  await analyzeFrames(liveFrames);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  uploadVideo.src = URL.createObjectURL(file);
  setStatus(`loaded upload: ${file.name}`);
});

analyzeUploadBtn.addEventListener('click', async () => {
  try {
    await analyzeUploadedVideo();
  } catch (err) {
    console.error(err);
    setStatus('upload analysis failed');
    alert(`Upload analysis failed: ${String(err?.message || err)}`);
  }
});

coachModeToggle.addEventListener('change', () => {
  coachModePanel.classList.toggle('hidden', !coachModeToggle.checked);
});

exportJsonBtn.addEventListener('click', exportJson);
exportCsvBtn.addEventListener('click', exportCsv);
replayInsightsBtn.addEventListener('click', replayWithInsights);
shareCardBtn.addEventListener('click', sharePerformanceCard);

loadTheme();
renderHomeSummary();
renderHistory();
renderInsights();
switchScreen('home');
switchTab('overview');
