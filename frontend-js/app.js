function inferDefaultApiBase() {
  try {
    const fromMeta = document.querySelector("meta[name='pm-api-base']")?.getAttribute("content");
    const normalizedMeta = normalizeApiBase(fromMeta);
    if (normalizedMeta) {
      return normalizedMeta;
    }

    const protocol = window.location.protocol || "";
    const host = window.location.host || "";
    if ((protocol === "http:" || protocol === "https:") && host) {
      return `${protocol}//${host}`;
    }
  } catch (_error) {
    // Ignore and use hosted fallback below.
  }
  return "https://predictive-maintenance-api.vercel.app";
}

const defaults = {
  apiBase: inferDefaultApiBase(),
  apiKey: "",
  historyLimit: 25,
  autoRefresh: true
};

const storageKey = "pm_js_frontend_config_v1";
const themeStorageKey = "pm_ui_theme_v1";
const densityStorageKey = "pm_ui_density_v1";
const onboardingStorageKey = "pm_ui_onboarding_v1";
const performanceProfileStorageKey = "pm_ui_performance_lite_v1";

const els = {
  apiBase: document.getElementById("apiBase"),
  apiKey: document.getElementById("apiKey"),
  showApiKey: document.getElementById("showApiKey"),
  saveConfig: document.getElementById("saveConfig"),
  checkHealth: document.getElementById("checkHealth"),
  toggleTheme: document.getElementById("toggleTheme"),
  toggleDensity: document.getElementById("toggleDensity"),
  openGuide: document.getElementById("openGuide"),
  themeChip: document.getElementById("themeChip"),
  healthStatus: document.getElementById("healthStatus"),
  predictForm: document.getElementById("predictForm"),
  machineId: document.getElementById("machineId"),
  temperature: document.getElementById("temperature"),
  vibration: document.getElementById("vibration"),
  pressure: document.getElementById("pressure"),
  formError: document.getElementById("formError"),
  latestRisk: document.getElementById("latestRisk"),
  latestProbability: document.getElementById("latestProbability"),
  latestMachine: document.getElementById("latestMachine"),
  heroPhrase: document.getElementById("heroPhrase"),
  liveClock: document.getElementById("liveClock"),
  signalStatus: document.getElementById("signalStatus"),
  riskCard: document.getElementById("riskCard"),
  probabilityCard: document.getElementById("probabilityCard"),
  riskSpark: document.getElementById("riskSpark"),
  probabilitySpark: document.getElementById("probabilitySpark"),
  temperatureSpark: document.getElementById("temperatureSpark"),
  pressureSpark: document.getElementById("pressureSpark"),
  tempPulseValue: document.getElementById("tempPulseValue"),
  vibrationPulseValue: document.getElementById("vibrationPulseValue"),
  pressurePulseValue: document.getElementById("pressurePulseValue"),
  tempPulseBar: document.getElementById("tempPulseBar"),
  vibrationPulseBar: document.getElementById("vibrationPulseBar"),
  pressurePulseBar: document.getElementById("pressurePulseBar"),
  historyCount: document.getElementById("historyCount"),
  historyLimit: document.getElementById("historyLimit"),
  lastUpdated: document.getElementById("lastUpdated"),
  filterButtons: document.querySelectorAll(".filter-btn"),
  scenarioButtons: document.querySelectorAll(".scenario-btn"),
  historyTableBody: document.querySelector("#historyTable tbody"),
  autoRefresh: document.getElementById("autoRefresh"),
  refreshHistory: document.getElementById("refreshHistory"),
  onboardingOverlay: document.getElementById("onboardingOverlay"),
  onboardingStepCount: document.getElementById("onboardingStepCount"),
  onboardingTitle: document.getElementById("onboardingTitle"),
  onboardingBody: document.getElementById("onboardingBody"),
  onboardingClose: document.getElementById("onboardingClose"),
  onboardingNext: document.getElementById("onboardingNext"),
  toast: document.getElementById("toast"),
  riskChart: document.getElementById("riskChart")
};

let chart;
let refreshTimer;
let clockTimer;
let phraseTimer;
let historyCache = [];
let activeRiskFilter = "all";
let authRequired = false;
let authBlocked = false;
let tableNotice = "";
let historyRequestInFlight = false;
let lastHistorySignature = "";
let phraseIndex = 0;
let activeTheme = "day";
let activeDensity = "comfortable";
let onboardingStepIndex = 0;
let ambientPointerRaf = 0;
let performanceLite = false;

