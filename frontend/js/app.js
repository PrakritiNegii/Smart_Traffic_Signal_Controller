/**
 * SignalFlow — Traffic Signal Dashboard
 * Vanilla ES6 frontend for Smart Traffic Signal Controller
 */

const PHASE_LABELS = { P1: "North", P2: "South", P3: "East", P4: "West" };
const PHASE_LANES = { P1: ["N"], P2: ["S"], P3: ["E"], P4: ["W"] };
const LANE_NAMES = { N: "North", S: "South", E: "East", W: "West" };
const HISTORY_KEY = "signalflow_history";
const SETTINGS_KEY = "signalflow_settings";
const THEME_KEY = "signalflow_theme";
const PAGE_SIZE = 8;

const state = {
  laneCounts: null,
  lastResult: null,
  autoRunning: false,
  cycleCount: 0,
  countdownTimer: null,
  countdownValue: 0,
  signalState: "idle", // idle | green | yellow
  history: [],
  settings: { min_green: 15, max_green: 60, threshold: 0.4 },
  historyPage: 1,
  historyFilter: "",
};

// ── DOM refs ──────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Utilities ─────────────────────────────────────────────────────────────

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) Object.assign(state.settings, saved);
  } catch { /* ponytail: ignore corrupt storage */ }
  $("#min-green").value = state.settings.min_green;
  $("#max-green").value = state.settings.max_green;
  $("#threshold").value = state.settings.threshold;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  localStorage.setItem(THEME_KEY, theme);

  const icon = $("#theme-toggle i");
  if (icon) icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";

  const arch = $("#arch-mermaid");
  if (arch?.dataset.rendered === "true") {
    arch.dataset.rendered = "false";
    arch.innerHTML = "";
    mermaidReady = false;
    if ($("#view-architecture")?.classList.contains("active")) renderArchDiagram();
  }
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "light" : "dark");
}

function loadHistory() {
  try {
    state.history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    state.history = [];
  }
  state.cycleCount = state.history.length;
}

function persistHistory(entry) {
  state.history.unshift(entry);
  if (state.history.length > 100) state.history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  state.cycleCount = state.history.length;
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;

  const icon = document.createElement("i");
  icon.className = `fa-solid fa-${type === "success" ? "check-circle" : type === "error" ? "circle-xmark" : "info-circle"}`;

  const text = document.createElement("span");
  text.textContent = message;

  el.append(icon, text);
  $("#toast-container").appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 200ms";
    setTimeout(() => el.remove(), 200);
  }, 3500);
}

function showLoading(text = "Processing…") {
  $("#loading-text").textContent = text;
  $("#loading-overlay").hidden = false;
}

function hideLoading() {
  $("#loading-overlay").hidden = true;
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const modal = $("#confirm-modal");
    $("#confirm-message").textContent = message;

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      modal.close();
      modal.oncancel = null;
      resolve(result);
    };

    modal.oncancel = (e) => {
      e.preventDefault();
      finish(false);
    };

    modal.showModal();
    $("#confirm-ok").onclick = () => finish(true);
    $("#confirm-cancel").onclick = () => finish(false);
  });
}

// ── Architecture diagram (Mermaid) ────────────────────────────────────────

const ARCH_DIAGRAM = `flowchart LR
    A["Web UI\\nHTML CSS JS"] -->|"upload 4 images"| B["Flask API\\nPython"]
    B --> C["YOLO detector"]
    B --> D["Junction logic"]
    B --> E["Adaptive timer"]
    B -->|"JSON result"| A
    A --> F["Traffic lights\\nDashboard\\nHistory"]`;

let mermaidReady = false;

