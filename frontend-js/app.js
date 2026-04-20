import { ApiError, ApiService, inferDefaultApiBase, normalizeApiBase } from "./modules/api-service.js";
import {
  buildMachineSummaries,
  buildSeries,
  computeRiskDistribution,
  filterRowsByMachine,
  filterRowsByMinutes,
  renderAlerts,
  renderAnalyticsTable,
  renderConfidenceGauge,
  renderHeatmap,
  renderKpis,
  renderLeaderboard,
  renderMachineSelector,
  renderSystemStatus,
  uniqueMachineIds,
  riskClassName,
} from "./modules/dashboard-module.js";
import {
  createPieChart,
  createProbabilityChart,
  createSensorChart,
  toTimeLabel,
  updateLineSeries,
  updatePieChart,
} from "./modules/charts.js";
import {
  downloadResultsCsv,
  parseCsvFile,
  renderUploadResults,
  summarizeBatchResults,
  validateAndMapRows,
} from "./modules/upload-module.js";

const STORAGE_KEY = "pm_dashboard_config_v2";

const state = {
  history: [],
  selectedMachine: "all",
  analyticsMachine: "all",
  analyticsRange: "60",
  uploadRows: [],
  uploadResults: [],
  autoRefreshTimer: null,
  authRequired: false,
};

const viewTitles = {
  "live-monitoring": "Live Monitoring",
  "manual-prediction": "Manual Prediction",
  "upload-dataset": "Upload Dataset",
  "machine-analytics": "Machine Analytics",
};

const els = {
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  viewTitle: document.getElementById("viewTitle"),

  apiBaseInput: document.getElementById("apiBaseInput"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  showKeyToggle: document.getElementById("showKeyToggle"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  healthCheckBtn: document.getElementById("healthCheckBtn"),
  connectionBadge: document.getElementById("connectionBadge"),

  autoRefreshToggle: document.getElementById("autoRefreshToggle"),
  refreshIntervalSelect: document.getElementById("refreshIntervalSelect"),
  refreshNowBtn: document.getElementById("refreshNowBtn"),

  machineSelector: document.getElementById("machineSelector"),
  analyticsMachineSelect: document.getElementById("analyticsMachineSelect"),
  analyticsRangeSelect: document.getElementById("analyticsRangeSelect"),

  kpiTemperature: document.getElementById("kpiTemperature"),
  kpiVibration: document.getElementById("kpiVibration"),
  kpiPressure: document.getElementById("kpiPressure"),
  kpiProbability: document.getElementById("kpiProbability"),
  kpiRisk: document.getElementById("kpiRisk"),
  systemStatusLabel: document.getElementById("systemStatusLabel"),
  lastUpdateLabel: document.getElementById("lastUpdateLabel"),

  leaderboardList: document.getElementById("leaderboardList"),
  alertsList: document.getElementById("alertsList"),
  machineHeatmap: document.getElementById("machineHeatmap"),

  manualPredictionForm: document.getElementById("manualPredictionForm"),
  manualMachineId: document.getElementById("manualMachineId"),
  manualTemperature: document.getElementById("manualTemperature"),
  manualVibration: document.getElementById("manualVibration"),
  manualPressure: document.getElementById("manualPressure"),
  clearPredictionBtn: document.getElementById("clearPredictionBtn"),
  manualError: document.getElementById("manualError"),
  manualPredictionLabel: document.getElementById("manualPredictionLabel"),
  manualRiskLabel: document.getElementById("manualRiskLabel"),
  manualAdvisory: document.getElementById("manualAdvisory"),
  confidenceGauge: document.getElementById("confidenceGauge"),

  csvFileInput: document.getElementById("csvFileInput"),
  runBatchBtn: document.getElementById("runBatchBtn"),
  downloadResultsBtn: document.getElementById("downloadResultsBtn"),
  uploadStatus: document.getElementById("uploadStatus"),
  uploadError: document.getElementById("uploadError"),
  uploadTableBody: document.querySelector("#uploadTable tbody"),
  uploadSummary: document.getElementById("uploadSummary"),

  analyticsTableBody: document.querySelector("#analyticsTable tbody"),
  toast: document.getElementById("toast"),
};

const api = new ApiService();

const charts = {
  sensor: createSensorChart(document.getElementById("sensorChart")),
  probability: createProbabilityChart(document.getElementById("probabilityChart")),
  riskPie: createPieChart(document.getElementById("riskPieChart"), "Live Risk Distribution"),
  uploadRiskPie: createPieChart(document.getElementById("uploadRiskChart"), "Batch Risk Distribution"),
  analyticsSensor: createSensorChart(document.getElementById("analyticsSensorChart")),
  analyticsRisk: createProbabilityChart(document.getElementById("analyticsRiskChart"), "Analytics Failure Probability"),
};

function showToast(message, timeoutMs = 2400) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, timeoutMs);
}

