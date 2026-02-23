export const COLORS = {
  bg: "#0B0F14",
  card: "#121821",
  primary: "#00E5FF",
  secondary: "#00FF9D",
  warn: "#FF4D4F",
  txt: "#E6EDF3",
  subtxt: "#9BA3AF",
};

export const NAV_ITEMS = [
  { key: "home", icon: "⌂", label: "Home" },
  { key: "analyze", icon: "◉", label: "Analyze" },
  { key: "history", icon: "◷", label: "History" },
  { key: "insights", icon: "◍", label: "Insights" },
  { key: "profile", icon: "◎", label: "Profile" },
];

export const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

export const FULL_SKELETON_EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

export const KEYPOINT_INDEX = {
  nose: 0,
  left_shoulder: 5, right_shoulder: 6,
  left_hip: 11, right_hip: 12,
  left_knee: 13, right_knee: 14,
  left_ankle: 15, right_ankle: 16,
  left_wrist: 9, right_wrist: 10,
};

export const SEVERITY_COLORS = {
  good: "#00FF9D", warning: "#FFC857", bad: "#FF4D4F", neutral: "rgba(180, 196, 215, 0.72)",
};

export const ACTIVITY_OPTIONS = [
  { key: "auto", label: "Auto Detect" }, { key: "squat", label: "Gym: Squat" },
  { key: "pushup", label: "Gym: Push-up" }, { key: "coverDrive", label: "Cricket: Cover Drive" },
  { key: "bowling", label: "Cricket: Bowling" },
];

export const ACTIVITY_BACKEND_HINT = {
  auto: "auto", squat: "squat", pushup: "auto", coverDrive: "cricket_cover_drive", bowling: "auto",
};

export const BOWLING_SPEED = {
  slow: { label: "Slow", mps: 20, worldVz: 8.2, idealTime: 2.35, windowMs: 220 },
  medium: { label: "Medium", mps: 30, worldVz: 11.6, idealTime: 1.72, windowMs: 180 },
  fast: { label: "Fast", mps: 40, worldVz: 15.2, idealTime: 1.32, windowMs: 150 },
};