function initMermaid() {
  if (mermaidReady || !window.mermaid) return;
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: dark
      ? {
          primaryColor: "#1E3A5F",
          primaryTextColor: "#F1F5F9",
          primaryBorderColor: "#3B82F6",
          secondaryColor: "#134E4A",
          secondaryTextColor: "#F1F5F9",
          secondaryBorderColor: "#2DD4BF",
          tertiaryColor: "#1E293B",
          tertiaryTextColor: "#F1F5F9",
          tertiaryBorderColor: "#334155",
          lineColor: "#64748B",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "14px",
        }
      : {
          primaryColor: "#EFF6FF",
          primaryTextColor: "#1E293B",
          primaryBorderColor: "#2563EB",
          secondaryColor: "#F0FDFA",
          secondaryTextColor: "#1E293B",
          secondaryBorderColor: "#14B8A6",
          tertiaryColor: "#FFFFFF",
          tertiaryTextColor: "#1E293B",
          tertiaryBorderColor: "#E2E8F0",
          lineColor: "#64748B",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "14px",
        },
    flowchart: {
      htmlLabels: true,
      curve: "basis",
      padding: 20,
      nodeSpacing: 50,
      rankSpacing: 70,
    },
  });
  mermaidReady = true;
}

function renderFallbackDiagram(container) {
  container.innerHTML = `
    <svg class="arch-svg-fallback" viewBox="0 0 920 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture flowchart">
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill="#64748B"/>
        </marker>
      </defs>
      <rect x="10" y="70" width="110" height="56" rx="8" fill="#EFF6FF" stroke="#2563EB"/>
      <text x="65" y="92" text-anchor="middle" fill="#1E293B" font-size="13" font-weight="600">Web UI</text>
      <text x="65" y="110" text-anchor="middle" fill="#64748B" font-size="11">HTML CSS JS</text>

      <line x1="120" y1="98" x2="168" y2="98" stroke="#64748B" marker-end="url(#arrow)"/>
      <text x="144" y="88" text-anchor="middle" fill="#64748B" font-size="10">upload 4 images</text>

      <rect x="170" y="70" width="120" height="56" rx="8" fill="#F0FDFA" stroke="#14B8A6"/>
      <text x="230" y="92" text-anchor="middle" fill="#1E293B" font-size="13" font-weight="600">Flask API</text>
      <text x="230" y="110" text-anchor="middle" fill="#64748B" font-size="11">Python</text>

      <line x1="290" y1="85" x2="340" y2="35" stroke="#64748B" marker-end="url(#arrow)"/>
      <line x1="290" y1="98" x2="340" y2="98" stroke="#64748B" marker-end="url(#arrow)"/>
      <line x1="290" y1="111" x2="340" y2="165" stroke="#64748B" marker-end="url(#arrow)"/>

      <rect x="342" y="12" width="120" height="44" rx="8" fill="#fff" stroke="#E2E8F0"/>
      <text x="402" y="38" text-anchor="middle" fill="#1E293B" font-size="12">YOLO detector</text>

      <rect x="342" y="76" width="120" height="44" rx="8" fill="#fff" stroke="#E2E8F0"/>
      <text x="402" y="102" text-anchor="middle" fill="#1E293B" font-size="12">Junction logic</text>

      <rect x="342" y="140" width="120" height="44" rx="8" fill="#fff" stroke="#E2E8F0"/>
      <text x="402" y="166" text-anchor="middle" fill="#1E293B" font-size="12">Adaptive timer</text>

      <path d="M 230 126 Q 230 185 65 185 Q 10 185 10 126" fill="none" stroke="#64748B" marker-end="url(#arrow)"/>
      <text x="120" y="200" text-anchor="middle" fill="#64748B" font-size="10">JSON result</text>

      <line x1="65" y1="70" x2="65" y2="30" stroke="#64748B" marker-end="url(#arrow)"/>

      <rect x="10" y="4" width="150" height="56" rx="8" fill="#fff" stroke="#2563EB"/>
      <text x="85" y="26" text-anchor="middle" fill="#1E293B" font-size="12" font-weight="600">Traffic lights</text>
      <text x="85" y="42" text-anchor="middle" fill="#64748B" font-size="11">Dashboard · History</text>
    </svg>`;
}