function setConnectionBadge(type, message) {
  els.connectionBadge.textContent = message;
  els.connectionBadge.className = `status-badge ${type}`;
}

function loadConfig() {
  const fallback = {
    apiBase: inferDefaultApiBase(),
    apiKey: "",
    intervalMs: "4000",
    autoRefresh: true,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return {
      apiBase: normalizeApiBase(parsed.apiBase || fallback.apiBase),
      apiKey: String(parsed.apiKey || "").trim(),
      intervalMs: String(parsed.intervalMs || fallback.intervalMs),
      autoRefresh: parsed.autoRefresh !== false,
    };
  } catch (_error) {
    return fallback;
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function currentConfig() {
  return {
    apiBase: normalizeApiBase(els.apiBaseInput.value),
    apiKey: String(els.apiKeyInput.value || "").trim(),
    intervalMs: String(els.refreshIntervalSelect.value || "4000"),
    autoRefresh: Boolean(els.autoRefreshToggle.checked),
  };
}

function applyConfig(config) {
  els.apiBaseInput.value = config.apiBase;
  els.apiKeyInput.value = config.apiKey;
  els.refreshIntervalSelect.value = config.intervalMs;
  els.autoRefreshToggle.checked = config.autoRefresh;
  api.setConfig({ baseUrl: config.apiBase, apiKey: config.apiKey });
}

function setView(viewName) {
  els.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  els.views.forEach((view) => {
    view.classList.toggle("active", view.id === `view-${viewName}`);
  });
  els.viewTitle.textContent = viewTitles[viewName] || "Live Monitoring";
}

function configureAutoRefresh() {
  window.clearInterval(state.autoRefreshTimer);
  if (!els.autoRefreshToggle.checked) {
    return;
  }

  const intervalMs = Number(els.refreshIntervalSelect.value) || 4000;
  state.autoRefreshTimer = window.setInterval(() => {
    fetchHistoryAndRender();
  }, intervalMs);
}

function updateCommonSelectors(historyRows) {
  const machineIds = uniqueMachineIds(historyRows);
  renderMachineSelector(els.machineSelector, machineIds, state.selectedMachine);
  renderMachineSelector(els.analyticsMachineSelect, machineIds, state.analyticsMachine);

  state.selectedMachine = els.machineSelector.value;
  state.analyticsMachine = els.analyticsMachineSelect.value;
}

function getDisplayRowsForLive() {
  const filteredRows = filterRowsByMachine(state.history, state.selectedMachine);
  return filteredRows.length ? filteredRows : state.history;
}

function renderLiveView() {
  const displayRows = getDisplayRowsForLive();
  const latestRow = displayRows[0] || null;

  renderKpis(els, latestRow);
  renderSystemStatus(els.systemStatusLabel, latestRow);
  els.lastUpdateLabel.textContent = latestRow ? new Date(latestRow.timestamp).toLocaleString() : "--";

  const liveSeries = buildSeries(displayRows, 80);
  updateLineSeries(charts.sensor, liveSeries.labels, [liveSeries.temperature, liveSeries.vibration, liveSeries.pressure]);
  updateLineSeries(charts.probability, liveSeries.labels, [liveSeries.probability]);

  const distribution = computeRiskDistribution(displayRows.length ? displayRows : state.history);
  updatePieChart(charts.riskPie, distribution);

  const machineSummaries = buildMachineSummaries(state.history);
  renderLeaderboard(els.leaderboardList, machineSummaries, 8);
  renderAlerts(els.alertsList, state.history, 10);
  renderHeatmap(els.machineHeatmap, machineSummaries.slice(0, 12));
}

function renderAnalyticsView() {
  const machineFiltered = filterRowsByMachine(state.history, state.analyticsMachine);
  const rangeFiltered = filterRowsByMinutes(machineFiltered, state.analyticsRange);

  const analyticsSeries = buildSeries(rangeFiltered, 120);
  updateLineSeries(charts.analyticsSensor, analyticsSeries.labels, [
    analyticsSeries.temperature,
    analyticsSeries.vibration,
    analyticsSeries.pressure,
  ]);
  updateLineSeries(charts.analyticsRisk, analyticsSeries.labels, [analyticsSeries.probability]);

  renderAnalyticsTable(els.analyticsTableBody, rangeFiltered);
}

function applyManualPredictionResult(result) {
  const riskClass = riskClassName(result.risk_level);
  els.manualPredictionLabel.textContent = String(result.prediction);
  els.manualRiskLabel.textContent = String(result.risk_level || "--").toUpperCase();
  els.manualRiskLabel.className = `risk-chip ${riskClass}`;
  els.manualAdvisory.textContent = result.advisory || "No advisory available.";
  renderConfidenceGauge(els.confidenceGauge, Number(result.probability));
}

function resetManualPredictionResult() {
  els.manualPredictionLabel.textContent = "--";
  els.manualRiskLabel.textContent = "--";
  els.manualRiskLabel.className = "risk-chip";
  els.manualAdvisory.textContent = "--";
  renderConfidenceGauge(els.confidenceGauge, Number.NaN);
}

function renderUploadSummary(summary) {
  els.uploadSummary.innerHTML = `
    <p>Total rows: <strong>${summary.total}</strong></p>
    <p>Critical rows: <strong>${summary.critical}</strong></p>
    <p>Average probability: <strong>${(summary.avgProbability * 100).toFixed(1)}%</strong></p>
  `;
}

async function checkHealth() {
  try {
    const health = await api.health();
    const clientConfig = await api.clientConfig();
    state.authRequired = Boolean(clientConfig.auth_required);

    const authState = state.authRequired ? "auth required" : "auth open";
    const modelState = health.model_loaded ? health.model_source : "model unavailable";
    setConnectionBadge("ok", `${health.status.toUpperCase()} - ${modelState} - ${authState}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    setConnectionBadge("error", message);
    return false;
  }
}

async function fetchHistoryAndRender({ force = false } = {}) {
  if (state.authRequired && !api.apiKey) {
    if (force) {
      showToast("API key is required for this deployment.", 3200);
    }
    return;
  }

  try {
    const rows = await api.getHistory(400);
    state.history = Array.isArray(rows) ? rows : [];

    updateCommonSelectors(state.history);
    renderLiveView();
    renderAnalyticsView();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setConnectionBadge("error", "Unauthorized. Update API key.");
      showToast("Unauthorized. Save a valid API key.", 3400);
      return;
    }

    const message = error instanceof Error ? error.message : "Unable to fetch history.";
    showToast(message, 3200);
  }
}

async function onSaveSettings() {
  const config = currentConfig();
  applyConfig(config);
  saveConfig(config);

  const isHealthy = await checkHealth();
  if (isHealthy) {
    await fetchHistoryAndRender({ force: true });
  }
  configureAutoRefresh();
  showToast("Connection settings saved.");
}

async function onRunManualPrediction(event) {
  event.preventDefault();
  els.manualError.textContent = "";

  if (state.authRequired && !api.apiKey) {
    els.manualError.textContent = "API key is required for predictions.";
    return;
  }

  const payload = {
    machine_id: String(els.manualMachineId.value || "").trim(),
    temperature: Number(els.manualTemperature.value),
    vibration: Number(els.manualVibration.value),
    pressure: Number(els.manualPressure.value),
  };

  if (!payload.machine_id || [payload.temperature, payload.vibration, payload.pressure].some((value) => Number.isNaN(value))) {
    els.manualError.textContent = "Please provide valid numeric sensor values and machine ID.";
    return;
  }

  const submitButton = document.getElementById("runPredictionBtn");
  submitButton.disabled = true;
  submitButton.textContent = "Running...";

  try {
    const result = await api.predict(payload);
    applyManualPredictionResult(result);
    showToast(`Prediction complete for ${result.machine_id}.`);
    await fetchHistoryAndRender();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual prediction failed.";
    els.manualError.textContent = message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Run Prediction";
  }
}

async function onCsvSelected() {
  els.uploadError.textContent = "";
  state.uploadRows = [];
  state.uploadResults = [];
  els.downloadResultsBtn.disabled = true;
  renderUploadResults(els.uploadTableBody, []);
  renderUploadSummary({ total: 0, critical: 0, avgProbability: 0, distribution: { safe: 0, warning: 0, critical: 0 } });
  updatePieChart(charts.uploadRiskPie, { safe: 0, warning: 0, critical: 0 });

  const file = els.csvFileInput.files?.[0];
  if (!file) {
    els.uploadStatus.textContent = "No file selected.";
    els.runBatchBtn.disabled = true;
    return;
  }

  try {
    const parsed = await parseCsvFile(file);
    const { rows, invalidRows } = validateAndMapRows(parsed);
    state.uploadRows = rows;
    els.runBatchBtn.disabled = rows.length === 0;

    if (!rows.length) {
      els.uploadStatus.textContent = "No valid rows found in file.";
      return;
    }

    const invalidMessage = invalidRows.length
      ? `Ignored invalid rows: ${invalidRows.slice(0, 8).join(", ")}${invalidRows.length > 8 ? "..." : ""}.`
      : "All rows are valid.";

    els.uploadStatus.textContent = `Loaded ${rows.length} valid rows. ${invalidMessage}`;
    showToast(`Loaded ${rows.length} rows for batch prediction.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV parsing failed.";
    els.uploadError.textContent = message;
    els.uploadStatus.textContent = "No file selected.";
    els.runBatchBtn.disabled = true;
  }
}

async function onRunBatchPrediction() {
  els.uploadError.textContent = "";
  if (!state.uploadRows.length) {
    els.uploadError.textContent = "Upload and validate a CSV file before running batch prediction.";
    return;
  }

  if (state.authRequired && !api.apiKey) {
    els.uploadError.textContent = "API key is required for batch prediction.";
    return;
  }

  els.runBatchBtn.disabled = true;
  els.runBatchBtn.textContent = "Running...";

  try {
    const payload = await api.predictBatch(state.uploadRows, false);
    state.uploadResults = payload.results || [];

    renderUploadResults(els.uploadTableBody, state.uploadResults);

    const summary = summarizeBatchResults(state.uploadResults);
    renderUploadSummary(summary);
    updatePieChart(charts.uploadRiskPie, summary.distribution);

    els.downloadResultsBtn.disabled = state.uploadResults.length === 0;
    els.uploadStatus.textContent = `Batch prediction completed for ${summary.total} rows.`;
    showToast(`Batch prediction completed for ${summary.total} rows.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch prediction failed.";
    els.uploadError.textContent = message;
  } finally {
    els.runBatchBtn.disabled = false;
    els.runBatchBtn.textContent = "Run Batch Prediction";
  }
}

function onDownloadResults() {
  try {
    downloadResultsCsv(state.uploadResults);
    showToast("Batch results CSV downloaded.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    els.uploadError.textContent = message;
  }
}

function wireEvents() {
  els.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setView(item.dataset.view);
    });
  });

  els.showKeyToggle.addEventListener("change", () => {
    els.apiKeyInput.type = els.showKeyToggle.checked ? "text" : "password";
  });

  els.saveSettingsBtn.addEventListener("click", onSaveSettings);
  els.healthCheckBtn.addEventListener("click", checkHealth);

  els.refreshNowBtn.addEventListener("click", () => fetchHistoryAndRender({ force: true }));
  els.autoRefreshToggle.addEventListener("change", () => {
    saveConfig(currentConfig());
    configureAutoRefresh();
  });
  els.refreshIntervalSelect.addEventListener("change", () => {
    saveConfig(currentConfig());
    configureAutoRefresh();
  });

  els.machineSelector.addEventListener("change", () => {
    state.selectedMachine = els.machineSelector.value;
    renderLiveView();
  });

  els.analyticsMachineSelect.addEventListener("change", () => {
    state.analyticsMachine = els.analyticsMachineSelect.value;
    renderAnalyticsView();
  });

  els.analyticsRangeSelect.addEventListener("change", () => {
    state.analyticsRange = els.analyticsRangeSelect.value;
    renderAnalyticsView();
  });

  els.manualPredictionForm.addEventListener("submit", onRunManualPrediction);
  els.clearPredictionBtn.addEventListener("click", () => {
    els.manualPredictionForm.reset();
    els.manualMachineId.value = "M-001";
    els.manualTemperature.value = "78";
    els.manualVibration.value = "3.4";
    els.manualPressure.value = "35";
    els.manualError.textContent = "";
    resetManualPredictionResult();
  });

  els.csvFileInput.addEventListener("change", onCsvSelected);
  els.runBatchBtn.addEventListener("click", onRunBatchPrediction);
  els.downloadResultsBtn.addEventListener("click", onDownloadResults);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearInterval(state.autoRefreshTimer);
      return;
    }
    configureAutoRefresh();
    fetchHistoryAndRender();
  });
}

async function boot() {
  const config = loadConfig();
  applyConfig(config);
  setView("live-monitoring");
  wireEvents();

  resetManualPredictionResult();
  renderUploadSummary({ total: 0, critical: 0, avgProbability: 0, distribution: { safe: 0, warning: 0, critical: 0 } });
  updatePieChart(charts.uploadRiskPie, { safe: 0, warning: 0, critical: 0 });

  await checkHealth();
  await fetchHistoryAndRender({ force: true });
  configureAutoRefresh();
}

boot();
