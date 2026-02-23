const { useEffect, useMemo, useRef, useState } = React;

const COLORS = {
  bg: '#0B0F14',
  card: '#121821',
  primary: '#00E5FF',
  secondary: '#00FF9D',
  warn: '#FF4D4F',
  txt: '#E6EDF3',
  subtxt: '#9BA3AF'
};

const NAV_ITEMS = [
  { key: 'home', icon: '⌂', label: 'Home' },
  { key: 'analyze', icon: '◉', label: 'Analyze' },
  { key: 'history', icon: '◷', label: 'History' },
  { key: 'insights', icon: '◍', label: 'Insights' },
  { key: 'profile', icon: '◎', label: 'Profile' }
];

const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9],
  [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]
];

const FULL_SKELETON_EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16]
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

const SEVERITY_COLORS = {
  good: '#00FF9D',
  warning: '#FFC857',
  bad: '#FF4D4F',
  neutral: 'rgba(180, 196, 215, 0.72)'
};

const ACTIVITY_OPTIONS = [
  { key: 'auto', label: 'Auto Detect' },
  { key: 'squat', label: 'Gym: Squat' },
  { key: 'pushup', label: 'Gym: Push-up' },
  { key: 'coverDrive', label: 'Cricket: Cover Drive' },
  { key: 'bowling', label: 'Cricket: Bowling' }
];

const ACTIVITY_BACKEND_HINT = {
  auto: 'auto',
  squat: 'squat',
  pushup: 'auto',
  coverDrive: 'cricket_cover_drive',
  bowling: 'auto'
};

const BOWLING_SPEED = {
  slow: { label: 'Slow', mps: 20, worldVz: 8.2, idealTime: 2.35, windowMs: 220 },
  medium: { label: 'Medium', mps: 30, worldVz: 11.6, idealTime: 1.72, windowMs: 180 },
  fast: { label: 'Fast', mps: 40, worldVz: 15.2, idealTime: 1.32, windowMs: 150 }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function angleABC(a, b, c) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (!magAB || !magCB) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cos) * (180 / Math.PI);
}

function scoreColor(score) {
  if (score >= 80) return COLORS.secondary;
  if (score >= 50) return '#f5c344';
  return COLORS.warn;
}

function statusPill(status) {
  return status === 'good' ? SEVERITY_COLORS.good : status === 'warning' ? SEVERITY_COLORS.warning : status === 'bad' ? SEVERITY_COLORS.bad : SEVERITY_COLORS.neutral;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function distanceToRange(value, lo, hi) {
  if (value < lo) return lo - value;
  if (value > hi) return value - hi;
  return 0;
}

function gradeDeviation(deviation, goodThreshold, warningThreshold) {
  if (deviation <= goodThreshold) return { level: 'good', score: 0 };
  if (deviation <= warningThreshold) return { level: 'warning', score: 1 };
  return { level: 'bad', score: 2 };
}

function severityRank(level) {
  if (level === 'bad') return 2;
  if (level === 'warning') return 1;
  if (level === 'good') return 0;
  return -1;
}

function pickWorseSeverity(a, b) {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function inferLiveSquatPhase(kneeAngle, prevHipY, hipY) {
  if (kneeAngle >= 80 && kneeAngle <= 100) return 'bottom';
  if (prevHipY == null) return 'descent';
  const dy = hipY - prevHipY;
  if (dy > 0.002) return 'descent';
  if (dy < -0.002) return 'ascent';
  return 'descent';
}

function torsoLeanFromVertical(leftShoulder, rightShoulder, leftHip, rightHip) {
  const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
  const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const vx = shoulderMid.x - hipMid.x;
  const vy = shoulderMid.y - hipMid.y;
  const mag = Math.hypot(vx, vy) || 1e-6;
  const cos = clamp((-vy) / mag, -1, 1);
  return Math.acos(cos) * (180 / Math.PI);
}

function confidence(kp) {
  return kp?.score ?? 0;
}

function clonePose(pose) {
  return {
    keypoints: pose.keypoints.map((k) => ({ x: k.x, y: k.y, score: k.score ?? 0 }))
  };
}

function stabilizePose(pose, prevPose = null) {
  if (!pose?.keypoints) return pose;
  const next = clonePose(pose);
  for (let i = 0; i < next.keypoints.length; i += 1) {
    const kp = next.keypoints[i];
    if (confidence(kp) >= 0.12) continue;
    if (prevPose?.keypoints?.[i] && confidence(prevPose.keypoints[i]) >= 0.12) {
      kp.x = prevPose.keypoints[i].x;
      kp.y = prevPose.keypoints[i].y;
      kp.score = prevPose.keypoints[i].score * 0.9;
    }
  }
  return next;
}

function poseBounds(pose) {
  const pts = (pose?.keypoints || []).filter((kp) => confidence(kp) > 0.08);
  if (!pts.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y))
  };
}

function fitPoseToCanvas(pose, width, height, padding = 28) {
  if (!pose?.keypoints) return pose;
  const b = poseBounds(pose);
  const spanX = Math.max(b.maxX - b.minX, 1e-6);
  const spanY = Math.max(b.maxY - b.minY, 1e-6);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  const out = {
    keypoints: pose.keypoints.map((kp) => ({
      x: (kp.x - cx) * scale + width / 2,
      y: (kp.y - cy) * scale + height / 2,
      score: kp.score
    }))
  };
  return out;
}

