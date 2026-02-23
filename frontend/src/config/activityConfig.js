import { angleABC, torsoLeanFromVertical, gradeDeviation, distanceToRange, pickWorseSeverity } from '../utils/poseUtils';

const coverDriveConfig = {
  keyJoints: [11, 12, 13, 14, 5, 6, 9, 10],
  detectPhases(frames) {
    return { bottomIdx: 0, phases: frames.map(() => "swing") };
  },
  evaluateFrame(frame) {
    const frontKnee = angleABC(
      frame.keypoints[11],
      frame.keypoints[13],
      frame.keypoints[15],
    );
    const kneeGrade = gradeDeviation(
      distanceToRange(frontKnee, 110, 150),
      0,
      15,
    );
    const jointSeverity = { 13: kneeGrade.level, 15: kneeGrade.level };
    return {
      metrics: { frontKnee },
      checks: { kneeGrade },
      jointSeverity,
      frameError: kneeGrade.score * 2,
      reasons:
        kneeGrade.level === "good"
          ? []
          : [`Front knee ${frontKnee.toFixed(1)}°`],
    };
  },
};

export const activityConfig = {
  squat: {
    keyJoints: [11, 12, 13, 14, 15, 16, 5, 6],
    detectPhases(frames) {
      const hipY = frames.map(
        (f) => (f.keypoints[11].y + f.keypoints[12].y) / 2,
      );
      const bottomIdx = hipY.reduce(
        (best, v, i, arr) => (v > arr[best] ? i : best),
        0,
      );
      return {
        bottomIdx,
        phases: hipY.map((_, i) => {
          if (Math.abs(i - bottomIdx) <= 2) return "bottom";
          if (i < bottomIdx) return "descent";
          return "ascent";
        }),
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

      const leftKneeAngle =
        context.angleCache?.leftKneeAngle ??
        angleABC(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle =
        context.angleCache?.rightKneeAngle ??
        angleABC(rightHip, rightKnee, rightAnkle);
      const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
      const torsoLean =
        context.angleCache?.torsoLean ??
        torsoLeanFromVertical(leftShoulder, rightShoulder, leftHip, rightHip);

      const hipY = (leftHip.y + rightHip.y) / 2;
      const kneeY = (leftKnee.y + rightKnee.y) / 2;
      const hipDepthDeviation = Math.max(0, kneeY - hipY - 0.005);

      const hipWidth = Math.max(Math.abs(leftHip.x - rightHip.x), 1e-6);
      const leftMedial = Math.max(0, leftKnee.x - leftAnkle.x);
      const rightMedial = Math.max(0, rightAnkle.x - rightKnee.x);
      const kneeTrackDeviation = (leftMedial + rightMedial) / hipWidth;

      const baselineHeelY = context.baselineHeelY;
      const currentHeelY = (leftAnkle.y + rightAnkle.y) / 2;
      const heelLiftDeviation = Math.max(0, baselineHeelY - currentHeelY);

      const strict = context.phase === "bottom";
      const kneeGrade = gradeDeviation(
        distanceToRange(avgKneeAngle, 80, 100),
        0,
        strict ? 6 : 10,
      );
      const depthGrade = gradeDeviation(
        hipDepthDeviation,
        0.005,
        strict ? 0.02 : 0.03,
      );
      const torsoGrade = gradeDeviation(
        distanceToRange(torsoLean, 20, 45),
        0,
        strict ? 8 : 12,
      );
      const trackGrade = gradeDeviation(kneeTrackDeviation, 0.08, 0.16);
      const heelGrade = gradeDeviation(heelLiftDeviation, 0.01, 0.03);

      const jointSeverity = {};
      const apply = (jointIds, level) => {
        jointIds.forEach((id) => {
          jointSeverity[id] = jointSeverity[id]
            ? pickWorseSeverity(jointSeverity[id], level)
            : level;
        });
      };

      apply([13, 14], kneeGrade.level);
      apply([11, 12], depthGrade.level);
      apply([5, 6, 11, 12], torsoGrade.level);
      apply([13, 14, 15, 16], trackGrade.level);
      apply([15, 16], heelGrade.level);

      const reasons = [];
      if (kneeGrade.level !== "good")
        reasons.push(`Knee angle ${avgKneeAngle.toFixed(1)}°`);
      if (depthGrade.level !== "good") reasons.push("Hip depth insufficient");
      if (torsoGrade.level !== "good")
        reasons.push(`Torso lean ${torsoLean.toFixed(1)}°`);
      if (trackGrade.level !== "good") reasons.push("Knee tracking collapse");
      if (heelGrade.level === "bad") reasons.push("Heel lift detected");

      return {
        metrics: {
          kneeAngle: avgKneeAngle,
          hipDepthDelta: hipY - kneeY,
          torsoLean,
          kneeTracking: kneeTrackDeviation,
          heelLift: heelLiftDeviation,
        },
        checks: { kneeGrade, depthGrade, torsoGrade, trackGrade, heelGrade },
        jointSeverity,
        frameError:
          kneeGrade.score * 2.4 +
          depthGrade.score * 1.8 +
          torsoGrade.score * 1.4 +
          trackGrade.score * 1.5 +
          heelGrade.score * 0.8,
        reasons,
      };
    },
  },
  pushup: {
    keyJoints: [5, 6, 7, 8, 11, 12, 13, 14],
    detectPhases(frames) {
      return { bottomIdx: 0, phases: frames.map(() => "work") };
    },
    evaluateFrame(frame) {
      const elbow = angleABC(
        frame.keypoints[5],
        frame.keypoints[7],
        frame.keypoints[9],
      );
      const elbowGrade = gradeDeviation(distanceToRange(elbow, 70, 110), 0, 15);
      const jointSeverity = { 7: elbowGrade.level, 8: elbowGrade.level };
      return {
        metrics: { elbowAngle: elbow },
        checks: { elbowGrade },
        jointSeverity,
        frameError: elbowGrade.score * 2,
        reasons:
          elbowGrade.level === "good"
            ? []
            : [`Elbow angle ${elbow.toFixed(1)}°`],
      };
    },
  },
  coverDrive: coverDriveConfig,
  cricketDrive: coverDriveConfig,
  cricketLegGlanceFlick: coverDriveConfig,
  cricketPullshot: coverDriveConfig,
  cricketSweep: coverDriveConfig,
  bowling: {
    keyJoints: [5, 6, 7, 8, 11, 12, 13, 14],
    detectPhases(frames) {
      return { bottomIdx: 0, phases: frames.map(() => "delivery") };
    },
    evaluateFrame(frame) {
      const trunk = torsoLeanFromVertical(
        frame.keypoints[5],
        frame.keypoints[6],
        frame.keypoints[11],
        frame.keypoints[12],
      );
      const trunkGrade = gradeDeviation(distanceToRange(trunk, 10, 40), 0, 12);
      const jointSeverity = {
        5: trunkGrade.level,
        6: trunkGrade.level,
        11: trunkGrade.level,
        12: trunkGrade.level,
      };
      return {
        metrics: { trunkLean: trunk },
        checks: { trunkGrade },
        jointSeverity,
        frameError: trunkGrade.score * 2,
        reasons:
          trunkGrade.level === "good"
            ? []
            : [`Trunk lean ${trunk.toFixed(1)}°`],
      };
    },
  },
};

export function getWorstFrame(activityData) {
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