const onboardingSteps = [
  {
    title: "Welcome to your control center",
    body: "Track machine health, failure risk, and operating signals from one live dashboard."
  },
  {
    title: "Use prediction presets",
    body: "Run low, medium, and high-risk scenarios to validate alert behavior and model sensitivity."
  },
  {
    title: "Read trends at a glance",
    body: "Risk zones and mini sparklines help you catch direction changes before they become incidents."
  },
  {
    title: "Tune your view",
    body: "Switch day/night themes, toggle compact density, and keep auto-refresh enabled for live operations."
  }
];

const riskZonePlugin = {
  id: "riskZones",
  beforeDraw(chartInstance) {
    const { ctx, chartArea, scales } = chartInstance;
    if (!chartArea || !scales?.y) {
      return;
    }

    const yScale = scales.y;
    const top = chartArea.top;
    const bottom = chartArea.bottom;
    const left = chartArea.left;
    const width = chartArea.right - chartArea.left;
    const safeCutoff = yScale.getPixelForValue(0.3);
    const warningCutoff = yScale.getPixelForValue(0.7);

    ctx.save();
    ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
    ctx.fillRect(left, safeCutoff, width, bottom - safeCutoff);
    ctx.fillStyle = "rgba(245, 158, 11, 0.08)";
    ctx.fillRect(left, warningCutoff, width, safeCutoff - warningCutoff);
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(left, top, width, warningCutoff - top);

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(120, 146, 184, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, safeCutoff);
    ctx.lineTo(chartArea.right, safeCutoff);
    ctx.moveTo(left, warningCutoff);
    ctx.lineTo(chartArea.right, warningCutoff);
    ctx.stroke();
    ctx.restore();
  }
};

const heroPhrases = [
  "Failure probability",
  "Thermal drift",
  "Anomaly hotspots",
  "Maintenance readiness"
];

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getPreferredTheme() {
  try {
    return localStorage.getItem(themeStorageKey) || "day";
  } catch (_error) {
    return "day";
  }
}

function isLowPowerDevice() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memory = Number(navigator.deviceMemory || 0);
  return prefersReduced || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
}

function getPerformancePreference() {
  try {
    const stored = localStorage.getItem(performanceProfileStorageKey);
    if (stored === "on") {
      return true;
    }
    if (stored === "off") {
      return false;
    }
  } catch (_error) {
    // Fall through to auto-detection.
  }
  return isLowPowerDevice();
}

function applyPerformanceProfile(isLite) {
  performanceLite = Boolean(isLite);
  if (performanceLite) {
    document.body.setAttribute("data-performance", "lite");
  } else {
    document.body.removeAttribute("data-performance");
  }

  try {
    localStorage.setItem(performanceProfileStorageKey, performanceLite ? "on" : "off");
  } catch (_error) {
    // Persistence is optional.
  }

  if (chart) {
    chart.data.datasets[0].fill = !performanceLite;
    chart.data.datasets[0].pointRadius = performanceLite ? 0 : 2.2;
    chart.data.datasets[0].pointHoverRadius = performanceLite ? 0 : 4;
    chart.update("none");
  }
}

function getPreferredDensity() {
  try {
    return localStorage.getItem(densityStorageKey) || "comfortable";
  } catch (_error) {
    return "comfortable";
  }
}

function applyDensity(density) {
  activeDensity = density === "compact" ? "compact" : "comfortable";
  if (activeDensity === "compact") {
    document.body.setAttribute("data-density", "compact");
  } else {
    document.body.removeAttribute("data-density");
  }
  if (els.toggleDensity) {
    els.toggleDensity.textContent = activeDensity === "compact" ? "Comfort" : "Compact";
  }
  try {
    localStorage.setItem(densityStorageKey, activeDensity);
  } catch (_error) {
    // Density preference persistence is optional.
  }
}

function shouldShowOnboarding() {
  try {
    return localStorage.getItem(onboardingStorageKey) !== "done";
  } catch (_error) {
    return true;
  }
}