function drawAnatomyCore(ctx, pose, alpha = 1) {
  const kp = pose.keypoints;
  const ls = kp[5], rs = kp[6], lh = kp[11], rh = kp[12], nose = kp[0];
  if (!ls || !rs || !lh || !rh || !nose) return;

  const neck = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const pelvis = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  const headR = clamp(shoulderW * 0.24, 7, 22);

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = 'rgba(160,190,220,0.14)';
  ctx.beginPath();
  ctx.moveTo(ls.x, ls.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.lineTo(rh.x, rh.y);
  ctx.lineTo(lh.x, lh.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(180,205,230,0.72)';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(neck.x, neck.y);
  ctx.lineTo(pelvis.x, pelvis.y);
  ctx.stroke();

  const headY = nose.y - headR * 0.35;
  ctx.strokeStyle = 'rgba(195,220,245,0.88)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(nose.x, headY, headR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

const activityConfig = {
  squat: {
    keyJoints: [11, 12, 13, 14, 15, 16, 5, 6],
    detectPhases(frames) {
      const hipY = frames.map((f) => (f.keypoints[11].y + f.keypoints[12].y) / 2);
      const bottomIdx = hipY.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
      return {
        bottomIdx,
        phases: hipY.map((_, i) => {
          if (Math.abs(i - bottomIdx) <= 2) return 'bottom';
          if (i < bottomIdx) return 'descent';
          return 'ascent';
        })
      };
    },
    evaluateFrame(frame, context) {
      const kp = frame.keypoints;
      const leftHip = kp[11];
      const rightHip = kp[12];
      const leftKnee = kp[13];
      const rightKnee = kp[14];
      const leftAnkle = kp[15];
      const rightAnkle = kp[16];
      const leftShoulder = kp[5];
      const rightShoulder = kp[6];

      const leftKneeAngle = context.angleCache?.leftKneeAngle ?? angleABC(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = context.angleCache?.rightKneeAngle ?? angleABC(rightHip, rightKnee, rightAnkle);
      const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
      const torsoLean = context.angleCache?.torsoLean ?? torsoLeanFromVertical(leftShoulder, rightShoulder, leftHip, rightHip);

      const hipY = (leftHip.y + rightHip.y) / 2;
      const kneeY = (leftKnee.y + rightKnee.y) / 2;
      const hipDepthDeviation = Math.max(0, (kneeY - hipY) - 0.005);

      const hipWidth = Math.max(Math.abs(leftHip.x - rightHip.x), 1e-6);
      const leftMedial = Math.max(0, leftKnee.x - leftAnkle.x);
      const rightMedial = Math.max(0, rightAnkle.x - rightKnee.x);
      const kneeTrackDeviation = (leftMedial + rightMedial) / hipWidth;

      const baselineHeelY = context.baselineHeelY;
      const currentHeelY = (leftAnkle.y + rightAnkle.y) / 2;
      const heelLiftDeviation = Math.max(0, baselineHeelY - currentHeelY);

      const strict = context.phase === 'bottom';
      const kneeGrade = gradeDeviation(
        distanceToRange(avgKneeAngle, 80, 100),
        0,
        strict ? 6 : 10
      );
      const depthGrade = gradeDeviation(hipDepthDeviation, 0.005, strict ? 0.02 : 0.03);
      const torsoGrade = gradeDeviation(distanceToRange(torsoLean, 20, 45), 0, strict ? 8 : 12);
      const trackGrade = gradeDeviation(kneeTrackDeviation, 0.08, 0.16);
      const heelGrade = gradeDeviation(heelLiftDeviation, 0.01, 0.03);

      const jointSeverity = {};
      const apply = (jointIds, level) => {
        jointIds.forEach((id) => {
          jointSeverity[id] = jointSeverity[id] ? pickWorseSeverity(jointSeverity[id], level) : level;
        });
      };

      apply([13, 14], kneeGrade.level);
      apply([11, 12], depthGrade.level);
      apply([5, 6, 11, 12], torsoGrade.level);
      apply([13, 14, 15, 16], trackGrade.level);
      apply([15, 16], heelGrade.level);

      const reasons = [];
      if (kneeGrade.level !== 'good') reasons.push(`Knee angle ${avgKneeAngle.toFixed(1)}°`);
      if (depthGrade.level !== 'good') reasons.push('Hip depth insufficient');
      if (torsoGrade.level !== 'good') reasons.push(`Torso lean ${torsoLean.toFixed(1)}°`);
      if (trackGrade.level !== 'good') reasons.push('Knee tracking collapse');
      if (heelGrade.level === 'bad') reasons.push('Heel lift detected');

      return {
        metrics: {
          kneeAngle: avgKneeAngle,
          hipDepthDelta: hipY - kneeY,
          torsoLean,
          kneeTracking: kneeTrackDeviation,
          heelLift: heelLiftDeviation
        },
        checks: { kneeGrade, depthGrade, torsoGrade, trackGrade, heelGrade },
        jointSeverity,
        frameError: kneeGrade.score * 2.4 + depthGrade.score * 1.8 + torsoGrade.score * 1.4 + trackGrade.score * 1.5 + heelGrade.score * 0.8,
        reasons
      };
    }
  },
  pushup: {
    keyJoints: [5, 6, 7, 8, 11, 12, 13, 14],
    detectPhases(frames) {
      return { bottomIdx: 0, phases: frames.map(() => 'work') };
    },
    evaluateFrame(frame) {
      const elbow = angleABC(frame.keypoints[5], frame.keypoints[7], frame.keypoints[9]);
      const elbowGrade = gradeDeviation(distanceToRange(elbow, 70, 110), 0, 15);
      const jointSeverity = { 7: elbowGrade.level, 8: elbowGrade.level };
      return {
        metrics: { elbowAngle: elbow },
        checks: { elbowGrade },
        jointSeverity,
        frameError: elbowGrade.score * 2,
        reasons: elbowGrade.level === 'good' ? [] : [`Elbow angle ${elbow.toFixed(1)}°`]
      };
    }
  },
  coverDrive: {
    keyJoints: [11, 12, 13, 14, 5, 6, 9, 10],
    detectPhases(frames) {
      return { bottomIdx: 0, phases: frames.map(() => 'swing') };
    },
    evaluateFrame(frame) {
      const frontKnee = angleABC(frame.keypoints[11], frame.keypoints[13], frame.keypoints[15]);
      const kneeGrade = gradeDeviation(distanceToRange(frontKnee, 110, 150), 0, 15);
      const jointSeverity = { 13: kneeGrade.level, 15: kneeGrade.level };
      return {
        metrics: { frontKnee },
        checks: { kneeGrade },
        jointSeverity,
        frameError: kneeGrade.score * 2,
        reasons: kneeGrade.level === 'good' ? [] : [`Front knee ${frontKnee.toFixed(1)}°`]
      };
    }
  },
  bowling: {
    keyJoints: [5, 6, 7, 8, 11, 12, 13, 14],
    detectPhases(frames) {
      return { bottomIdx: 0, phases: frames.map(() => 'delivery') };
    },
    evaluateFrame(frame) {
      const trunk = torsoLeanFromVertical(frame.keypoints[5], frame.keypoints[6], frame.keypoints[11], frame.keypoints[12]);
      const trunkGrade = gradeDeviation(distanceToRange(trunk, 10, 40), 0, 12);
      const jointSeverity = { 5: trunkGrade.level, 6: trunkGrade.level, 11: trunkGrade.level, 12: trunkGrade.level };
      return {
        metrics: { trunkLean: trunk },
        checks: { trunkGrade },
        jointSeverity,
        frameError: trunkGrade.score * 2,
        reasons: trunkGrade.level === 'good' ? [] : [`Trunk lean ${trunk.toFixed(1)}°`]
      };
    }
  }
};

function getWorstFrame(activityData) {
  if (!activityData?.length) return 0;
  let worstIdx = 0;
  let worstScore = -Infinity;
  activityData.forEach((f, i) => {
    if (f.frameError > worstScore) {
      worstScore = f.frameError;
      worstIdx = i;
    }
  });
  return worstIdx;
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

async function ensureThreeLib() {
  if (window.THREE) return window.THREE;
  await loadScript('https://unpkg.com/three@0.161.0/build/three.min.js');
  if (!window.THREE) throw new Error('Three.js failed to load');
  return window.THREE;
}

function useCricketSimulation({ enabled, mountRef, swingRef }) {
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    ball: null,
    bowler: null,
    pitch: null,
    hitZone: null,
    rafId: null,
    resizeObserver: null
  });

  const stateRef = useRef({
    speedKey: 'medium',
    phase: 'IDLE',
    phaseStartedTs: 0,
    runupMs: 1200,
    releaseTs: 0,
    deliveryReady: true,
    ballActive: false,
    zoneEntered: false,
    startPos: { x: 0.0, y: 1.6, z: -10.8 },
    velocity: { x: 0.03, y: 0.7, z: BOWLING_SPEED.medium.worldVz },
    gravity: 8.9,
    timingWindowMs: BOWLING_SPEED.medium.windowMs,
    zoneEntryTs: 0,
    resultTs: 0,
    resultLabel: 'idle'
  });

  const [sceneReady, setSceneReady] = useState(false);
  const [speedKey, setSpeedKey] = useState('medium');
  const [deliveryCount, setDeliveryCount] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [stateLabel, setStateLabel] = useState('IDLE');
  const [result, setResult] = useState({ outcome: 'idle', reactionMs: null, timing: null, show: false });

  function setBowlerPhase(phase, nowTs) {
    const s = stateRef.current;
    s.phase = phase;
    s.phaseStartedTs = nowTs;
    setStateLabel(phase);
  }

  function resetForNextBall() {
    const s = stateRef.current;
    s.deliveryReady = true;
    s.ballActive = false;
    s.zoneEntered = false;
    s.zoneEntryTs = 0;
    s.releaseTs = 0;
    s.resultLabel = 'idle';
    setResult({ outcome: 'idle', reactionMs: null, timing: null, show: false });
    setBowlerPhase('IDLE', performance.now());
    if (threeRef.current.ball) {
      threeRef.current.ball.visible = false;
    }
    swingRef.current.lastSwingTs = 0;
    swingRef.current.lastTriggerTs = 0;
    swingRef.current.smoothVel = 0;
  }

  function registerOutcome(label, nowTs, timing = null) {
    const swingTs = swingRef.current.lastSwingTs || 0;
    const reactionMs = swingTs ? Math.max(0, Math.round(nowTs - swingTs)) : null;
    setResult({ outcome: label, reactionMs, timing, show: true });
    stateRef.current.resultTs = nowTs;
    stateRef.current.resultLabel = label;
    setDeliveryCount((v) => v + 1);
    if (label === 'PERFECT') setHitCount((v) => v + 1);
  }

  function disposeScene() {
    const t = threeRef.current;
    if (t.rafId) cancelAnimationFrame(t.rafId);
    t.rafId = null;
    if (t.resizeObserver) {
      t.resizeObserver.disconnect();
      t.resizeObserver = null;
    }
    if (t.renderer && mountRef.current && mountRef.current.contains(t.renderer.domElement)) {
      mountRef.current.removeChild(t.renderer.domElement);
    }
    if (t.renderer) t.renderer.dispose();
    threeRef.current = {
      scene: null,
      camera: null,
      renderer: null,
      ball: null,
      bowler: null,
      pitch: null,
      hitZone: null,
      rafId: null,
      resizeObserver: null
    };
    setSceneReady(false);
  }

  function queueDelivery() {
    if (!enabled || !threeRef.current.ball) return;
    const now = performance.now();
    const s = stateRef.current;
    if (!s.deliveryReady) return;

    s.deliveryReady = false;
    s.ballActive = false;
    s.zoneEntered = false;
    s.zoneEntryTs = 0;
    s.releaseTs = 0;
    setResult({ outcome: 'in_queue', reactionMs: null, timing: null, show: false });
    setBowlerPhase('RUNUP', now);
  }

  function spawnBall(nowTs) {
    const s = stateRef.current;
    const ball = threeRef.current.ball;
    if (!ball) return;
    const speed = BOWLING_SPEED[s.speedKey];

    s.ballActive = true;
    s.zoneEntered = false;
    s.zoneEntryTs = 0;
    s.releaseTs = nowTs;
    s.timingWindowMs = speed.windowMs;
    s.velocity = {
      x: (Math.random() - 0.5) * 0.32,
      y: 0.62 + Math.random() * 0.18,
      z: speed.worldVz
    };

    ball.visible = true;
    ball.position.set(s.startPos.x, s.startPos.y, s.startPos.z);
    setBowlerPhase('RELEASE', nowTs);
    setResult({ outcome: 'in_flight', reactionMs: null, timing: null, show: false });
  }

  useEffect(() => {
    stateRef.current.speedKey = speedKey;
  }, [speedKey]);

  useEffect(() => {
    if (!enabled) {
      disposeScene();
      return;
    }

    let cancelled = false;

    (async () => {
      const THREE = await ensureThreeLib();
      if (cancelled || !mountRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#060c14');

      const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 120);
      camera.position.set(0, 1.72, 2.05);
      camera.lookAt(0, 1.35, -8.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      mountRef.current.innerHTML = '';
      mountRef.current.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight(0x8cb7ff, 0.58);
      const keyLight = new THREE.DirectionalLight(0xa8e8ff, 0.95);
      keyLight.position.set(3, 7, 2);
      const fillLight = new THREE.DirectionalLight(0x44ffaa, 0.42);
      fillLight.position.set(-2, 4, -3);
      scene.add(ambient, keyLight, fillLight);

      const pitch = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 26),
        new THREE.MeshStandardMaterial({ color: 0x1d2a38, roughness: 0.78, metalness: 0.1 })
      );
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.set(0, 0, -7.1);
      scene.add(pitch);

      const crease = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xa9cfff })
      );
      crease.rotation.x = -Math.PI / 2;
      crease.position.set(0, 0.005, -0.05);
      scene.add(crease);

      const bowler = new THREE.Group();
      const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.92, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5f84a8, roughness: 0.72 })
      );
      torso.position.set(0, 0.95, 0);
      bowler.add(torso);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x7ea1c3, roughness: 0.7 })
      );
      head.position.set(0, 1.68, 0);
      bowler.add(head);
      bowler.position.set(0.2, 0, -11.5);
      scene.add(bowler);

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xff4d4f, emissive: 0x330000, roughness: 0.45, metalness: 0.08 })
      );
      ball.visible = false;
      scene.add(ball);

      const hitZone = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.3, 1.05),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.1 })
      );
      hitZone.position.set(0, 1.02, 0.35);
      scene.add(hitZone);

      const resize = () => {
        if (!mountRef.current || !renderer) return;
        const w = Math.max(320, mountRef.current.clientWidth);
        const h = Math.max(220, mountRef.current.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mountRef.current);

      threeRef.current = {
        scene,
        camera,
        renderer,
        ball,
        bowler,
        pitch,
        hitZone,
        rafId: null,
        resizeObserver: ro
      };
      setSceneReady(true);
      resetForNextBall();

      const loop = (ts) => {
        const t = threeRef.current;
        const s = stateRef.current;
        if (!t.renderer || !t.scene || !t.camera) return;

        if (t.bowler) {
          if (s.phase === 'IDLE') {
            t.bowler.position.z = -11.5;
            t.bowler.rotation.y = 0;
            t.bowler.rotation.z = 0;
          } else if (s.phase === 'RUNUP') {
            const p = clamp((ts - s.phaseStartedTs) / s.runupMs, 0, 1);
            t.bowler.position.z = -11.5 + p * 2.2;
            t.bowler.position.x = 0.2 + Math.sin(p * Math.PI * 2.3) * 0.08;
            t.bowler.rotation.z = Math.sin(p * Math.PI * 6) * 0.05;
            if (p >= 1) {
              spawnBall(ts);
            }
          } else if (s.phase === 'RELEASE') {
            t.bowler.rotation.z *= 0.85;
            if (ts - s.phaseStartedTs > 220) {
              setBowlerPhase('FOLLOW_THROUGH', ts);
            }
          } else if (s.phase === 'FOLLOW_THROUGH') {
            const p = clamp((ts - s.phaseStartedTs) / 520, 0, 1);
            t.bowler.position.z = -9.3 + p * 0.8;
            t.bowler.rotation.z = (1 - p) * 0.12;
            if (p >= 1) {
              setBowlerPhase('RESET', ts);
            }
          } else if (s.phase === 'RESET') {
            const p = clamp((ts - s.phaseStartedTs) / 450, 0, 1);
            t.bowler.position.z = -8.5 - p * 3.0;
            t.bowler.position.x = 0.2;
            if (p >= 1 && !s.ballActive) {
              setBowlerPhase('IDLE', ts);
              s.deliveryReady = true;
            }
          }
        }

        if (s.ballActive && t.ball) {
          const tSec = (ts - s.releaseTs) / 1000;
          const nx = s.startPos.x + s.velocity.x * tSec;
          const ny = s.startPos.y + s.velocity.y * tSec - 0.5 * s.gravity * tSec * tSec;
          const nz = s.startPos.z + s.velocity.z * tSec;
          t.ball.position.set(nx, ny, nz);

          const inZone = Math.abs(nx) <= 0.56 && ny >= 0.42 && ny <= 1.7 && nz >= -0.25 && nz <= 1.15;
          if (inZone && !s.zoneEntered) {
            s.zoneEntered = true;
            s.zoneEntryTs = ts;
          }

          if (s.zoneEntered) {
            const swingTs = swingRef.current.lastSwingTs || 0;
            if (swingTs > 0) {
              const delta = swingTs - s.zoneEntryTs;
              if (Math.abs(delta) <= s.timingWindowMs * 0.45) {
                s.ballActive = false;
                t.ball.visible = false;
                registerOutcome('PERFECT', ts, delta);
              } else if (delta < -s.timingWindowMs * 0.45 && delta >= -s.timingWindowMs * 1.6) {
                s.ballActive = false;
                t.ball.visible = false;
                registerOutcome('EARLY', ts, delta);
              } else if (delta > s.timingWindowMs * 0.45 && delta <= s.timingWindowMs * 1.6) {
                s.ballActive = false;
                t.ball.visible = false;
                registerOutcome('LATE', ts, delta);
              }
            }
          }

          if ((nz > 1.6 || ny < 0.1) && s.ballActive) {
            s.ballActive = false;
            t.ball.visible = false;
            registerOutcome('MISS', ts, null);
          }
        }

        if (result.show && ts - stateRef.current.resultTs > 1500) {
          setResult((prev) => ({ ...prev, show: false }));
        }

        t.renderer.render(t.scene, t.camera);
        t.rafId = requestAnimationFrame(loop);
      };

      threeRef.current.rafId = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      disposeScene();
    };
  }, [enabled, mountRef, swingRef]);

  return {
    sceneReady,
    speedKey,
    setSpeedKey,
    startDelivery: queueDelivery,
    result,
    deliveryCount,
    hitCount,
    bowlerState: stateLabel,
    canPlayNext: stateRef.current.deliveryReady,
    playNextBall: resetForNextBall
  };
}

