import { COLORS, SEVERITY_COLORS } from './constants';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function angleABC(a, b, c) {
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

export function scoreColor(score) {
  if (score >= 80) return COLORS.secondary;
  if (score >= 50) return "#f5c344";
  return COLORS.warn;
}

export function statusPill(status) {
  return status === "good"
    ? SEVERITY_COLORS.good
    : status === "warning"
      ? SEVERITY_COLORS.warning
      : status === "bad"
        ? SEVERITY_COLORS.bad
        : SEVERITY_COLORS.neutral;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function distanceToRange(value, lo, hi) {
  if (value < lo) return lo - value;
  if (value > hi) return value - hi;
  return 0;
}

export function gradeDeviation(deviation, goodThreshold, warningThreshold) {
  if (deviation <= goodThreshold) return { level: "good", score: 0 };
  if (deviation <= warningThreshold) return { level: "warning", score: 1 };
  return { level: "bad", score: 2 };
}

export function severityRank(level) {
  if (level === "bad") return 2;
  if (level === "warning") return 1;
  if (level === "good") return 0;
  return -1;
}

export function pickWorseSeverity(a, b) {
  return severityRank(a) >= severityRank(b) ? a : b;
}

export function inferLiveSquatPhase(kneeAngle, prevHipY, hipY) {
  if (kneeAngle >= 80 && kneeAngle <= 100) return "bottom";
  if (prevHipY == null) return "descent";
  const dy = hipY - prevHipY;
  if (dy > 0.002) return "descent";
  if (dy < -0.002) return "ascent";
  return "descent";
}

export function torsoLeanFromVertical(leftShoulder, rightShoulder, leftHip, rightHip) {
  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };
  const vx = shoulderMid.x - hipMid.x;
  const vy = shoulderMid.y - hipMid.y;
  const mag = Math.hypot(vx, vy) || 1e-6;
  const cos = clamp(-vy / mag, -1, 1);
  return Math.acos(cos) * (180 / Math.PI);
}

export function confidence(kp) {
  return kp?.score ?? 0;
}

export function clonePose(pose) {
  return {
    keypoints: pose.keypoints.map((k) => ({
      x: k.x,
      y: k.y,
      score: k.score ?? 0,
    })),
  };
}

export function stabilizePose(pose, prevPose = null) {
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

export function poseBounds(pose) {
  const pts = (pose?.keypoints || []).filter((kp) => confidence(kp) > 0.08);
  if (!pts.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export function fitPoseToCanvas(pose, width, height, padding = 28) {
  if (!pose?.keypoints) return pose;
  const b = poseBounds(pose);
  const spanX = Math.max(b.maxX - b.minX, 1e-6);
  const spanY = Math.max(b.maxY - b.minY, 1e-6);
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  const out = {
    keypoints: pose.keypoints.map((kp) => ({
      x: (kp.x - cx) * scale + width / 2,
      y: (kp.y - cy) * scale + height / 2,
      score: kp.score,
    })),
  };
  return out;
}

export function drawAnatomyCore(ctx, pose, alpha = 1) {
  const kp = pose.keypoints;
  const ls = kp[5],
    rs = kp[6],
    lh = kp[11],
    rh = kp[12],
    nose = kp[0];
  if (!ls || !rs || !lh || !rh || !nose) return;

  const neck = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const pelvis = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  const headR = clamp(shoulderW * 0.24, 7, 22);

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(160,190,220,0.14)";
  ctx.beginPath();
  ctx.moveTo(ls.x, ls.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.lineTo(rh.x, rh.y);
  ctx.lineTo(lh.x, lh.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(180,205,230,0.72)";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(neck.x, neck.y);
  ctx.lineTo(pelvis.x, pelvis.y);
  ctx.stroke();

  const headY = nose.y - headR * 0.35;
  ctx.strokeStyle = "rgba(195,220,245,0.88)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(nose.x, headY, headR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