function setOnboardingDone() {
  try {
    localStorage.setItem(onboardingStorageKey, "done");
  } catch (_error) {
    // Onboarding persistence is optional.
  }
}

function updateOnboardingStep() {
  if (!els.onboardingTitle || !els.onboardingBody || !els.onboardingStepCount || !els.onboardingNext) {
    return;
  }
  const step = onboardingSteps[onboardingStepIndex] || onboardingSteps[0];
  els.onboardingTitle.textContent = step.title;
  els.onboardingBody.textContent = step.body;
  els.onboardingStepCount.textContent = `Step ${onboardingStepIndex + 1}/${onboardingSteps.length}`;
  els.onboardingNext.textContent = onboardingStepIndex >= onboardingSteps.length - 1 ? "Finish" : "Next";
}

function openOnboarding(fromStart = false) {
  if (!els.onboardingOverlay) {
    return;
  }
  if (fromStart) {
    onboardingStepIndex = 0;
  }
  updateOnboardingStep();
  els.onboardingOverlay.classList.add("is-open");
  els.onboardingOverlay.setAttribute("aria-hidden", "false");
}

function closeOnboarding(markSeen = true) {
  if (!els.onboardingOverlay) {
    return;
  }
  els.onboardingOverlay.classList.remove("is-open");
  els.onboardingOverlay.setAttribute("aria-hidden", "true");
  if (markSeen) {
    setOnboardingDone();
  }
}

function advanceOnboarding() {
  if (onboardingStepIndex >= onboardingSteps.length - 1) {
    closeOnboarding(true);
    return;
  }
  onboardingStepIndex += 1;
  updateOnboardingStep();
}

function applyTheme(theme) {
  activeTheme = theme === "night" ? "night" : "day";
  document.body.setAttribute("data-theme", activeTheme);

  if (els.themeChip) {
    els.themeChip.textContent = activeTheme === "night" ? "Night mode" : "Day mode";
  }
  if (els.toggleTheme) {
    els.toggleTheme.textContent = activeTheme === "night" ? "Day" : "Night";
  }

  try {
    localStorage.setItem(themeStorageKey, activeTheme);
  } catch (_error) {
    // Theme persistence is optional.
  }

  if (chart) {
    const isNight = activeTheme === "night";
    const grid = isNight ? "rgba(86, 126, 179, 0.24)" : "rgba(148, 163, 184, 0.28)";
    const labels = isNight ? "#9fbce4" : "#475569";
    const xLabels = isNight ? "#88abd9" : "#64748b";
    chart.options.scales.y.grid.color = grid;
    chart.options.scales.y.ticks.color = labels;
    chart.options.scales.x.grid.color = isNight ? "rgba(86, 126, 179, 0.18)" : "rgba(148, 163, 184, 0.18)";
    chart.options.scales.x.ticks.color = xLabels;
    chart.options.plugins.legend.labels.color = isNight ? "#c5dbff" : "#334155";
    chart.update("none");
  }
}

