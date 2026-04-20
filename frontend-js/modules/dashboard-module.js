import { toTimeLabel } from "./charts.js";

export function normalizeRisk(riskValue) {
  const value = String(riskValue || "").toLowerCase();
  if (value === "safe" || value === "warning" || value === "critical") {
    return value;
  }
  return "warning";
}

export function riskClassName(riskValue) {
  const risk = normalizeRisk(riskValue);
  return `risk-${risk}`;
}

export function computeRiskDistribution(rows) {
  const distribution = { safe: 0, warning: 0, critical: 0 };
  rows.forEach((row) => {
    distribution[normalizeRisk(row.risk_level)] += 1;
  });
  return distribution;
}

export function uniqueMachineIds(rows) {
  const values = new Set();
  rows.forEach((row) => values.add(String(row.machine_id || "UNKNOWN")));
  return Array.from(values).sort();
}

export function renderMachineSelector(selectElement, machineIds, selectedValue = "all") {
  const currentValue = selectedValue || "all";
  const options = [
    "<option value=\"all\">All machines</option>",
    ...machineIds.map((machineId) => `<option value=\"${machineId}\">${machineId}</option>`),
  ];
  selectElement.innerHTML = options.join("");
  selectElement.value = machineIds.includes(currentValue) ? currentValue : "all";
}

export function buildMachineSummaries(rows) {
  const machineMap = new Map();
  rows.forEach((row) => {
    const machineId = String(row.machine_id || "UNKNOWN");
    if (!machineMap.has(machineId)) {
      machineMap.set(machineId, {
        machine_id: machineId,
        probabilitySum: 0,
        records: 0,
        latest_temperature: Number(row.temperature) || 0,
        latest_vibration: Number(row.vibration) || 0,
        latest_pressure: Number(row.pressure) || 0,
        latest_probability: Number(row.probability) || 0,
      });
    }

    const summary = machineMap.get(machineId);
    summary.probabilitySum += Number(row.probability) || 0;
    summary.records += 1;

    if (!summary.lastTimestamp || new Date(row.timestamp) > new Date(summary.lastTimestamp)) {
      summary.lastTimestamp = row.timestamp;
      summary.latest_temperature = Number(row.temperature) || 0;
      summary.latest_vibration = Number(row.vibration) || 0;
      summary.latest_pressure = Number(row.pressure) || 0;
      summary.latest_probability = Number(row.probability) || 0;
    }
  });

  return Array.from(machineMap.values())
    .map((summary) => ({
      ...summary,
      avg_probability: summary.records ? summary.probabilitySum / summary.records : 0,
      risk_level: normalizeRisk(summary.latest_probability >= 0.7 ? "critical" : summary.latest_probability >= 0.3 ? "warning" : "safe"),
    }))
    .sort((a, b) => b.avg_probability - a.avg_probability);
}

export function renderKpis(elements, latestRow) {
  if (!latestRow) {
    elements.kpiTemperature.textContent = "--";
    elements.kpiVibration.textContent = "--";
    elements.kpiPressure.textContent = "--";
    elements.kpiProbability.textContent = "--";
    elements.kpiRisk.textContent = "--";
    elements.kpiRisk.className = "risk-chip";
    return;
  }

  const probability = Number(latestRow.probability) || 0;
  const risk = normalizeRisk(latestRow.risk_level);

  elements.kpiTemperature.textContent = `${Number(latestRow.temperature).toFixed(1)} C`;
  elements.kpiVibration.textContent = `${Number(latestRow.vibration).toFixed(2)} mm/s`;
  elements.kpiPressure.textContent = `${Number(latestRow.pressure).toFixed(1)} psi`;
  elements.kpiProbability.textContent = `${(probability * 100).toFixed(1)}%`;
  elements.kpiRisk.textContent = risk.toUpperCase();
  elements.kpiRisk.className = `risk-chip ${riskClassName(risk)}`;
}

export function renderSystemStatus(labelElement, latestRow) {
  if (!latestRow) {
    labelElement.textContent = "Awaiting data";
    labelElement.className = "risk-chip";
    return;
  }

  const probability = Number(latestRow.probability) || 0;
  let status = "Running";
  let risk = "safe";
  if (probability >= 0.7) {
    status = "Degraded";
    risk = "critical";
  } else if (probability >= 0.3) {
    status = "Warning";
    risk = "warning";
  }

  labelElement.textContent = status;
  labelElement.className = `risk-chip ${riskClassName(risk)}`;
}

export function renderLeaderboard(listElement, machineSummaries, limit = 6) {
  if (!machineSummaries.length) {
    listElement.innerHTML = "<li>No data available</li>";
    return;
  }

  const rows = machineSummaries.slice(0, limit).map((machine) => {
    const riskClass = riskClassName(machine.risk_level);
    return `<li><strong>${machine.machine_id}</strong> - <span class=\"${riskClass}\">${(machine.avg_probability * 100).toFixed(1)}%</span></li>`;
  });
  listElement.innerHTML = rows.join("");
}

