import { normalizeRisk, riskClassName } from "./dashboard-module.js";

const REQUIRED_COLUMNS = ["temperature", "vibration", "pressure"];

function normalizeHeaderKey(rawKey) {
  return String(rawKey || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected."));
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeaderKey,
      complete: (result) => resolve(result),
      error: (error) => reject(error),
    });
  });
}

export function validateAndMapRows(parsedData) {
  const fieldNames = (parsedData.meta?.fields || []).map(normalizeHeaderKey);
  const missing = REQUIRED_COLUMNS.filter((column) => !fieldNames.includes(column));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }

  const validRows = [];
  const invalidRows = [];

  (parsedData.data || []).forEach((rawRow, index) => {
    const machineId = String(rawRow.machine_id || rawRow.machine || `UP-${index + 1}`)
      .trim()
      .toUpperCase();
    const temperature = toNumber(rawRow.temperature);
    const vibration = toNumber(rawRow.vibration);
    const pressure = toNumber(rawRow.pressure);

    if ([temperature, vibration, pressure].some((value) => Number.isNaN(value))) {
      invalidRows.push(index + 1);
      return;
    }

    validRows.push({
      machine_id: machineId || `UP-${index + 1}`,
      temperature,
      vibration,
      pressure,
      timestamp: rawRow.timestamp || undefined,
    });
  });

  return {
    rows: validRows,
    invalidRows,
  };
}

export function renderUploadResults(tbodyElement, results) {
  if (!results.length) {
    tbodyElement.innerHTML = "<tr><td colspan=\"8\">No batch results yet.</td></tr>";
    return;
  }

  tbodyElement.innerHTML = results
    .map((row) => {
      const risk = normalizeRisk(row.risk_level);
      return `<tr>
        <td>${row.index + 1}</td>
        <td>${row.machine_id}</td>
        <td>${Number(row.temperature).toFixed(1)}</td>
        <td>${Number(row.vibration).toFixed(2)}</td>
        <td>${Number(row.pressure).toFixed(1)}</td>
        <td>${row.prediction}</td>
        <td>${(Number(row.probability) * 100).toFixed(1)}%</td>
        <td><span class=\"risk-chip ${riskClassName(risk)}\">${risk.toUpperCase()}</span></td>
      </tr>`;
    })
    .join("");
}

export function summarizeBatchResults(results) {
  if (!results.length) {
    return {
      total: 0,
      critical: 0,
      avgProbability: 0,
      distribution: { safe: 0, warning: 0, critical: 0 },
    };
  }

  const distribution = { safe: 0, warning: 0, critical: 0 };
  let probabilitySum = 0;

  results.forEach((row) => {
    const risk = normalizeRisk(row.risk_level);
    distribution[risk] += 1;
    probabilitySum += Number(row.probability) || 0;
  });

  return {
    total: results.length,
    critical: distribution.critical,
    avgProbability: probabilitySum / results.length,
    distribution,
  };
}

export function downloadResultsCsv(results, fileName = "batch_predictions.csv") {
  if (!results.length) {
    throw new Error("No batch results available for download.");
  }

  const header = [
    "index",
    "machine_id",
    "temperature",
    "vibration",
    "pressure",
    "prediction",
    "probability",
    "risk_level",
    "alert",
    "advisory",
    "timestamp",
  ];

  const lines = [header.join(",")];
  results.forEach((row) => {
    const line = [
      row.index,
      row.machine_id,
      row.temperature,
      row.vibration,
      row.pressure,
      row.prediction,
      Number(row.probability).toFixed(6),
      row.risk_level,
      row.alert,
      String(row.advisory || "").replaceAll(",", " "),
      row.timestamp,
    ];
    lines.push(line.join(","));
  });

  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