function pulseCards() {
  if (performanceLite || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  [els.riskCard, els.probabilityCard].forEach((card) => {
    if (!card) {
      return;
    }
    card.classList.remove("is-breathing");
    // Force reflow so animation restarts.
    void card.offsetWidth;
    card.classList.add("is-breathing");
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function animateNumber(element, toValue, options = {}) {
  if (!element || Number.isNaN(toValue)) {
    return;
  }

  const { duration = 420, formatter = (value) => String(value) } = options;
  const fromValue = Number(element.dataset.value || 0);
  const start = performance.now();

  const frame = (timestamp) => {
    const progress = clamp((timestamp - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = fromValue + (toValue - fromValue) * eased;
    element.textContent = formatter(value);
    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }
    element.dataset.value = String(toValue);
  };

  requestAnimationFrame(frame);
}

function tickClock() {
  if (!els.liveClock) {
    return;
  }
  const now = new Date();
  els.liveClock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function cycleHeroPhrase() {
  if (!els.heroPhrase) {
    return;
  }
  phraseIndex = (phraseIndex + 1) % heroPhrases.length;
  els.heroPhrase.textContent = heroPhrases[phraseIndex];
}

function initializeAmbientPointer() {
  const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!supportsFinePointer || reducedMotion || performanceLite) {
    return;
  }

  let latestEvent;
  document.addEventListener(
    "pointermove",
    (event) => {
      latestEvent = event;
      if (ambientPointerRaf) {
        return;
      }
      ambientPointerRaf = window.requestAnimationFrame(() => {
        ambientPointerRaf = 0;
        if (!latestEvent) {
          return;
        }
        const x = `${Math.round((latestEvent.clientX / window.innerWidth) * 100)}%`;
        const y = `${Math.round((latestEvent.clientY / window.innerHeight) * 100)}%`;
        document.documentElement.style.setProperty("--mx", x);
        document.documentElement.style.setProperty("--my", y);
      });
    },
    { passive: true }
  );
}

function startLiveUiTimers() {
  stopLiveUiTimers();
  tickClock();
  clockTimer = window.setInterval(tickClock, 1000);
  phraseTimer = window.setInterval(cycleHeroPhrase, 3200);
}

function stopLiveUiTimers() {
  window.clearInterval(clockTimer);
  window.clearInterval(phraseTimer);
}

function setPulseState(latest) {
  const temperature = Number(latest.temperature);
  const vibration = Number(latest.vibration);
  const pressure = Number(latest.pressure);

  els.tempPulseValue.textContent = `${temperature.toFixed(1)} C`;
  els.vibrationPulseValue.textContent = `${vibration.toFixed(2)} mm/s`;
  els.pressurePulseValue.textContent = `${pressure.toFixed(1)} psi`;

  const tempWidth = clamp((temperature / 140) * 100, 0, 100);
  const vibrationWidth = clamp((vibration / 12) * 100, 0, 100);
  const pressureWidth = clamp((pressure / 120) * 100, 0, 100);

  els.tempPulseBar.style.width = `${tempWidth}%`;
  els.vibrationPulseBar.style.width = `${vibrationWidth}%`;
  els.pressurePulseBar.style.width = `${pressureWidth}%`;
}

function clearPulseState() {
  els.tempPulseValue.textContent = "--";
  els.vibrationPulseValue.textContent = "--";
  els.pressurePulseValue.textContent = "--";
  els.tempPulseBar.style.width = "0%";
  els.vibrationPulseBar.style.width = "0%";
  els.pressurePulseBar.style.width = "0%";
}

function toSparklinePoints(series) {
  if (!series.length) {
    return "";
  }
  const width = 120;
  const height = 24;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series
    .map((value, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * width;
      const normalized = (value - min) / span;
      const y = height - normalized * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function mapRiskValue(risk) {
  const lowered = normalizeRisk(risk);
  if (lowered === "safe") {
    return 0.2;
  }
  if (lowered === "warning") {
    return 0.55;
  }
  return 0.9;
}

function seriesFromHistory(history, accessor, maxPoints = 18) {
  const sampled = history.slice(0, maxPoints).reverse();
  return sampled
    .map(accessor)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function renderMiniSparklines(history) {
  const riskSeries = seriesFromHistory(history, (item) => mapRiskValue(item.risk_level));
  const probabilitySeries = seriesFromHistory(history, (item) => item.probability);
  const temperatureSeries = seriesFromHistory(history, (item) => item.temperature);
  const pressureSeries = seriesFromHistory(history, (item) => item.pressure);

  if (els.riskSpark) {
    els.riskSpark.setAttribute("points", toSparklinePoints(riskSeries));
  }
  if (els.probabilitySpark) {
    els.probabilitySpark.setAttribute("points", toSparklinePoints(probabilitySeries));
  }
  if (els.temperatureSpark) {
    els.temperatureSpark.setAttribute("points", toSparklinePoints(temperatureSeries));
  }
  if (els.pressureSpark) {
    els.pressureSpark.setAttribute("points", toSparklinePoints(pressureSeries));
  }
}

function queryApiBaseOverride() {
  try {
    const queryValue = new URLSearchParams(window.location.search).get("apiBase");
    return normalizeApiBase(queryValue);
  } catch (_error) {
    return "";
  }
}

function hasConfiguredApiKey(config) {
  return Boolean((config.apiKey || "").trim());
}

function isProtectedAccessAllowed(config) {
  return !authRequired || hasConfiguredApiKey(config);
}

function setTableNotice(message) {
  tableNotice = message || "";
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { ...defaults };
    }
    const parsed = JSON.parse(raw);
    return {
      apiBase: parsed.apiBase || defaults.apiBase,
      apiKey: parsed.apiKey || defaults.apiKey,
      historyLimit: Number(parsed.historyLimit) || defaults.historyLimit,
      autoRefresh: parsed.autoRefresh !== false
    };
  } catch (_error) {
    return { ...defaults };
  }
}

function saveConfig(config) {
  localStorage.setItem(storageKey, JSON.stringify(config));
}

function currentConfig() {
  return {
    apiBase: normalizeApiBase(els.apiBase.value),
    apiKey: (els.apiKey.value || "").trim(),
    historyLimit: Number(els.historyLimit.value) || defaults.historyLimit,
    autoRefresh: els.autoRefresh.checked
  };
}

function renderConfig(config) {
  els.apiBase.value = config.apiBase;
  els.apiKey.value = config.apiKey;
  els.historyLimit.value = String(config.historyLimit);
  els.autoRefresh.checked = config.autoRefresh;
}

function headers(config) {
  const requestHeaders = { "Content-Type": "application/json" };
  if (config.apiKey) {
    requestHeaders["X-API-Key"] = config.apiKey;
  }
  return requestHeaders;
}

function normalizeRisk(riskValue) {
  return String(riskValue || "").toLowerCase();
}

function updateLastUpdated(date = new Date()) {
  const stamp = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  els.lastUpdated.textContent = `Last update: ${stamp}`;
}

function filterHistory(history) {
  if (activeRiskFilter === "all") {
    return history;
  }
  return history.filter((row) => normalizeRisk(row.risk_level) === activeRiskFilter);
}

function setFilterButtonState() {
  els.filterButtons.forEach((button) => {
    const isActive = button.dataset.riskFilter === activeRiskFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyScenario(name) {
  const scenarios = {
    safe: { machine: "M-101", temperature: 66.2, vibration: 1.1, pressure: 28.4 },
    warning: { machine: "M-204", temperature: 85.5, vibration: 4.2, pressure: 36.1 },
    critical: { machine: "M-305", temperature: 107.8, vibration: 8.9, pressure: 44.7 }
  };

  const scenario = scenarios[name];
  if (!scenario) {
    return;
  }

  els.machineId.value = scenario.machine;
  els.temperature.value = String(scenario.temperature);
  els.vibration.value = String(scenario.vibration);
  els.pressure.value = String(scenario.pressure);
  showToast(`${name.toUpperCase()} preset applied`);
}

function setHealthStatus(kind, text) {
  els.healthStatus.textContent = text;
  els.healthStatus.className = "status-pill";
  if (kind === "ok") {
    els.healthStatus.classList.add("status-ok");
    if (els.signalStatus) {
      els.signalStatus.textContent = "Connection stable and streaming";
    }
  } else if (kind === "error") {
    els.healthStatus.classList.add("status-error");
    if (els.signalStatus) {
      els.signalStatus.textContent = "Backend not reachable";
    }
  } else {
    els.healthStatus.classList.add("status-unknown");
    if (els.signalStatus) {
      els.signalStatus.textContent = "Verifying backend health";
    }
  }
}

function showToast(text, ms = 2200) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, ms);
}

async function checkHealth() {
  const config = currentConfig();
  if (!config.apiBase) {
    setHealthStatus("error", "Missing API base URL");
    return;
  }

  setHealthStatus("unknown", "Checking backend...");
  try {
    const response = await fetch(`${config.apiBase}/`, {
      method: "GET",
      headers: headers(config)
    });
    if (!response.ok) {
      throw new Error(`Health check failed (${response.status})`);
    }
    const payload = await response.json();
    try {
      const clientConfigResponse = await fetch(`${config.apiBase}/client-config`, {
        method: "GET",
        headers: headers(config)
      });
      if (clientConfigResponse.ok) {
        const clientConfig = await clientConfigResponse.json();
        authRequired = Boolean(clientConfig.auth_required);
      }
    } catch (_error) {
      // Keep previous auth requirement state when metadata endpoint is unavailable.
    }
    const model = payload.model_loaded ? "model ready" : "model unavailable";
    const authStatus = authRequired ? "auth required" : "auth open";
    setHealthStatus("ok", `${payload.status.toUpperCase()} - ${model} - ${authStatus}`);

    if (authRequired && !hasConfiguredApiKey(config)) {
      setTableNotice("API key required. Add key in API panel and click Save.");
      renderCards([]);
      renderTable([]);
    }
  } catch (error) {
    setHealthStatus("error", String(error.message || error));
  }
}

function riskClass(risk) {
  const lowered = String(risk || "").toLowerCase();
  if (lowered === "safe") {
    return "risk-safe";
  }
  if (lowered === "warning") {
    return "risk-warning";
  }
  return "risk-critical";
}

function renderTable(history) {
  const filteredHistory = filterHistory(history);
  if (!filteredHistory.length) {
    const emptyMessage = activeRiskFilter === "all"
      ? (tableNotice || "No data yet")
      : `No ${activeRiskFilter.toUpperCase()} records in current range`;
    els.historyTableBody.innerHTML = `<tr><td colspan="7">${emptyMessage}</td></tr>`;
    return;
  }

  const rows = filteredHistory.map((item) => {
    const risk = String(item.risk_level || "unknown").toUpperCase();
    const time = new Date(item.timestamp).toLocaleString();
    return `
      <tr>
        <td>${time}</td>
        <td>${item.machine_id}</td>
        <td>${Number(item.temperature).toFixed(1)}</td>
        <td>${Number(item.vibration).toFixed(2)}</td>
        <td>${Number(item.pressure).toFixed(1)}</td>
        <td>${(Number(item.probability) * 100).toFixed(1)}%</td>
        <td><span class="risk-badge ${riskClass(item.risk_level)}">${risk}</span></td>
      </tr>
    `;
  });

  els.historyTableBody.innerHTML = rows.join("");
}

function renderCards(history) {
  animateNumber(els.historyCount, history.length, {
    formatter: (value) => String(Math.round(value))
  });
  els.riskCard.className = "stat-card";
  els.probabilityCard.className = "stat-card";

  if (!history.length) {
    els.latestRisk.textContent = "--";
    els.latestProbability.textContent = "--";
    els.latestMachine.textContent = "--";
    clearPulseState();
    renderMiniSparklines([]);
    if (els.signalStatus) {
      els.signalStatus.textContent = "Awaiting first telemetry frame";
    }
    return;
  }

  const latest = history[0];
  const latestRisk = normalizeRisk(latest.risk_level);
  const latestProbability = Number(latest.probability);
  els.latestRisk.textContent = String(latest.risk_level || "unknown").toUpperCase();
  animateNumber(els.latestProbability, latestProbability * 100, {
    formatter: (value) => `${value.toFixed(1)}%`
  });
  els.latestMachine.textContent = latest.machine_id;
  setPulseState(latest);

  if (els.signalStatus) {
    els.signalStatus.textContent = `Latest ${latest.machine_id} frame classified as ${String(latest.risk_level || "unknown").toUpperCase()}`;
  }
  pulseCards();

  if (latestRisk === "safe") {
    els.riskCard.classList.add("card-risk-safe");
  } else if (latestRisk === "warning") {
    els.riskCard.classList.add("card-risk-warning");
  } else if (latestRisk) {
    els.riskCard.classList.add("card-risk-critical");
  }

  if (latestProbability >= 0.7) {
    els.probabilityCard.classList.add("card-prob-critical");
  } else if (latestProbability >= 0.35) {
    els.probabilityCard.classList.add("card-prob-warning");
  }

  renderMiniSparklines(history);
}

function historySignature(history) {
  if (!history.length) {
    return "0";
  }
  const first = history[0];
  return `${history.length}|${first.timestamp}|${first.machine_id}|${Number(first.probability).toFixed(4)}|${String(first.risk_level || "")}`;
}

function initChart() {
  const ctx = els.riskChart.getContext("2d");
  chart = new Chart(ctx, {
    plugins: [riskZonePlugin],
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Failure Probability",
          data: [],
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.18)",
          fill: !performanceLite,
          tension: 0.24,
          pointRadius: performanceLite ? 0 : 2.2,
          pointHoverRadius: performanceLite ? 0 : 4
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 1,
          grid: { color: "rgba(148, 163, 184, 0.28)" },
          ticks: {
            color: "#475569",
            callback(value) {
              return `${Math.round(value * 100)}%`;
            }
          }
        },
        x: {
          grid: { color: "rgba(148, 163, 184, 0.18)" },
          ticks: {
            color: "#64748b",
            maxTicksLimit: 8
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#334155",
            font: { family: "Space Mono" }
          }
        }
      }
    }
  });
}

function renderChart(history) {
  if (!chart) {
    initChart();
  }
  const reversed = [...history].reverse();
  const latestRisk = normalizeRisk(history[0]?.risk_level);
  if (latestRisk === "critical") {
    chart.data.datasets[0].borderColor = "#cf3344";
    chart.data.datasets[0].backgroundColor = "rgba(207, 51, 68, 0.2)";
  } else if (latestRisk === "warning") {
    chart.data.datasets[0].borderColor = "#d98b16";
    chart.data.datasets[0].backgroundColor = "rgba(217, 139, 22, 0.18)";
  } else {
    chart.data.datasets[0].borderColor = activeTheme === "night" ? "#66b2ff" : "#2563eb";
    chart.data.datasets[0].backgroundColor = activeTheme === "night" ? "rgba(102, 178, 255, 0.2)" : "rgba(37, 99, 235, 0.18)";
  }
  chart.data.labels = reversed.map((item) => {
    const d = new Date(item.timestamp);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  });
  chart.data.datasets[0].data = reversed.map((item) => Number(item.probability));
  chart.update("none");
}

async function fetchHistory(options = {}) {
  const { force = false } = options;
  if (historyRequestInFlight && !force) {
    return;
  }

  const config = currentConfig();
  if (!config.apiBase) {
    showToast("Set API base URL first");
    return;
  }

  if (authBlocked && !force) {
    setTableNotice("Access blocked by invalid API key. Update key and click Save.");
    renderCards([]);
    renderTable([]);
    return;
  }

  if (!isProtectedAccessAllowed(config)) {
    setTableNotice("API key required. Add key in API panel and click Save.");
    renderCards([]);
    renderTable([]);
    return;
  }

  historyRequestInFlight = true;
  els.refreshHistory.disabled = true;
  try {
    const response = await fetch(`${config.apiBase}/history?limit=${config.historyLimit}`, {
      method: "GET",
      headers: headers(config)
    });
    if (!response.ok) {
      if (response.status === 401) {
        authBlocked = true;
        setTableNotice("Unauthorized. Update API key in API panel and click Save.");
        renderCards([]);
        renderTable([]);
        configureAutoRefresh();
        showToast("Unauthorized. Update API key and click Save.", 3400);
        return;
      }
      throw new Error(`History request failed (${response.status})`);
    }
    const history = await response.json();
    authBlocked = false;
    setTableNotice("");
    const signature = historySignature(history);
    if (!force && signature === lastHistorySignature) {
      updateLastUpdated();
      return;
    }
    lastHistorySignature = signature;
    historyCache = history;
    renderCards(historyCache);
    if (performanceLite) {
      const renderHeavy = () => {
        renderTable(historyCache);
        renderChart(historyCache);
      };
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(renderHeavy, { timeout: 180 });
      } else {
        window.setTimeout(renderHeavy, 0);
      }
    } else {
      renderTable(historyCache);
      renderChart(historyCache);
    }
    updateLastUpdated();
  } catch (error) {
    showToast(String(error.message || error), 3400);
  } finally {
    els.refreshHistory.disabled = false;
    historyRequestInFlight = false;
  }
}

async function submitPrediction(event) {
  event.preventDefault();
  els.formError.textContent = "";

  const config = currentConfig();
  if (!config.apiBase) {
    els.formError.textContent = "API base URL is required.";
    return;
  }

  if (!isProtectedAccessAllowed(config)) {
    els.formError.textContent = "API key is required for this deployment.";
    return;
  }

  const payload = {
    machine_id: els.machineId.value.trim(),
    temperature: Number(els.temperature.value),
    vibration: Number(els.vibration.value),
    pressure: Number(els.pressure.value)
  };

  if (!payload.machine_id || Number.isNaN(payload.temperature) || Number.isNaN(payload.vibration) || Number.isNaN(payload.pressure)) {
    els.formError.textContent = "Please fill all fields with valid numeric values.";
    return;
  }

  const submitBtn = document.getElementById("submitPrediction");
  submitBtn.disabled = true;
  submitBtn.textContent = "Running...";

  try {
    const response = await fetch(`${config.apiBase}/predict`, {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401) {
        authBlocked = true;
        configureAutoRefresh();
      }
      const detail = await response.json().catch(() => ({}));
      const message = detail.detail || `Prediction failed (${response.status})`;
      throw new Error(message);
    }

    const result = await response.json();
    showToast(`Prediction complete: ${String(result.risk_level).toUpperCase()} (${(Number(result.probability) * 100).toFixed(1)}%)`);
    await fetchHistory();
  } catch (error) {
    els.formError.textContent = String(error.message || error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Run Prediction";
  }
}

function configureAutoRefresh() {
  window.clearInterval(refreshTimer);
  const config = currentConfig();
  if (!els.autoRefresh.checked) {
    return;
  }
  if (document.hidden) {
    return;
  }
  if (!isProtectedAccessAllowed(config) || authBlocked) {
    return;
  }
  refreshTimer = window.setInterval(() => {
    fetchHistory();
  }, 15000);
}

function wireEvents() {
  els.saveConfig.addEventListener("click", async () => {
    const config = currentConfig();
    authBlocked = false;
    saveConfig(config);
    showToast("Configuration saved");
    await checkHealth();
    await fetchHistory({ force: true });
    configureAutoRefresh();
  });

  els.checkHealth.addEventListener("click", checkHealth);
  if (els.toggleTheme) {
    els.toggleTheme.addEventListener("click", () => {
      applyTheme(activeTheme === "night" ? "day" : "night");
    });
  }
  if (els.toggleDensity) {
    els.toggleDensity.addEventListener("click", () => {
      applyDensity(activeDensity === "compact" ? "comfortable" : "compact");
    });
  }
  if (els.openGuide) {
    els.openGuide.addEventListener("click", () => {
      onboardingStepIndex = 0;
      openOnboarding();
    });
  }
  if (els.onboardingClose) {
    els.onboardingClose.addEventListener("click", () => closeOnboarding(true));
  }
  if (els.onboardingNext) {
    els.onboardingNext.addEventListener("click", advanceOnboarding);
  }
  if (els.onboardingOverlay) {
    els.onboardingOverlay.addEventListener("click", (event) => {
      if (event.target === els.onboardingOverlay) {
        closeOnboarding(true);
      }
    });
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.onboardingOverlay?.classList.contains("is-open")) {
      closeOnboarding(true);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLiveUiTimers();
      window.clearInterval(refreshTimer);
      return;
    }
    startLiveUiTimers();
    configureAutoRefresh();
    fetchHistory();
  });
  els.predictForm.addEventListener("submit", submitPrediction);
  els.refreshHistory.addEventListener("click", () => fetchHistory({ force: true }));
  els.historyLimit.addEventListener("change", async () => {
    authBlocked = false;
    saveConfig(currentConfig());
    await fetchHistory({ force: true });
  });
  els.autoRefresh.addEventListener("change", () => {
    saveConfig(currentConfig());
    configureAutoRefresh();
  });

  els.showApiKey.addEventListener("change", () => {
    els.apiKey.type = els.showApiKey.checked ? "text" : "password";
  });

  els.scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyScenario(button.dataset.scenario);
    });
  });

  els.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeRiskFilter = button.dataset.riskFilter || "all";
      setFilterButtonState();
      renderTable(historyCache);
    });
  });
}

async function boot() {
  const config = loadConfig();
  const apiBaseOverride = queryApiBaseOverride();
  if (apiBaseOverride) {
    config.apiBase = apiBaseOverride;
    saveConfig(config);
  }

  renderConfig(config);
  applyPerformanceProfile(getPerformancePreference());
  applyTheme(getPreferredTheme());
  applyDensity(getPreferredDensity());
  initializeAmbientPointer();
  startLiveUiTimers();
  setFilterButtonState();
  wireEvents();
  await checkHealth();
  await fetchHistory({ force: true });
  configureAutoRefresh();

  if (shouldShowOnboarding()) {
    openOnboarding(true);
  }
}

boot();
