"""Flask API — wraps existing YOLO detector and junction logic."""

import os
import tempfile
from functools import lru_cache
from typing import Optional

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.utils import secure_filename

from adaptive_timer import AdaptiveSignalTimer
from junction import Junction

app = Flask(__name__, static_folder="frontend", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "traffic-signal-dev-key")

LANES = ["N", "S", "E", "W"]
LANE_FILES = ["north", "south", "east", "west"]
YELLOW_TIME = int(os.environ.get("YELLOW_TIME", "4"))
MODEL_PATH = os.environ.get("YOLO_MODEL", "yolov5s.pt")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}


@lru_cache(maxsize=1)
def get_detector(threshold: float = 0.4):
    from detector import TrafficDetector
    return TrafficDetector(model_path=MODEL_PATH, threshold=threshold)


def get_timer(min_green: int = 15, max_green: int = 60) -> AdaptiveSignalTimer:
    return AdaptiveSignalTimer(min_green=min_green, max_green=max_green)


def _junction_from_session(lane_counts: dict) -> Junction:
    junction = Junction(lane_counts)
    if session.get("junction_last_phase"):
        junction.last_phase = session["junction_last_phase"]
    return junction


def _save_junction(junction: Junction) -> None:
    session["junction_last_phase"] = junction.last_phase
    session["lane_counts"] = junction.lane_counts


def _decide(lane_counts: dict, detections_by_lane: Optional[dict], settings: dict) -> dict:
    junction = _junction_from_session(lane_counts)
    junction.lane_counts = lane_counts

    active_phase = junction.select_phase()
    _save_junction(junction)

    phase_lanes = junction.get_phase_lane_counts(active_phase)
    timer = get_timer(settings.get("min_green", 15), settings.get("max_green", 60))

    if detections_by_lane:
        phase_detections = []
        for lane in junction.phase_lanes[active_phase]:
            phase_detections.extend(detections_by_lane.get(lane, []))
    else:
        total = sum(phase_lanes.values())
        phase_detections = [{"name": "car"}] * total

    breakdown, vehicle_count, green_time = timer.compute(phase_detections)
    phase_loads = junction.get_phase_loads()

    return {
        "lane_counts": lane_counts,
        "phase_loads": phase_loads,
        "active_phase": active_phase,
        "phase_lanes": junction.phase_lanes[active_phase],
        "green_time": round(green_time, 1),
        "yellow_time": YELLOW_TIME,
        "vehicle_breakdown": breakdown,
        "phase_vehicle_count": vehicle_count,
        "detections_by_lane": detections_by_lane or {},
    }


def _parse_settings() -> dict:
    data = request.get_json(silent=True) or {}
    settings = data.get("settings") or request.form.to_dict() or {}
    return {
        "min_green": int(settings.get("min_green", 15)),
        "max_green": int(settings.get("max_green", 60)),
        "threshold": float(settings.get("threshold", 0.4)),
    }


@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH})


@app.route("/api/analyze", methods=["POST"])
def analyze():
    settings = _parse_settings()
    threshold = settings["threshold"]

    missing = [name for name in LANE_FILES if name not in request.files]
    if missing:
        return jsonify({"error": f"Missing images: {', '.join(missing)}"}), 400

    lane_counts = {}
    detections_by_lane = {}
    previews = {}

    try:
        detector = get_detector(threshold)

        for lane, file_key in zip(LANES, LANE_FILES):
            file = request.files[file_key]
            if not file or not file.filename:
                return jsonify({"error": f"No file for {file_key}"}), 400

            ext = os.path.splitext(secure_filename(file.filename))[1].lower()
            if ext not in ALLOWED_EXT:
                return jsonify({"error": f"Invalid file type for {file_key}"}), 400

            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                file.save(tmp.name)
                path = tmp.name

            try:
                detections = detector.detect(path)
            finally:
                os.unlink(path)

            vehicle_detections = [
                d for d in detections if d["name"] in {"car", "bus", "truck", "motorbike"}
            ]
            lane_counts[lane] = len(vehicle_detections)
            detections_by_lane[lane] = [
                {"name": d["name"], "confidence": round(d["confidence"], 2)} for d in vehicle_detections
            ]

        result = _decide(lane_counts, detections_by_lane, settings)
        return jsonify(result)

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/next-cycle", methods=["POST"])
def next_cycle():
    data = request.get_json(silent=True) or {}
    lane_counts = data.get("lane_counts") or session.get("lane_counts")

    if not lane_counts:
        return jsonify({"error": "No lane data. Upload images first."}), 400

    settings = data.get("settings") or {}
    parsed = {
        "min_green": int(settings.get("min_green", 15)),
        "max_green": int(settings.get("max_green", 60)),
    }

    try:
        result = _decide(lane_counts, None, parsed)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/reset", methods=["POST"])
def reset():
    session.clear()
    get_detector.cache_clear()
    return jsonify({"status": "reset"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