async function renderArchDiagram() {
  const container = $("#arch-mermaid");
  if (!container || container.dataset.rendered === "true") return;

  container.innerHTML = '<p class="arch-loading">Drawing diagram…</p>';

  // Wait until the architecture view is visible (mermaid needs layout)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  initMermaid();

  if (!window.mermaid) {
    renderFallbackDiagram(container);
    container.dataset.rendered = "true";
    return;
  }

  try {
    const { svg } = await window.mermaid.render("arch-flowchart-id", ARCH_DIAGRAM);
    container.innerHTML = svg;
    container.dataset.rendered = "true";
  } catch (err) {
    console.error("Mermaid render failed:", err);
    renderFallbackDiagram(container);
    container.dataset.rendered = "true";
  }
}

// ── Navigation ────────────────────────────────────────────────────────────

function switchView(viewId) {
  $$(".view").forEach((v) => {
    v.classList.remove("active");
    v.hidden = true;
  });
  const view = $(`#view-${viewId}`);
  view.classList.add("active");
  view.hidden = false;

  $$(".nav-item, .mobile-nav__item").forEach((n) => {
    const isActive = n.dataset.view === viewId;
    n.classList.toggle("active", isActive);
    if (isActive) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  });

  if (viewId === "history") {
    renderHistory();
  }

  if (viewId === "architecture") {
    renderArchDiagram();
  }
}

// ── API ───────────────────────────────────────────────────────────────────

