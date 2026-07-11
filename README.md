# Smart Traffic Signal Controller

Adaptive junction-level traffic signal control with **YOLOv5** vehicle detection and a web dashboard.

## Features

- Vehicle detection using YOLOv5 (Ultralytics)
- 4-phase junction modeling (N / S / E / W)
- Rule-based phase selection with anti-starvation logic
- Adaptive green-time calculation by vehicle type
- Premium web dashboard (HTML/CSS/JS)
- Live traffic light visualization with auto-cycling
- Flask REST API wrapping existing Python logic

## Project Structure

```
├── api.py              # Flask server (serves UI + API)
├── app.py              # Original Tkinter desktop UI
├── detector.py         # YOLO vehicle detector
├── junction.py         # Phase selection logic
├── adaptive_timer.py   # Green time calculator
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
└── requirements.txt
```

## Quick Start

```bash
cd Smart_Traffic_Signal_Controller
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python api.py
```

Open **http://localhost:5000** in your browser.

1. Go to **Detection** → upload 4 lane images (North, South, East, West)
2. Click **Analyze Junction** — YOLO counts vehicles per lane
3. View results on **Dashboard** and **Junction** with live signal animation
4. Use **Auto Cycle** for continuous phase rotation

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/analyze` | Upload 4 images, run detection + decide phase |
| POST | `/api/next-cycle` | Next phase (uses session state) |
| POST | `/api/reset` | Clear junction session |

## Desktop App (Legacy)

The original Tkinter UI still works:

```bash
python app.py
```

## Deploy (Render)

1. Push to GitHub
2. Create a **Web Service** on [Render](https://render.com)
3. Build: `pip install -r requirements.txt`
4. Start: `gunicorn api:app --bind 0.0.0.0:$PORT`

## Contributors

- [@PrakritiNegii](https://github.com/PrakritiNegii) — Original project
- [@NegiCoder](https://github.com/NegiCoder) — Web UI + API integration

## License

MIT
