detector = TrafficDetector(model_path)
timer = AdaptiveSignalTimer()

detections = detector.detect(image_path)

counts, vehicle_count, green_time = timer.compute(detections)

show_results_ui(counts, vehicle_count, green_time)