async function apiAnalyze(formData) {
  const res = await fetch("/api/analyze", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Analysis failed");
  return data;
}

async function apiNextCycle() {
  const res = await fetch("/api/next-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lane_counts: state.laneCounts, settings: state.settings }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Cycle failed");
  return data;
}

async function apiReset() {
  await fetch("/api/reset", { method: "POST" });
}

// ── UI updates ────────────────────────────────────────────────────────────

function totalVehicles(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function applyResult(result) {
  state.lastResult = result;
  state.laneCounts = result.lane_counts;

  const total = totalVehicles(result.lane_counts);
  $("#stat-total").textContent = total;
  $("#stat-phase").textContent = `${result.active_phase} (${PHASE_LABELS[result.active_phase]})`;
  $("#stat-green").textContent = `${result.green_time}s`;

  $("#detail-phase").textContent = `${result.active_phase} — ${PHASE_LABELS[result.active_phase]}`;
  $("#detail-green").textContent = `${result.green_time}s`;
  $("#detail-yellow").textContent = `${result.yellow_time}s`;
  $("#detail-lanes").textContent = result.phase_lanes.map((l) => LANE_NAMES[l]).join(", ");
  $("#detail-load").textContent = result.phase_vehicle_count;

  $("#core-phase").textContent = result.active_phase;
  updateLaneBars(result.lane_counts);
  updatePhaseLoads(result.phase_loads, result.active_phase);
  updateSignalCounts(result.lane_counts);
  updateDetectionTable(result);
  enableControls(true);

  persistHistory({
    time: new Date().toISOString(),
    phase: result.active_phase,
    green: result.green_time,
    counts: { ...result.lane_counts },
  });

  $("#stat-cycles").textContent = state.cycleCount;
  renderHistory();
  renderActivity();
}

function updateLaneBars(counts) {
  const max = Math.max(...Object.values(counts), 1);
  const container = $("#lane-bars");
  container.innerHTML = "";

  for (const [lane, count] of Object.entries(counts)) {
    const pct = Math.round((count / max) * 100);
    container.innerHTML += `
      <div class="lane-bar">
        <div class="lane-bar__header">
          <span>${LANE_NAMES[lane]}</span>
          <span>${count} vehicles</span>
        </div>
        <div class="lane-bar__track">
          <div class="lane-bar__fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }
}

function updatePhaseLoads(loads, active) {
  const container = $("#phase-loads");
  container.innerHTML = Object.entries(loads)
    .map(
      ([phase, load]) => `
      <div class="phase-chip ${phase === active ? "active" : ""}">
        ${phase}<strong>${load}</strong>
      </div>`
    )
    .join("");
}

function updateSignalCounts(counts) {
  $$("[data-count]").forEach((el) => {
    el.textContent = counts[el.dataset.count] ?? 0;
  });
}

function setSignalColor(lane, color) {
  $$(".signal").forEach((sig) => {
    sig.classList.remove("active-green", "active-yellow");
    sig.querySelectorAll(".light").forEach((l) => l.classList.remove("active"));
    sig.querySelector(".light--red").classList.add("active");
  });

  if (!lane || !color) return;

  const sig = $(`.signal[data-lane="${lane}"]`);
  if (!sig) return;

  sig.classList.add(color === "green" ? "active-green" : "active-yellow");
  sig.querySelectorAll(".light").forEach((l) => l.classList.remove("active"));
  sig.querySelector(`.light--${color}`).classList.add("active");
}

function updateDetectionTable(result) {
  $("#detection-results").hidden = false;
  const tbody = $("#detection-table tbody");
  tbody.innerHTML = "";

  for (const lane of ["N", "S", "E", "W"]) {
    const dets = result.detections_by_lane?.[lane] || [];
    const breakdown = {};
    dets.forEach((d) => {
      breakdown[d.name] = (breakdown[d.name] || 0) + 1;
    });
    const breakdownStr = Object.entries(breakdown)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ") || "—";

    tbody.innerHTML += `<tr><td>${LANE_NAMES[lane]}</td><td>${result.lane_counts[lane]}</td><td>${breakdownStr}</td></tr>`;
  }
}

function enableControls(on) {
  $("#manual-cycle-btn").disabled = !on;
  $("#auto-cycle-btn").disabled = !on;
}

function renderActivity() {
  const list = $("#activity-list");
  const recent = state.history.slice(0, 5);

  if (!recent.length) return;

  list.innerHTML = recent
    .map(
      (h) => `
    <li class="activity-item">
      <div class="activity-item__icon"><i class="fa-solid fa-traffic-light"></i></div>
      <div>
        <strong>${h.phase}</strong> — ${PHASE_LABELS[h.phase]} · ${h.green}s green<br>
        <span class="text-muted">${new Date(h.time).toLocaleString()}</span>
      </div>
    </li>`
    )
    .join("");
}

function getFilteredHistory() {
  let items = [...state.history];
  const phase = $("#filter-phase")?.value;
  const search = ($("#history-search")?.value || "").trim().toLowerCase();

  if (phase) items = items.filter((h) => h.phase === phase);

  if (search) {
    items = items.filter((h) => {
      const haystack = [
        h.phase,
        PHASE_LABELS[h.phase],
        h.green,
        h.counts.N,
        h.counts.S,
        h.counts.E,
        h.counts.W,
        new Date(h.time).toLocaleString(),
        new Date(h.time).toLocaleDateString(),
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }

  return items;
}

function updateSearchMeta(total) {
  const query = ($("#history-search")?.value || "").trim();
  const phase = $("#filter-phase")?.value;
  const meta = $("#search-meta");
  const clearBtn = $("#search-clear");

  if (clearBtn) clearBtn.hidden = !query;

  if (!query && !phase) {
    meta.hidden = true;
    return;
  }

  meta.hidden = false;
  const parts = [];
  if (query) parts.push(`"${query}"`);
  if (phase) parts.push(PHASE_LABELS[phase]);
  meta.textContent = `${total} result${total === 1 ? "" : "s"} for ${parts.join(" · ")}`;
}

function renderHistory() {
  const filtered = getFilteredHistory();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.historyPage = Math.min(state.historyPage, totalPages);

  const start = (state.historyPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);
  const tbody = $("#history-body");

  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><div class="empty-state empty-state--sm"><i class="fa-solid fa-inbox"></i><p>No matching records</p></div></td></tr>`;
    $("#pagination").hidden = true;
    updateSearchMeta(0);
    return;
  }

  tbody.innerHTML = page
    .map(
      (h) => `
    <tr>
      <td>${new Date(h.time).toLocaleString()}</td>
      <td>${h.phase} (${PHASE_LABELS[h.phase]})</td>
      <td>${h.green}s</td>
      <td>${h.counts.N}</td>
      <td>${h.counts.S}</td>
      <td>${h.counts.E}</td>
      <td>${h.counts.W}</td>
    </tr>`
    )
    .join("");

  $("#pagination").hidden = filtered.length <= PAGE_SIZE;
  $("#page-info").textContent = `Page ${state.historyPage} of ${totalPages}`;
  $("#prev-page").disabled = state.historyPage <= 1;
  $("#next-page").disabled = state.historyPage >= totalPages;
  updateSearchMeta(filtered.length);
}

// ── Signal cycling ────────────────────────────────────────────────────────

function startCountdown(seconds, label) {
  return new Promise((resolve) => {
    clearInterval(state.countdownTimer);
    state.countdownValue = seconds;
    $("#core-timer").textContent = `${seconds}s`;
    $("#cycle-badge").textContent = label;
    $("#cycle-badge").className = `badge badge--${label === "Green" ? "green" : label === "Yellow" ? "yellow" : "running"}`;

    state.countdownTimer = setInterval(() => {
      state.countdownValue -= 1;
      $("#core-timer").textContent = `${Math.max(state.countdownValue, 0)}s`;
      if (state.countdownValue <= 0) {
        clearInterval(state.countdownTimer);
        resolve();
      }
    }, 1000);
  });
}

async function runSignalCycle(result) {
  const activeLanes = PHASE_LANES[result.active_phase];
  const primaryLane = activeLanes[0];

  state.signalState = "green";
  setSignalColor(primaryLane, "green");
  await startCountdown(Math.round(result.green_time), "Green");

  if (!state.autoRunning) {
    setSignalColor(null, "red");
    state.signalState = "idle";
    return;
  }

  state.signalState = "yellow";
  setSignalColor(primaryLane, "yellow");
  await startCountdown(result.yellow_time, "Yellow");

  setSignalColor(null, "red");
  state.signalState = "idle";
  $("#cycle-badge").textContent = "Idle";
  $("#cycle-badge").className = "badge";
}

async function manualCycle() {
  if (!state.laneCounts) return;
  try {
    showLoading("Computing next phase…");
    const result = await apiNextCycle();
    hideLoading();
    applyResult(result);
    await runSignalCycle(result);
    toast(`Phase ${result.active_phase} activated`, "success");
  } catch (err) {
    hideLoading();
    toast(err.message, "error");
  }
}

async function autoCycleLoop() {
  while (state.autoRunning) {
    try {
      const result = state.lastResult || (await apiNextCycle());
      if (!state.lastResult) applyResult(result);
      await runSignalCycle(result);
      if (!state.autoRunning) break;

      showLoading("Next cycle…");
      const next = await apiNextCycle();
      hideLoading();
      applyResult(next);
    } catch (err) {
      hideLoading();
      toast(err.message, "error");
      state.autoRunning = false;
      break;
    }
  }

  $("#auto-cycle-btn").innerHTML = '<i class="fa-solid fa-play"></i> Auto Cycle';
  $("#cycle-badge").textContent = "Idle";
}

function toggleAutoCycle() {
  if (state.autoRunning) {
    state.autoRunning = false;
    state.signalState = "idle";
    clearInterval(state.countdownTimer);
    $("#auto-cycle-btn").innerHTML = '<i class="fa-solid fa-play"></i> Auto Cycle';
    setSignalColor(null, "red");
    toast("Auto cycle stopped", "info");
    return;
  }

  state.autoRunning = true;
  $("#auto-cycle-btn").innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
  toast("Auto cycle started", "success");
  autoCycleLoop();
}

// ── Upload handling ───────────────────────────────────────────────────────

function setupUploadZones() {
  $$(".upload-zone").forEach((zone) => {
    const input = zone.querySelector("input");
    const preview = zone.querySelector(".upload-zone__preview");

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (e.dataTransfer.files[0]) {
        input.files = e.dataTransfer.files;
        showPreview(zone, input.files[0]);
      }
    });

    input.addEventListener("change", () => {
      if (input.files[0]) showPreview(zone, input.files[0]);
    });
  });
}

