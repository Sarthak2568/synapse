from __future__ import annotations

import json
import os
import threading
from collections import Counter, deque
from pathlib import Path
from typing import Any, Optional

from app.schemas import FramePose

_SKELETON_EDGES = (
    (0, 1),
    (0, 2),
    (1, 3),
    (2, 4),
    (5, 6),
    (5, 7),
    (7, 9),
    (6, 8),
    (8, 10),
    (5, 11),
    (6, 12),
    (11, 12),
    (11, 13),
    (13, 15),
    (12, 14),
    (14, 16),
)

_DEFAULT_CLASSES = {0: "drive", 1: "legglance-flick", 2: "pullshot", 3: "sweep"}


class CricketCNNInference:
    def __init__(self) -> None:
        self.enabled = os.getenv("CNN_SHOT_ENABLED", "1").lower() not in {"0", "false", "no"}
        self.window_size = max(3, int(os.getenv("CNN_WINDOW_SIZE", "7")))
        self.model_dir = Path(os.getenv("CNN_MODEL_DIR", "backend/models"))
        self.weights_path = self.model_dir / "cricket_shot_model.pth"
        self.mapping_path = self.model_dir / "class_mapping.json"
        self.preprocess_path = self.model_dir / "preprocess_config.json"
        self.model_config_path = self.model_dir / "model_config.json"

        self._lock = threading.Lock()
        self._history: deque[tuple[str, float]] = deque(maxlen=self.window_size)
        self._load_attempted = False
        self._load_error: Optional[str] = None

        self._torch = None
        self._transforms = None
        self._image_cls = None
        self._model = None
        self._device = "cpu"
        self._class_mapping: dict[int, str] = dict(_DEFAULT_CLASSES)
        self._preprocess = None
        self._input_size = 224
        self._mean = [0.485, 0.456, 0.406]
        self._std = [0.229, 0.224, 0.225]
        self._arch = "mobilenet_v3_small"

    def _load_dependencies(self) -> None:
        import torch  # type: ignore
        from PIL import Image  # type: ignore
        from torchvision import models, transforms  # type: ignore

        self._torch = torch
        self._image_cls = Image.Image
        self._models = models
        self._transforms = transforms

    def _load_metadata(self) -> None:
        if self.mapping_path.exists():
            loaded = json.loads(self.mapping_path.read_text())
            if isinstance(loaded, dict):
                self._class_mapping = {int(k): str(v) for k, v in loaded.items()}

        if self.preprocess_path.exists():
            cfg = json.loads(self.preprocess_path.read_text())
            self._input_size = int(cfg.get("input_size", 224))
            self._mean = list(cfg.get("mean", self._mean))
            self._std = list(cfg.get("std", self._std))

        if self.model_config_path.exists():
            cfg = json.loads(self.model_config_path.read_text())
            self._arch = str(cfg.get("arch", self._arch))

    def _build_model(self, arch: str, num_classes: int):
        models = self._models
        if arch == "mobilenet_v3_small":
            model = models.mobilenet_v3_small(weights=None)
            in_features = model.classifier[3].in_features
            model.classifier[3] = self._torch.nn.Linear(in_features, num_classes)
            return model
        if arch == "mobilenet_v3_large":
            model = models.mobilenet_v3_large(weights=None)
            in_features = model.classifier[3].in_features
            model.classifier[3] = self._torch.nn.Linear(in_features, num_classes)
            return model
        if arch == "efficientnet_b0":
            model = models.efficientnet_b0(weights=None)
            in_features = model.classifier[1].in_features
            model.classifier[1] = self._torch.nn.Linear(in_features, num_classes)
            return model

        # Backward compatibility with old notebook export.
        model = models.resnet50(weights=None)
        in_features = model.fc.in_features
        model.fc = self._torch.nn.Linear(in_features, num_classes)
        return model

    def _build_preprocess(self) -> None:
        self._preprocess = self._transforms.Compose(
            [
                self._transforms.Resize((self._input_size, self._input_size)),
                self._transforms.ToTensor(),
                self._transforms.Normalize(mean=self._mean, std=self._std),
            ]
        )

    def _ensure_loaded(self) -> bool:
        if not self.enabled:
            return False

        if self._load_attempted:
            return self._model is not None

        with self._lock:
            if self._load_attempted:
                return self._model is not None

            self._load_attempted = True
            try:
                self._load_dependencies()
                self._load_metadata()

                if not self.weights_path.exists():
                    raise FileNotFoundError(f"CNN weights not found: {self.weights_path}")

                self._device = "cuda" if self._torch.cuda.is_available() else "cpu"
                self._build_preprocess()
                self._model = self._build_model(self._arch, len(self._class_mapping))
                state = self._torch.load(self.weights_path, map_location=self._device)
                self._model.load_state_dict(state)
                self._model.to(self._device)
                self._model.eval()
            except Exception as exc:
                self._load_error = str(exc)
                self._model = None
        return self._model is not None

    def _to_pil_image(self, frame: Any):
        if frame is None:
            return None

        from PIL import Image  # type: ignore
        import numpy as np  # type: ignore

        if isinstance(frame, self._image_cls):
            return frame.convert("RGB")
        if isinstance(frame, np.ndarray):
            if frame.ndim == 2:
                return Image.fromarray(frame).convert("RGB")
            return Image.fromarray(frame[..., :3]).convert("RGB")
        return None

    def reset(self) -> None:
        self._history.clear()

    def _smooth(self, label: str, confidence: float) -> dict[str, Any]:
        self._history.append((label, confidence))
        counts = Counter(lbl for lbl, _ in self._history)
        winner = counts.most_common(1)[0][0]
        winner_confs = [conf for lbl, conf in self._history if lbl == winner]
        avg_conf = sum(winner_confs) / max(len(winner_confs), 1)
        return {"label": winner, "confidence": round(float(avg_conf), 4), "source": "cnn"}

    def predict_shot(self, frame: Any) -> Optional[dict[str, Any]]:
        try:
            if not self._ensure_loaded():
                return None

            img = self._to_pil_image(frame)
            if img is None:
                return None

            tensor = self._preprocess(img).unsqueeze(0).to(self._device)
            with self._torch.no_grad():
                logits = self._model(tensor)
                probs = self._torch.nn.functional.softmax(logits, dim=1)[0]
                idx = int(self._torch.argmax(probs).item())
                label = self._class_mapping.get(idx, "unknown")
                confidence = float(probs[idx].item())
            return self._smooth(label, confidence)
        except Exception:
            return None

    def predict_sequence(self, frames: list[Any]) -> Optional[dict[str, Any]]:
        if not frames:
            return None
        self.reset()
        out = None
        for f in frames:
            pred = self.predict_shot(f)
            if pred:
                out = pred
        return out