function TinySparkline({ values = [], color = COLORS.primary }) {
  const width = 92;
  const height = 34;
  if (!values.length) {
    return <div className="h-8 w-24 rounded bg-white/5" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-6);
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - ((v - min) / span) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="rounded-lg bg-white/5">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircularScore({ score = 0 }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - progress / 100);
  const color = scoreColor(progress);

  return (
    <div className="flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-[0_0_22px_rgba(0,229,255,.15)]">
        <circle cx="70" cy="70" r={radius} stroke="rgba(255,255,255,.08)" strokeWidth="12" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset .55s ease' }}
        />
        <text x="70" y="66" textAnchor="middle" className="font-heading" fill={COLORS.subtxt} fontSize="12">Performance</text>
        <text x="70" y="87" textAnchor="middle" className="font-heading" fill={COLORS.txt} fontSize="28">{Math.round(progress)}</text>
      </svg>
    </div>
  );
}

function MetricsCard({ label, value, unit, status, sparkValues }) {
  return (
    <div className="card-hover soft-border rounded-2xl bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-subtxt">{label}</p>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusPill(status) }} />
      </div>
      <div className="mb-2 flex items-end gap-1">
        <strong className="font-heading text-2xl leading-none">{value}</strong>
        <span className="text-sm text-subtxt">{unit}</span>
      </div>
      <TinySparkline values={sparkValues} color={statusPill(status)} />
    </div>
  );
}