export function renderAlerts(listElement, rows, limit = 10) {
  const alerts = rows
    .filter((row) => {
      const risk = normalizeRisk(row.risk_level);
      return risk === "warning" || risk === "critical";
    })
    .slice(0, limit);

  if (!alerts.length) {
    listElement.innerHTML = "<li class=\"alert-item info\">No active alerts.</li>";
    return;
  }

  listElement.innerHTML = alerts
    .map((row) => {
      const risk = normalizeRisk(row.risk_level);
      return `<li class=\"alert-item ${risk}\">${toTimeLabel(row.timestamp)} - ${row.machine_id}: ${risk.toUpperCase()} at ${(Number(row.probability) * 100).toFixed(1)}%</li>`;
    })
    .join("");
}

export function renderHeatmap(containerElement, machineSummaries) {
  if (!machineSummaries.length) {
    containerElement.innerHTML = "<p class=\"helper-text\">No machine heatmap data.</p>";
    return;
  }

  const labels = machineSummaries.map((summary) => summary.machine_id);
  const zValues = [
    machineSummaries.map((summary) => summary.latest_temperature),
    machineSummaries.map((summary) => summary.latest_vibration),
    machineSummaries.map((summary) => summary.latest_pressure),
    machineSummaries.map((summary) => summary.latest_probability * 100),
  ];

  const data = [
    {
      type: "heatmap",
      z: zValues,
      x: labels,
      y: ["Temperature", "Vibration", "Pressure", "Failure %"],
      colorscale: [
        [0, "#35d18f"],
        [0.5, "#f4c44c"],
        [1, "#ff5f5f"],
      ],
      showscale: false,
    },
  ];

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 90, r: 10, t: 10, b: 40 },
    font: { color: "#d8e5f2", family: "Outfit" },
  };

  Plotly.react(containerElement, data, layout, {
    displayModeBar: false,
    responsive: true,
  });
}

export function renderConfidenceGauge(containerElement, probability) {
  if (!Number.isFinite(probability)) {
    containerElement.innerHTML = "<p class=\"helper-text\">Run a manual prediction to render confidence.</p>";
    return;
  }

  const value = Math.max(0, Math.min(100, probability * 100));

  const data = [
    {
      type: "indicator",
      mode: "gauge+number",
      value,
      number: { suffix: "%", font: { color: "#e4eef7" } },
      gauge: {
        axis: { range: [0, 100], tickcolor: "#95aeca" },
        bar: { color: "#43c0ff" },
        steps: [
          { range: [0, 30], color: "rgba(53, 209, 143, 0.22)" },
          { range: [30, 70], color: "rgba(244, 196, 76, 0.22)" },
          { range: [70, 100], color: "rgba(255, 95, 95, 0.22)" },
        ],
      },
    },
  ];

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 20, r: 20, t: 20, b: 10 },
    font: { color: "#d8e5f2", family: "Outfit" },
  };

  Plotly.react(containerElement, data, layout, {
    displayModeBar: false,
    responsive: true,
  });
}

export function buildSeries(rows, limit = 60) {
  const sampled = rows.slice(0, limit).reverse();
  return {
    labels: sampled.map((row) => toTimeLabel(row.timestamp)),
    temperature: sampled.map((row) => Number(row.temperature) || 0),
    vibration: sampled.map((row) => Number(row.vibration) || 0),
    pressure: sampled.map((row) => Number(row.pressure) || 0),
    probability: sampled.map((row) => Number(row.probability) || 0),
  };
}

export function filterRowsByMachine(rows, machineId) {
  if (!machineId || machineId === "all") {
    return rows;
  }
  return rows.filter((row) => String(row.machine_id) === machineId);
}

export function filterRowsByMinutes(rows, minutes) {
  const rangeMinutes = Number(minutes) || 60;
  const cutoff = Date.now() - rangeMinutes * 60 * 1000;
  return rows.filter((row) => {
    const timestamp = new Date(row.timestamp).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

export function renderAnalyticsTable(tbodyElement, rows) {
  if (!rows.length) {
    tbodyElement.innerHTML = "<tr><td colspan=\"7\">No analytics data available.</td></tr>";
    return;
  }

  tbodyElement.innerHTML = rows
    .slice(0, 120)
    .map((row) => {
      const risk = normalizeRisk(row.risk_level);
      return `<tr>
        <td>${new Date(row.timestamp).toLocaleString()}</td>
        <td>${row.machine_id}</td>
        <td>${Number(row.temperature).toFixed(1)}</td>
        <td>${Number(row.vibration).toFixed(2)}</td>
        <td>${Number(row.pressure).toFixed(1)}</td>
        <td>${(Number(row.probability) * 100).toFixed(1)}%</td>
        <td><span class=\"risk-chip ${riskClassName(risk)}\">${risk.toUpperCase()}</span></td>
      </tr>`;
    })
    .join("");
}