function showPreview(zone, file) {
  const preview = zone.querySelector(".upload-zone__preview");
  if (preview.dataset.objectUrl) {
    URL.revokeObjectURL(preview.dataset.objectUrl);
  }
  const url = URL.createObjectURL(file);
  preview.dataset.objectUrl = url;
  preview.src = url;
  preview.hidden = false;
  zone.classList.add("has-file");
}

async function handleAnalyze(e) {
  e.preventDefault();
  $("#upload-error").hidden = true;

  const form = $("#upload-form");
  const fd = new FormData(form);

  for (const lane of ["north", "south", "east", "west"]) {
    if (!fd.get(lane)?.size) {
      $("#upload-error").textContent = "Please upload all 4 lane images.";
      $("#upload-error").hidden = false;
      return;
    }
  }

  fd.append("min_green", state.settings.min_green);
  fd.append("max_green", state.settings.max_green);
  fd.append("threshold", state.settings.threshold);

  try {
    showLoading("Running YOLO detection on 4 lanes…");
    const result = await apiAnalyze(fd);
    hideLoading();
    applyResult(result);
    switchView("junction");
    toast("Analysis complete — junction ready", "success");
    await runSignalCycle(result);
  } catch (err) {
    hideLoading();
    $("#upload-error").textContent = err.message;
    $("#upload-error").hidden = false;
    toast(err.message, "error");
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

function bindEvents() {
  $$(".nav-item, .mobile-nav__item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  $("#topbar-architecture").addEventListener("click", () => switchView("architecture"));
  $("#theme-toggle").addEventListener("click", toggleTheme);

  $("#upload-form").addEventListener("submit", handleAnalyze);
  $("#manual-cycle-btn").addEventListener("click", manualCycle);
  $("#auto-cycle-btn").addEventListener("click", toggleAutoCycle);
  $("#quick-analyze-btn").addEventListener("click", () => switchView("detection"));

  $("#clear-uploads").addEventListener("click", () => {
    $$(".upload-zone").forEach((zone) => {
      zone.classList.remove("has-file");
      zone.querySelector("input").value = "";
      const preview = zone.querySelector(".upload-zone__preview");
      if (preview.dataset.objectUrl) {
        URL.revokeObjectURL(preview.dataset.objectUrl);
        delete preview.dataset.objectUrl;
      }
      preview.hidden = true;
      preview.src = "";
    });
  });

  $("#settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.settings.min_green = parseInt($("#min-green").value, 10);
    state.settings.max_green = parseInt($("#max-green").value, 10);
    state.settings.threshold = parseFloat($("#threshold").value);
    saveSettings();
    toast("Settings saved", "success");
  });

  $("#reset-btn").addEventListener("click", async () => {
    const ok = await confirmDialog("Reset junction state and clear session?");
    if (!ok) return;
    await apiReset();
    state.laneCounts = null;
    state.lastResult = null;
    state.autoRunning = false;
    clearInterval(state.countdownTimer);
    enableControls(false);
    setSignalColor(null, "red");
    $("#stat-total").textContent = "—";
    $("#stat-phase").textContent = "—";
    $("#stat-green").textContent = "—";
    toast("System reset", "info");
  });

  $("#filter-phase").addEventListener("change", () => {
    state.historyPage = 1;
    renderHistory();
  });

  $("#history-search").addEventListener("input", () => {
    state.historyPage = 1;
    renderHistory();
  });

  $("#search-clear").addEventListener("click", () => {
    $("#history-search").value = "";
    state.historyPage = 1;
    renderHistory();
    $("#history-search").focus();
  });

  $("#prev-page").addEventListener("click", () => {
    state.historyPage -= 1;
    renderHistory();
  });

  $("#next-page").addEventListener("click", () => {
    state.historyPage += 1;
    renderHistory();
  });
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error();
    $("#system-status").innerHTML = '<span class="status-pill__dot"></span><span>System Ready</span>';
  } catch {
    $("#system-status").innerHTML = '<span class="status-pill__dot" style="background:var(--danger)"></span><span>API Offline</span>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  hideLoading();
  loadTheme();
  loadSettings();
  loadHistory();
  setupUploadZones();
  bindEvents();
  checkHealth();
  renderHistory();
  renderActivity();
  $("#stat-cycles").textContent = state.cycleCount;
});