function FeedbackCard({ msg, severity }) {
  const icon = severity === 'high' ? '⚠' : severity === 'medium' ? '△' : '✓';
  const color = severity === 'high' ? COLORS.warn : severity === 'medium' ? '#f5c344' : COLORS.secondary;
  return (
    <div className="soft-border rounded-xl bg-card/90 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${color}22`, color }}>{icon}</span>
        <p className="text-sm leading-snug text-txt">{msg}</p>
      </div>
    </div>
  );
}

function SessionModal({ open, onClose, summary }) {
  if (!open || !summary) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-card p-5 shadow-card">
        <h3 className="font-heading text-xl">Session Summary</h3>
        <p className="mt-1 text-sm text-subtxt">{summary.activity} • {new Date(summary.createdAt).toLocaleString()}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="soft-border rounded-xl p-3"><p className="text-xs text-subtxt">Score</p><p className="font-heading text-xl">{summary.score}/100</p></div>
          <div className="soft-border rounded-xl p-3"><p className="text-xs text-subtxt">Risk</p><p className="font-heading text-xl">{summary.risk}</p></div>
          <div className="soft-border rounded-xl p-3"><p className="text-xs text-subtxt">Consistency</p><p className="font-heading text-xl">{summary.consistency}</p></div>
          <div className="soft-border rounded-xl p-3"><p className="text-xs text-subtxt">Power</p><p className="font-heading text-xl">{summary.power}</p></div>
        </div>
        <button className="btn-press mt-4 w-full rounded-xl bg-primary px-4 py-2 font-semibold text-black" onClick={onClose}>Continue</button>
      </div>
    </div>
  );
}

