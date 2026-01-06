import tkinter as tk
from tkinter import filedialog, Label, Button, Toplevel, messagebox
from PIL import Image, ImageTk
import os

# ---- System imports ----
from detector import TrafficDetector
from adaptive_timer import AdaptiveSignalTimer
from junction import Junction


# ---------------- Configuration ----------------

MODEL_PATH = "yolov5s.pt"
LANES = ["N", "S", "E", "W"]   # Order matters
YELLOW_TIME = 4
last_image_paths = []
junction = None

# ---------------- Initialize Core Components ----------------

detector = TrafficDetector(model_path=MODEL_PATH, threshold=0.4)
timer = AdaptiveSignalTimer()


# ---------------- Tkinter Root ----------------

root = tk.Tk()
root.title("Traffic Management System – Junction Control")


# ---------------- Junction Decision UI ----------------

def show_error(message):
    messagebox.showerror("Error", message)


def show_junction_decision(lane_counts, active_phase, green_time):
    window = Toplevel(root)
    window.title("Junction Signal Decision")

    text = (
        "Lane Vehicle Counts\n"
        "-------------------\n"
        f"North (N): {lane_counts['N']}\n"
        f"South (S): {lane_counts['S']}\n"
        f"East  (E): {lane_counts['E']}\n"
        f"West  (W): {lane_counts['W']}\n\n"
        f"ACTIVE PHASE: {active_phase}\n"
        f"GREEN TIME: {green_time:.1f} seconds\n"
        f"YELLOW TIME: {YELLOW_TIME} seconds"
    )

    label = Label(
        window,
        text=text,
        width=45,
        height=16,
        justify="left",
        bg="white",
        fg="black",
        font=("Arial", 10)
    )
    label.pack(padx=15, pady=15)

    Button(
        window,
        text="Run Next Cycle",
        bg="green",
        fg="white",
        width=20,
        command=lambda: [window.destroy(), process_junction_images(last_image_paths)]
    ).pack(pady=10)

    Button(
        window,
        text="Close",
        bg="gray",
        fg="white",
        width=20,
        command=window.destroy
    ).pack(pady=5)


# ---------------- Core Junction Logic ----------------

def process_junction_images(image_paths):
    global junction

    lane_counts = {}

    for lane, image_path in zip(LANES, image_paths):
        detections = detector.detect(image_path)
        lane_counts[lane] = len(detections)

    # Create junction only ONCE
    if junction is None:
        junction = Junction(lane_counts)
    else:
        # Update lane counts without resetting memory
        junction.lane_counts = lane_counts

    active_phase = junction.select_phase()
    phase_lane_counts = junction.get_phase_lane_counts(active_phase)

    total_phase_vehicles = sum(phase_lane_counts.values())
    fake_detections = [{"name": "car"}] * total_phase_vehicles

    _, _, green_time = timer.compute(fake_detections)

    show_junction_decision(
        lane_counts,
        active_phase,
        green_time
    )

# ---------------- Image Selection ----------------

def browse_images():
    global last_image_paths

    paths = filedialog.askopenfilenames(
        title="Select 4 Junction Images (N, S, E, W)",
        filetypes=[
            ("Image files", "*.jpg *.jpeg *.png"),
            ("All files", "*.*")
        ]
    )

    if not paths:
        return

    if len(paths) != 4:
        show_error("Please select exactly 4 images:\nN, S, E, W")
        return

    last_image_paths = [os.path.normpath(p) for p in paths]
    process_junction_images(last_image_paths)


# ---------------- Main UI ----------------

main_label = Label(
    root,
    text="Traffic Management System\nJunction-Level Signal Control",
    width=50,
    height=5,
    bg="black",
    fg="white",
    font=("Arial", 13, "bold")
)
main_label.pack(padx=10, pady=10)

browse_button = Button(
    root,
    text="Browse Junction Images (4)",
    command=browse_images,
    bg="blue",
    fg="white",
    width=30,
    height=2
)
browse_button.pack(pady=20)

root.mainloop()