_GLOBAL_PREDICTOR = CricketCNNInference()


def get_cnn_predictor() -> CricketCNNInference:
    return _GLOBAL_PREDICTOR


def render_pose_to_image(frame: FramePose, image_size: int = 224):
    """Render normalized 17-keypoint pose to an RGB image for optional CNN helper inference."""
    try:
        from PIL import Image, ImageDraw  # type: ignore
    except Exception:
        return None

    canvas = Image.new("RGB", (image_size, image_size), color=(10, 14, 20))
    draw = ImageDraw.Draw(canvas)
    pts: list[tuple[float, float]] = []
    for kp in frame.keypoints:
        x = max(0.0, min(1.0, kp.x)) * (image_size - 1)
        y = max(0.0, min(1.0, kp.y)) * (image_size - 1)
        pts.append((x, y))

    for a, b in _SKELETON_EDGES:
        ax, ay = pts[a]
        bx, by = pts[b]
        draw.line((ax, ay, bx, by), fill=(80, 190, 255), width=2)

    for x, y in pts:
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(0, 255, 157))

    return canvas


def predict_from_pose_frames(frames: list[FramePose], stride: int = 3, max_frames: int = 7) -> Optional[dict[str, Any]]:
    if not frames:
        return None

    predictor = get_cnn_predictor()
    sampled = frames[:: max(1, stride)][:max_frames]
    rendered = [render_pose_to_image(f) for f in sampled]
    rendered = [img for img in rendered if img is not None]
    if not rendered:
        return None

    return predictor.predict_sequence(rendered)
