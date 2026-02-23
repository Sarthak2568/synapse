export const COACHING_CUES = {
  squat: {
    kneeAngle: {
      high: "Great depth! Power up through your heels.",
      low: "Try to sink a bit deeper to engage your glutes fully.",
    },
    torsoLean: {
      high: "Keep your chest up! Avoid leaning too far forward.",
      low: "Good upright posture. Maintain that core stability.",
    },
    kneeTracking: {
      high: "⚠️ Careful! Your knees are caving in. Drive them outward.",
      low: "Knees are tracking perfectly over your toes.",
    },
    balance: {
      high: "⚠️ Balance shifting too much. Center your weight.",
    }
  },
  pushup: {
    elbowAngle: {
      high: "Excellent range! Full extension at the top.",
      low: "Lower your chest closer to the floor for better engagement.",
    }
  },
  coverDrive: {
    frontKnee: {
      high: "Perfect bend! You've got a stable base for the shot.",
      low: "Lean more into the ball; bend that front knee further.",
    },
    timing: {
      late: "⏳ Swing a bit earlier to meet the ball in front.",
      early: "⚡ A bit early! Wait for the ball to enter your zone."
    }
  },
  bowling: {
    trunkLean: {
      high: "⚠️ High trunk lean. Ensure your follow-through is smooth.",
      low: "Consistent alignment. Keep that bowling arm straight.",
    }
  }
};

export function getTechnicalAdvice(activity, metrics, phase) {
  const cues = COACHING_CUES[activity];
  if (!cues) return { msg: "Focus on consistent movement patterns.", type: "info" };

  // Prioritized checks for realistic feedback
  if (activity === "squat") {
    if (metrics.path > 0.15) return { msg: cues.kneeTracking.high, type: "error" };
    if (metrics.back > 50) return { msg: cues.torsoLean.high, type: "warning" };
    if (phase === "bottom" && metrics.knee > 105) return { msg: cues.kneeAngle.low, type: "tip" };
    if (metrics.balance > 8) return { msg: cues.balance.high, type: "warning" };
    
    if (phase === "ascent") return { msg: "Explode upwards! Keep the momentum.", type: "success" };
    if (phase === "bottom") return { msg: "Hold and drive! Good control.", type: "success" };
  }

  if (activity === "coverDrive") {
    if (metrics.knee < 110) return { msg: cues.frontKnee.low, type: "tip" };
    return { msg: "Smooth swing path. Keep your eyes on the target.", type: "success" };
  }

  if (activity === "bowling") {
    if (metrics.back > 45) return { msg: cues.trunkLean.high, type: "warning" };
    return { msg: "Vibrant delivery stride. Maintain arm speed.", type: "success" };
  }

  if (activity === "pushup") {
    if (metrics.knee > 120) return { msg: cues.elbowAngle.low, type: "tip" };
    return { msg: "Solid core. Keep your body in a straight line.", type: "success" };
  }

  return { msg: "Movement detected. Maintain controlled tempo.", type: "info" };
}