function App() {
  const [activeNav, setActiveNav] = useState('analyze');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activity, setActivity] = useState('auto');
  const [analysisMode, setAnalysisMode] = useState('standard');
  const [status, setStatus] = useState('idle');
  const [isLoading, setIsLoading] = useState(false);

  const [liveMetrics, setLiveMetrics] = useState({ knee: 0, hip: 0, back: 0, timing: 0, balance: 0, path: 0 });
  const [trend, setTrend] = useState({ knee: [], hip: [], back: [] });
  const [liveFeedback, setLiveFeedback] = useState('Ready when you are. Start live analysis to get coaching cues.');
  const [liveConfidence, setLiveConfidence] = useState(0);
  const [repCount, setRepCount] = useState(0);

  const [analysis, setAnalysis] = useState(null);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const [sessions, setSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('synapse_sessions') || '[]');
    } catch {
      return [];
    }
  });

  const [coachMode, setCoachMode] = useState(false);
  const [rawPreview, setRawPreview] = useState('');
  const [timelineMeta, setTimelineMeta] = useState({ total: 0, current: 0, worst: 0, phase: 'n/a', playing: false });

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
    lastTriggerTs: 0
  });

  const kneeChartRef = useRef(null);
  const trunkChartRef = useRef(null);
  const kneeChartInstRef = useRef(null);
  const trunkChartInstRef = useRef(null);

  const cricketModeEnabled = analysisMode === 'cricket';
  const {
    sceneReady: cricketSceneReady,
    speedKey: cricketSpeed,
    setSpeedKey: setCricketSpeed,
    startDelivery,
    result: cricketResult,
    deliveryCount,
    hitCount
  } = useCricketSimulation({
    enabled: cricketModeEnabled,
    mountRef: cricketSceneMountRef,
    swingRef
  });

  const homeSummary = useMemo(() => {
    if (!sessions.length) {
      return { performance: '--', consistency: '--', risk: '--' };
    }
    const latest = sessions[0];
    return {
      performance: `${latest.score}/100`,
      consistency: latest.consistency,
      risk: latest.risk
    };
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('synapse_sessions', JSON.stringify(sessions.slice(0, 20)));
  }, [sessions]);

  useEffect(() => {
    if (!analysis?.timeline) return;

    const labels = (analysis.timeline.avg_knee || []).map((_, i) => i + 1);

    if (kneeChartInstRef.current) kneeChartInstRef.current.destroy();
    if (trunkChartInstRef.current) trunkChartInstRef.current.destroy();

    if (kneeChartRef.current) {
      kneeChartInstRef.current = new Chart(kneeChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Knee Angle', data: analysis.timeline.avg_knee || [], borderColor: COLORS.primary, pointRadius: 0, tension: 0.28 },
            { label: 'Hip Velocity', data: analysis.timeline.hip_velocity || [], borderColor: COLORS.secondary, pointRadius: 0, tension: 0.28 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: COLORS.subtxt } } },
          scales: {
            x: { ticks: { color: COLORS.subtxt }, grid: { color: 'rgba(155,163,175,.14)' } },
            y: { ticks: { color: COLORS.subtxt }, grid: { color: 'rgba(155,163,175,.14)' } }
          }
        }
      });
    }

    if (trunkChartRef.current) {
      trunkChartInstRef.current = new Chart(trunkChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Back Angle', data: analysis.timeline.trunk || [], borderColor: '#88a9ff', pointRadius: 0, tension: 0.28 },
            { label: 'Hip Acceleration', data: analysis.timeline.hip_acceleration || [], borderColor: COLORS.warn, pointRadius: 0, tension: 0.28 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: COLORS.subtxt } } },
          scales: {
            x: { ticks: { color: COLORS.subtxt }, grid: { color: 'rgba(155,163,175,.14)' } },
            y: { ticks: { color: COLORS.subtxt }, grid: { color: 'rgba(155,163,175,.14)' } }
          }
        }
      });
    }

    return () => {
      if (kneeChartInstRef.current) kneeChartInstRef.current.destroy();
      if (trunkChartInstRef.current) trunkChartInstRef.current.destroy();
    };
  }, [analysis]);

  useEffect(() => () => {
    stopTimelinePlayback();
    liveRunningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  async function ensurePoseLibs() {
    if (!window.tf) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.19.0/dist/tf.min.js');
    }
    if (!window.poseDetection) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
    }
    tfRef.current = window.tf;
    poseRef.current = window.poseDetection;
    if (!tfRef.current || !poseRef.current) {
      throw new Error('Pose libraries failed to initialize.');
    }
  }

  async function ensureDetector() {
    if (detectorRef.current) return detectorRef.current;
    setStatus('loading model');
    await ensurePoseLibs();
    await tfRef.current.ready();
    detectorRef.current = await poseRef.current.createDetector(
      poseRef.current.SupportedModels.MoveNet,
      { modelType: poseRef.current.movenet.modelType.SINGLEPOSE_LIGHTNING, enableSmoothing: true }
    );
    setStatus('model ready');
    return detectorRef.current;
  }

  function normalizeKeypoints(kps, w, h) {
    return kps.slice(0, 17).map((k) => ({
      x: Number((k.x / Math.max(w, 1)).toFixed(6)),
      y: Number((k.y / Math.max(h, 1)).toFixed(6)),
      score: Number((k.score ?? 0).toFixed(6))
    }));
  }

  function getAngle(pose, a, b, c) {
    if (!pose?.keypoints) return 180;
    return angleABC(
      pose.keypoints[KEYPOINT_INDEX[a]],
      pose.keypoints[KEYPOINT_INDEX[b]],
      pose.keypoints[KEYPOINT_INDEX[c]]
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
        feedback: 'Keep full body visible for tracking.',
        phase: 'n/a',
        jointSeverity: {},
        status: { knee: 'neutral', hip: 'neutral', back: 'neutral' }
      };
    }

    const selectedActivity = activity === 'auto' ? 'squat' : activity;
    const cfg = activityConfig[selectedActivity] || activityConfig.squat;
    const kp = pose.keypoints;

    const hipY = (kp[11].y + kp[12].y) / 2;
    const phase = selectedActivity === 'squat'
      ? inferLiveSquatPhase(
        (getAngle(pose, 'left_hip', 'left_knee', 'left_ankle') + getAngle(pose, 'right_hip', 'right_knee', 'right_ankle')) / 2,
        lastRtRef.current?.hipY,
        hipY
      )
      : 'work';

    const baselineHeelY = lastRtRef.current?.baselineHeelY ?? ((kp[15].y + kp[16].y) / 2);
    const angleCache = {
      leftKneeAngle: angleABC(kp[11], kp[13], kp[15]),
      rightKneeAngle: angleABC(kp[12], kp[14], kp[16]),
      torsoLean: torsoLeanFromVertical(kp[5], kp[6], kp[11], kp[12])
    };
    const evaluated = cfg.evaluateFrame({ keypoints: kp }, { phase, baselineHeelY, angleCache });

    const leftKnee = getAngle(pose, 'left_hip', 'left_knee', 'left_ankle');
    const rightKnee = getAngle(pose, 'right_hip', 'right_knee', 'right_ankle');
    const knee = (leftKnee + rightKnee) / 2;
    const hip = getAngle(pose, 'left_shoulder', 'left_hip', 'left_knee');
    const back = torsoLeanFromVertical(kp[5], kp[6], kp[11], kp[12]);
    const hipX = (kp[11].x + kp[12].x) / 2;
    const path = Math.abs(kp[9].x - kp[10].x);
    const timing = Math.round(Math.abs(hipX - 0.5) * 1000);
    const balance = Number((Math.abs(hipX - 0.5) * 100).toFixed(1));

    let feedback = 'Movement detected. Maintain controlled tempo.';
    if (evaluated.reasons.length) {
      feedback = `Phase: ${phase}. ${evaluated.reasons[0]}.`;
    } else if (selectedActivity === 'squat') {
      feedback = 'Strong squat pattern. Keep depth and knee tracking consistent.';
    }

    const kneeStatus = pickWorseSeverity(evaluated.checks.kneeGrade?.level || 'neutral', evaluated.checks.trackGrade?.level || 'neutral');
    const hipStatus = evaluated.checks.depthGrade?.level || 'neutral';
    const backStatus = evaluated.checks.torsoGrade?.level || 'neutral';

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
      status: { knee: kneeStatus, hip: hipStatus, back: backStatus }
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

      const s1 = jointSeverityMap[a] || 'neutral';
      const s2 = jointSeverityMap[b] || 'neutral';
      const edgeSeverity = pickWorseSeverity(s1, s2);
      const edgeColor = statusPill(edgeSeverity);

      ctx.shadowBlur = edgeSeverity === 'bad' ? 12 : 0;
      ctx.shadowColor = edgeSeverity === 'bad' ? 'rgba(255,77,79,0.75)' : 'transparent';
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = edgeSeverity === 'bad' ? 3.4 : 2.8;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let i = 0; i < 17; i += 1) {
      const kp = pose.keypoints[i];
      if ((kp.score ?? 0) <= 0.08) continue;
      const st = jointSeverityMap[i] || 'neutral';
      const r = st === 'bad' ? 4 + pulse : 4;
      ctx.fillStyle = statusPill(st);
      ctx.shadowBlur = st === 'bad' ? 10 : 0;
      ctx.shadowColor = st === 'bad' ? 'rgba(255,77,79,0.7)' : 'transparent';
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (st === 'bad') {
        ctx.strokeStyle = 'rgba(255,77,79,0.38)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawPose(videoEl, canvasEl, pose, jointSeverity) {
    const ctx = canvasEl.getContext('2d');
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    canvasEl.width = w;
    canvasEl.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(videoEl, 0, 0, w, h);

    if (!pose?.keypoints) return;

    const stablePose = stabilizePose(pose, trailRef.current.length ? trailRef.current[trailRef.current.length - 1] : null);

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
    const baselineHeelY = frames.slice(0, Math.min(frames.length, 10))
      .reduce((acc, f) => acc + ((f.keypoints[15].y + f.keypoints[16].y) / 2), 0) / Math.min(frames.length, 10);

    const smoothed = frames.map((frame, i) => {
      if (i === 0) return frame;
      const prev = frames[i - 1];
      return {
        ...frame,
        keypoints: frame.keypoints.map((kp, idx) => ({
          ...kp,
          x: prev.keypoints[idx].x * 0.35 + kp.x * 0.65,
          y: prev.keypoints[idx].y * 0.35 + kp.y * 0.65
        }))
      };
    });

    const prepared = smoothed.map((frame, i) => {
      const phase = phaseData.phases[i] || 'work';
      const angleCache = {
        leftKneeAngle: angleABC(frame.keypoints[11], frame.keypoints[13], frame.keypoints[15]),
        rightKneeAngle: angleABC(frame.keypoints[12], frame.keypoints[14], frame.keypoints[16]),
        torsoLean: torsoLeanFromVertical(frame.keypoints[5], frame.keypoints[6], frame.keypoints[11], frame.keypoints[12])
      };
      const evalResult = cfg.evaluateFrame(frame, { phase, baselineHeelY, frameIndex: i, bottomIndex: phaseData.bottomIdx, angleCache });
      return {
        ...frame,
        phase,
        frameError: evalResult.frameError,
        jointSeverity: evalResult.jointSeverity,
        metrics: evalResult.metrics,
        reasons: evalResult.reasons
      };
    });

    return prepared;
  }

  function drawTimelineFrame(idx, shouldSetState = true) {
    const frames = timelineDataRef.current;
    const canvas = timelineCanvasRef.current;
    if (!frames.length || !canvas) return;
    const frame = frames[clamp(idx, 0, frames.length - 1)];
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#070d15';
    ctx.fillRect(0, 0, w, h);

    const rawPose = {
      keypoints: frame.keypoints.map((k) => ({
        x: k.x,
        y: k.y,
        score: k.score
      }))
    };

    const prevFrame = frames[Math.max(0, idx - 1)];
    const prevRawPose = prevFrame ? {
      keypoints: prevFrame.keypoints.map((k) => ({ x: k.x, y: k.y, score: k.score }))
    } : null;
    const stable = stabilizePose(rawPose, prevRawPose);
    const fitted = fitPoseToCanvas(stable, w, h, 26);

    drawSkeleton(ctx, fitted, 1, frame.jointSeverity, 0);

    ctx.fillStyle = 'rgba(230,237,243,0.9)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`t=${frame.timestamp.toFixed(2)}s`, 10, 18);
    ctx.fillText(`phase=${frame.phase}`, 10, 34);
    if (frame.reasons?.length) {
      ctx.fillStyle = 'rgba(255,200,87,0.95)';
      ctx.fillText(frame.reasons[0], 10, 50);
    }

    timelineFrameIdxRef.current = idx;
    if (timelineSliderRef.current) timelineSliderRef.current.value = String(idx);
    if (shouldSetState) {
      setTimelineMeta((prev) => ({ ...prev, current: idx, phase: frame.phase }));
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

      if (!timelineLastRenderTsRef.current) timelineLastRenderTsRef.current = ts;
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
      { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: 'environment' }, audio: false },
      { video: true, audio: false }
    ];

    let lastErr = null;
    for (const c of constraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Could not access camera.');
  }

  function updateTrends(rt) {
    setTrend((prev) => {
      const push = (arr, v) => [...arr.slice(-24), Number(v.toFixed(2))];
      return {
        knee: push(prev.knee, rt.knee),
        hip: push(prev.hip, rt.hip),
        back: push(prev.back, rt.back)
      };
    });
  }

  function updateConfidence(statusObj) {
    const vals = Object.values(statusObj);
    const ratio = vals.length
      ? vals.reduce((acc, v) => acc + (v === 'good' ? 1 : v === 'warning' ? 0.5 : 0), 0) / vals.length
      : 0;
    setLiveConfidence((prev) => {
      const next = Math.max(0, Math.min(100, prev * 0.75 + ratio * 100 * 0.25));
      return next;
    });
  }

  function updateRepCounter(knee) {
    if (activity !== 'squat') return;
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
      setStatus('live running');
      liveRunningRef.current = true;

      while (liveRunningRef.current) {
        const poses = await detectorRef.current.estimatePoses(videoEl, { maxPoses: 1, flipHorizontal: false });
        const pose = poses[0];

        if (pose?.keypoints) {
          const rt = evaluateRealtime(pose);
          drawPose(videoEl, canvasEl, pose, rt.jointSeverity);

          const statusVals = Object.values(rt.status);
          if (!statusVals.includes('bad') && !idealGhostRef.current) {
            idealGhostRef.current = { keypoints: pose.keypoints.map((k) => ({ ...k })) };
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
              path: rt.path
            });
            setLiveFeedback(rt.feedback);

            if (framesRef.current.length < 350) {
              framesRef.current.push({
                timestamp: Number(((now - startTsRef.current) / 1000).toFixed(3)),
                keypoints: normalizeKeypoints(pose.keypoints, videoEl.videoWidth, videoEl.videoHeight)
              });
            }

            trailRef.current.push(stabilizePose({ keypoints: pose.keypoints.map((k) => ({ ...k })) }, trailRef.current.length ? trailRef.current[trailRef.current.length - 1] : null));
            if (trailRef.current.length > 14) trailRef.current.shift();
          }

          lastRtRef.current = rt;
        }

        await sleep(16);
      }
    } catch (err) {
      setStatus('live start failed');
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
    if (score < 60 || balance > 0.06) return 'High';
    if (score < 80 || balance > 0.04) return 'Medium';
    return 'Low';
  }

  function deriveConsistency(timeline = {}) {
    const arr = timeline.avg_knee || [];
    if (arr.length < 3) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((acc, v) => acc + ((v - mean) ** 2), 0) / arr.length;
    const std = Math.sqrt(variance);
    return Math.max(0, Math.min(100, 100 - std));
  }

  function buildFeedbackCards(result) {
    const cards = [];
    (result.feedback || []).forEach((f) => {
      const low = f.toLowerCase();
      let severity = 'low';
      if (low.includes('off') || low.includes('late') || low.includes('deviat')) severity = 'high';
      else if (low.includes('adjust') || low.includes('focus')) severity = 'medium';
      cards.push({ msg: f, severity });
    });

    (result.coaching_explanations || []).forEach((f) => cards.push({ msg: f, severity: 'medium' }));
    if (cricketModeEnabled) {
      cards.unshift({
        msg: cricketResult.outcome === 'HIT'
          ? `Cricket delivery result: HIT${cricketResult.reactionMs != null ? ` • Reaction ${cricketResult.reactionMs} ms` : ''}.`
          : cricketResult.outcome === 'MISS'
            ? 'Cricket delivery result: MISS. Swing earlier as ball enters the hitting zone.'
            : 'Cricket mode active: release a ball and swing through the zone to register HIT.',
        severity: cricketResult.outcome === 'HIT' ? 'low' : cricketResult.outcome === 'MISS' ? 'high' : 'medium'
      });
    }
    return cards.slice(0, 6);
  }

  async function analyzeFrames(frames) {
    if (!frames || frames.length < 10) {
      alert('Capture longer movement before analysis.');
      return;
    }

    setIsLoading(true);
    setStatus('analyzing');

    try {
      const backendHint = ACTIVITY_BACKEND_HINT[activity] || 'auto';
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_hint: backendHint, fps: 10, frames })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setAnalysis(data);
      setRawPreview(JSON.stringify(data, null, 2));
      setStatus('analysis complete');

      const resolvedActivity = activity === 'auto'
        ? (data.activity === 'cricket_cover_drive' ? 'coverDrive' : 'squat')
        : activity;
      const preparedFrames = preprocessActivityFrames(frames, resolvedActivity);
      timelineDataRef.current = preparedFrames;
      const worstIdx = getWorstFrame(preparedFrames);
      const worstFrameReason = preparedFrames[worstIdx]?.reasons?.[0];
      const cards = buildFeedbackCards(data);
      if (worstFrameReason) {
        cards.unshift({ msg: `Worst frame at ${preparedFrames[worstIdx].timestamp.toFixed(2)}s: ${worstFrameReason}`, severity: 'high' });
      }
      setFeedbackItems(cards.slice(0, 6));
      setTimelineMeta({
        total: preparedFrames.length,
        current: worstIdx,
        worst: worstIdx,
        phase: preparedFrames[worstIdx]?.phase || 'n/a',
        playing: false
      });
      if (timelineSliderRef.current) {
        timelineSliderRef.current.max = String(Math.max(0, preparedFrames.length - 1));
        timelineSliderRef.current.value = String(worstIdx);
      }
      drawTimelineFrame(worstIdx);

      const consistency = deriveConsistency(data.timeline);
      const risk = deriveRisk(data.overall_score, data.biomechanics?.balance_index || 0);
      const session = {
        createdAt: Date.now(),
        activity: data.activity,
        score: Number(data.overall_score.toFixed(1)),
        consistency: Number(consistency.toFixed(1)),
        risk,
        power: Number((data.biomechanics?.power_estimate_w || 0).toFixed(0))
      };
      setSessions((prev) => [session, ...prev].slice(0, 20));

      setSummaryData(session);
      setShowSummary(true);
    } catch (err) {
      setStatus('analysis failed');
      alert(String(err?.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeUploadedVideo() {
    const videoEl = uploadVideoRef.current;
    const canvasEl = uploadCanvasRef.current;
    if (!videoEl?.src) {
      alert('Upload a video first.');
      return;
    }

    await ensureDetector();
    await videoEl.play();
    videoEl.muted = true;

    const frames = [];
    let lastSample = 0;
    const start = performance.now();
    trailRef.current = [];

    setStatus('processing upload');

    while (!videoEl.ended) {
      const poses = await detectorRef.current.estimatePoses(videoEl, { maxPoses: 1, flipHorizontal: false });
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
              keypoints: normalizeKeypoints(pose.keypoints, videoEl.videoWidth, videoEl.videoHeight)
            });
          }
          trailRef.current.push({ keypoints: pose.keypoints.map((k) => ({ ...k })) });
          if (trailRef.current.length > 14) trailRef.current.shift();
        }
      }
      await sleep(16);
    }

    videoEl.pause();
    videoEl.currentTime = 0;
    await analyzeFrames(frames);
  }

  function exportJSON() {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `synapse-analysis-${Date.now()}.json`;
    a.click();
  }

  function exportCSV() {
    if (!analysis?.kinematics_stream?.length) return;
    const headers = ['timestamp', 'knee_angle', 'trunk_angle', 'hip_y', 'hip_velocity', 'hip_acceleration'];
    const rows = analysis.kinematics_stream.map((row) => headers.map((h) => row[h]).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `synapse-kinematics-${Date.now()}.csv`;
    a.click();
  }

  const avgScore = useMemo(() => {
    if (!sessions.length) return 0;
    return sessions.reduce((a, b) => a + b.score, 0) / sessions.length;
  }, [sessions]);

  const sidebarClass = sidebarCollapsed ? 'w-20' : 'w-64';

  const metricStatus = {
    knee: gradeDeviation(distanceToRange(liveMetrics.knee, 80, 100), 0, 10).level,
    hip: gradeDeviation(distanceToRange(liveMetrics.hip, 20, 45), 0, 12).level,
    back: gradeDeviation(distanceToRange(liveMetrics.back, 20, 45), 0, 12).level
  };

  return (
    <div className="bg-grid min-h-screen">
      <SessionModal open={showSummary} onClose={() => setShowSummary(false)} summary={summaryData} />

      <header className="glass-nav sticky top-0 z-40 border-b border-white/10">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-primary">Synapse Sports Tech</p>
            <h1 className="font-heading text-xl">AI Motion Analysis Platform</h1>
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
              {sidebarCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 p-4 lg:grid-cols-[auto_1fr_380px] lg:p-6">
        <aside className={`${sidebarClass} rounded-2xl border border-white/10 bg-card p-3 transition-all duration-300`}>
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`sidebar-item btn-press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active ? 'border border-primary/55 bg-primary/10 text-txt' : 'border border-transparent text-subtxt'}`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="space-y-4">
          {activeNav === 'home' && (
            <>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <p className="text-xs uppercase tracking-wide text-primary">Welcome Back</p>
                <h2 className="mt-1 font-heading text-2xl">Sports Motion Command Center</h2>
                <p className="mt-1 text-sm text-subtxt">Start a live session, upload a clip, or review past biomechanics trends.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-press rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-black" onClick={() => setActiveNav('analyze')}>Start Analysis</button>
                  <button className="btn-press rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black" onClick={() => setActiveNav('history')}>View History</button>
                </div>
              </section>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <h3 className="font-heading text-lg">Recent Sessions</h3>
                <div className="mt-3 grid gap-2">
                  {sessions.slice(0, 6).map((s, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-bg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s.activity}</span>
                        <span className="text-subtxt">{new Date(s.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-subtxt">
                        <span>Score {s.score}/100</span>
                        <span>Risk {s.risk}</span>
                      </div>
                    </div>
                  ))}
                  {!sessions.length && <p className="text-sm text-subtxt">No sessions yet. Run your first analysis.</p>}
                </div>
              </section>
            </>
          )}

          {activeNav === 'history' && (
            <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-xl">Session History</h2>
                <span className="text-sm text-subtxt">{sessions.length} sessions</span>
              </div>
              <div className="space-y-2">
                {sessions.map((s, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-bg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <strong>{s.activity}</strong>
                      <span className="text-subtxt">{new Date(s.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg border border-white/10 bg-card p-2"><p className="text-subtxt">Score</p><p>{s.score}/100</p></div>
                      <div className="rounded-lg border border-white/10 bg-card p-2"><p className="text-subtxt">Consistency</p><p>{s.consistency}</p></div>
                      <div className="rounded-lg border border-white/10 bg-card p-2"><p className="text-subtxt">Risk</p><p>{s.risk}</p></div>
                      <div className="rounded-lg border border-white/10 bg-card p-2"><p className="text-subtxt">Power</p><p>{s.power}</p></div>
                    </div>
                  </div>
                ))}
                {!sessions.length && <p className="text-sm text-subtxt">No history available yet.</p>}
              </div>
            </section>
          )}

          {activeNav === 'insights' && (
            <>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <h2 className="font-heading text-xl">Performance Insights</h2>
                <p className="mt-1 text-sm text-subtxt">Use these trends to prioritize technique work.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-bg p-3"><p className="text-xs text-subtxt">Best Score</p><p className="font-heading text-2xl">{sessions.length ? Math.max(...sessions.map((s) => s.score)).toFixed(1) : '--'}</p></div>
                  <div className="rounded-xl border border-white/10 bg-bg p-3"><p className="text-xs text-subtxt">Avg Score</p><p className="font-heading text-2xl">{sessions.length ? avgScore.toFixed(1) : '--'}</p></div>
                  <div className="rounded-xl border border-white/10 bg-bg p-3"><p className="text-xs text-subtxt">Total Sessions</p><p className="font-heading text-2xl">{sessions.length}</p></div>
                </div>
              </section>
              <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
                <h3 className="font-heading text-lg">Technique Trend</h3>
                <p className="mt-1 text-sm text-subtxt">Recent sessions with risk and consistency overview.</p>
                <div className="mt-3 space-y-2">
                  {sessions.slice(0, 8).map((s, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-bg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>{s.activity}</span>
                        <span className="text-subtxt">{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-subtxt">
                        <span>Consistency {s.consistency}</span>
                        <span>Risk {s.risk}</span>
                      </div>
                    </div>
                  ))}
                  {!sessions.length && <p className="text-sm text-subtxt">Run sessions to unlock insight trends.</p>}
                </div>
              </section>
            </>
          )}

          {activeNav === 'profile' && (
            <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
              <h2 className="font-heading text-xl">Athlete Profile</h2>
              <p className="mt-1 text-sm text-subtxt">Manage athlete preferences and coaching mode setup.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Coaching Style</p>
                  <p className="mt-1">Technical + Encouraging</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Preferred Activity</p>
                  <p className="mt-1">{ACTIVITY_OPTIONS.find((x) => x.key === activity)?.label || 'Auto Detect'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Coach Mode</p>
                  <p className="mt-1">{coachMode ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-bg p-3">
                  <p className="text-xs text-subtxt">Sessions Logged</p>
                  <p className="mt-1">{sessions.length}</p>
                </div>
              </div>
            </section>
          )}

          {activeNav === 'analyze' && (
            <>
          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-xl">Live Analysis</h2>
                <p className="text-sm text-subtxt">Real-time skeletal tracking and biomechanics coaching</p>
              </div>
              <div className="flex items-center gap-2">
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
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <button className="btn-press rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-black" onClick={ensureDetector}>Init Model</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_310px]">
              <div className="neon-border relative overflow-hidden rounded-2xl bg-black">
                <video ref={liveVideoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
                <canvas ref={liveCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded-full bg-primary/85 px-3 py-1 text-xs font-semibold text-black">
                    {(ACTIVITY_OPTIONS.find((x) => x.key === activity)?.label || activity).replace('Gym: ', '').replace('Cricket: ', '')}
                  </span>
                  <span className="rounded-full bg-card/80 px-3 py-1 text-xs text-subtxt">Rep {repCount}</span>
                </div>

                <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-xs text-subtxt">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-secondary" />
                  Live
                </div>

                <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/15 bg-card/80 p-3 backdrop-blur">
                  <p className="mb-2 text-xs uppercase tracking-wide text-primary">AI Coach</p>
                  <p className="text-sm leading-snug">{liveFeedback}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-warn via-yellow-400 to-secondary transition-all duration-300"
                        style={{ width: `${liveConfidence}%` }}
                      />
                    </div>
                    <span className="text-xs text-subtxt">{Math.round(liveConfidence)}%</span>
                  </div>
                </div>
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
                    <MetricsCard label="Knee Angle" value={liveMetrics.knee.toFixed(1)} unit="deg" status={metricStatus.knee} sparkValues={trend.knee} />
                    <MetricsCard label="Hip Angle" value={liveMetrics.hip.toFixed(1)} unit="deg" status={metricStatus.hip} sparkValues={trend.hip} />
                    <MetricsCard label="Back Angle" value={liveMetrics.back.toFixed(1)} unit="deg" status={metricStatus.back} sparkValues={trend.back} />
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-press rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-black" onClick={startLiveCapture}>Start Live</button>
                  <button className="btn-press rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-black" onClick={() => { stopLiveCapture(); analyzeFrames(framesRef.current); }}>Stop + Analyze</button>
                </div>

                {cricketModeEnabled && (
                  <div className="rounded-2xl border border-primary/25 bg-bg p-3 text-xs text-subtxt">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-primary">Cricket Simulation Controls</p>
                    <div className="mb-2 flex items-center gap-2">
                      <select
                        value={cricketSpeed}
                        onChange={(e) => setCricketSpeed(e.target.value)}
                        className="flex-1 rounded-lg border border-white/15 bg-card px-2 py-1.5 text-xs text-txt"
                      >
                        {Object.entries(BOWLING_SPEED).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      <button
                        className="btn-press rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-black"
                        onClick={startDelivery}
                        disabled={!cricketSceneReady}
                      >
                        Release Ball
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-white/10 bg-card p-2"><p className="text-[10px] text-subtxt">Deliveries</p><p className="text-txt">{deliveryCount}</p></div>
                      <div className="rounded-lg border border-white/10 bg-card p-2"><p className="text-[10px] text-subtxt">Hits</p><p className="text-txt">{hitCount}</p></div>
                      <div className="rounded-lg border border-white/10 bg-card p-2">
                        <p className="text-[10px] text-subtxt">Result</p>
                        <p className={cricketResult.outcome === 'HIT' ? 'text-secondary' : cricketResult.outcome === 'MISS' ? 'text-warn' : 'text-txt'}>
                          {cricketResult.outcome === 'in_flight' ? 'Ball In Flight' : cricketResult.outcome.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-bg p-3 text-xs text-subtxt">
                  <div className="mb-1 flex justify-between"><span>Timing Offset</span><strong className="text-txt">{liveMetrics.timing} ms</strong></div>
                  <div className="mb-1 flex justify-between"><span>Path Width</span><strong className="text-txt">{liveMetrics.path.toFixed(3)}</strong></div>
                  <div className="flex justify-between"><span>Balance Drift</span><strong className="text-txt">{liveMetrics.balance}%</strong></div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg">Upload Video Analysis</h3>
              <button className="btn-press rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-subtxt" onClick={() => fileInputRef.current?.click()}>Choose Video</button>
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              uploadVideoRef.current.src = URL.createObjectURL(f);
              setStatus(`loaded: ${f.name}`);
            }} />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video ref={uploadVideoRef} controls playsInline muted className="aspect-video w-full object-cover" />
              <canvas ref={uploadCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            </div>
            <button className="btn-press mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black" onClick={analyzeUploadedVideo}>Analyze Upload</button>
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

            {cricketModeEnabled && (
              <div className="mt-4 rounded-2xl border border-primary/30 bg-bg p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-heading text-sm">Cricket Simulation Scene</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${cricketSceneReady ? 'bg-secondary' : 'bg-warn'}`} />
                    <span className="text-subtxt">{cricketSceneReady ? 'Scene Ready' : 'Loading Scene'}</span>
                    {cricketResult.reactionMs != null && (
                      <>
                        <span className="text-subtxt">•</span>
                        <span className="text-subtxt">Reaction {cricketResult.reactionMs} ms</span>
                      </>
                    )}
                  </div>
                </div>
                <div ref={cricketSceneMountRef} className="h-[260px] w-full overflow-hidden rounded-xl border border-white/10 bg-black" />
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-bg p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-heading text-sm">Skeleton Time-Lapse (Activity-Aware)</h4>
                <div className="flex items-center gap-2 text-xs text-subtxt">
                  <span>Frame {timelineMeta.current + 1}/{Math.max(1, timelineMeta.total)}</span>
                  <span>•</span>
                  <span>Phase: {timelineMeta.phase}</span>
                  <span>•</span>
                  <span className="text-warn">Worst: #{timelineMeta.worst + 1}</span>
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
                  {timelineMeta.playing ? 'Pause' : 'Play'}
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
              <div className="rounded-xl border border-white/10 bg-bg p-2"><p>Activity</p><strong className="text-sm text-txt">{analysis?.activity || '--'}</strong></div>
              <div className="rounded-xl border border-white/10 bg-bg p-2"><p>Status</p><strong className="text-sm text-txt">{status}</strong></div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg">AI Coaching</h3>
              <span className="rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">Prioritized</span>
            </div>
            <div className="space-y-2">
              {(feedbackItems.length ? feedbackItems : [{ msg: 'Run an analysis to get personalized feedback.', severity: 'low' }]).map((f, i) => (
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
              >Open Session Summary</button>
              <button className="btn-press w-full rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-subtxt" onClick={exportJSON} disabled={!analysis}>Export JSON</button>
              <button className="btn-press w-full rounded-xl border border-white/15 bg-bg px-3 py-2 text-sm text-subtxt" onClick={exportCSV} disabled={!analysis}>Export CSV</button>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-subtxt">
              <input type="checkbox" checked={coachMode} onChange={(e) => setCoachMode(e.target.checked)} />
              Coach Mode (advanced)
            </label>
            {coachMode && (
              <pre className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-bg p-3 text-[11px] text-primary">{rawPreview || '{}'}</pre>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
            <h3 className="font-heading text-lg">Session Snapshot</h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-white/10 bg-bg p-2"><p className="text-[11px] text-subtxt">Perf.</p><strong>{homeSummary.performance}</strong></div>
              <div className="rounded-xl border border-white/10 bg-bg p-2"><p className="text-[11px] text-subtxt">Consist.</p><strong>{homeSummary.consistency}</strong></div>
              <div className="rounded-xl border border-white/10 bg-bg p-2"><p className="text-[11px] text-subtxt">Risk</p><strong>{homeSummary.risk}</strong></div>
            </div>
            <div className="mt-3 space-y-2">
              {sessions.slice(0, 4).map((s, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-bg p-2 text-xs">
                  <div className="flex items-center justify-between text-subtxt"><span>{s.activity}</span><span>{new Date(s.createdAt).toLocaleDateString()}</span></div>
                  <div className="mt-1 flex items-center justify-between"><strong>{s.score}/100</strong><span className="text-subtxt">Risk: {s.risk}</span></div>
                </div>
              ))}
              {!sessions.length && <p className="text-xs text-subtxt">No sessions yet.</p>}
            </div>
          </section>

          {activeNav === 'insights' && (
            <section className="rounded-2xl border border-white/10 bg-card p-4 card-hover">
              <h3 className="font-heading text-lg">Insights</h3>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-bg p-2"><p className="text-[11px] text-subtxt">Best</p><strong>{sessions.length ? Math.max(...sessions.map((s) => s.score)).toFixed(1) : '--'}</strong></div>
                <div className="rounded-xl border border-white/10 bg-bg p-2"><p className="text-[11px] text-subtxt">Avg</p><strong>{sessions.length ? avgScore.toFixed(1) : '--'}</strong></div>
                <div className="rounded-xl border border-white/10 bg-bg p-2"><p className="text-[11px] text-subtxt">Total</p><strong>{sessions.length}</strong></div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
