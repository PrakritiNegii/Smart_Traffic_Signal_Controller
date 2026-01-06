from ultralytics import YOLO

class TrafficDetector:
    def __init__(self, model_path="yolov5s.pt", threshold=0.4):
        self.model = YOLO(model_path)
        self.threshold = threshold

    def detect(self, image_path):
        results = self.model(image_path)[0]

        detections = []

        for box in results.boxes:
            confidence = float(box.conf[0])
            if confidence < self.threshold:
                continue

            cls_id = int(box.cls[0])
            label = self.model.names[cls_id]

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            detections.append({
                "name": label,
                "confidence": confidence,
                "bbox": (x1, y1, x2, y2)
            })

        return detections
