VEHICLE_CLASSES = {"car", "bus", "truck", "motorbike"}

class AdaptiveSignalTimer:
    def __init__(self, min_green=15, max_green=60):
        self.min_green = min_green
        self.max_green = max_green

    def compute(self, detections):
        counts = {
            "car": 0,
            "bus": 0,
            "truck": 0,
            "motorbike": 0
        }

        for obj in detections:
            name = obj["name"]
            if name in counts:
                counts[name] += 1

        vehicle_count = sum(counts.values())

        green_time = (
            counts["truck"] * 3 +
            counts["bus"] * 3 +
            counts["car"] * 2 +
            counts["motorbike"] * 1.5
        )

        # Clamp green time
        green_time = max(self.min_green, green_time)
        green_time = min(self.max_green, green_time)

        return counts, vehicle_count, green_time
