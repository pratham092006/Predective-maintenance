const defaultGrid = "rgba(145, 173, 203, 0.22)";
const defaultTick = "#95aeca";

function createLineChart(canvas, datasets, yMax = null) {
  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets,
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: defaultTick, maxTicksLimit: 9 },
          grid: { color: defaultGrid },
        },
        y: {
          ticks: { color: defaultTick },
          grid: { color: defaultGrid },
          min: 0,
          max: yMax,
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#e4eef7",
          },
        },
      },
    },
  });
}

export function createSensorChart(canvas) {
  return createLineChart(canvas, [
    {
      label: "Temperature",
      data: [],
      borderColor: "#45d6ff",
      backgroundColor: "rgba(69, 214, 255, 0.16)",
      pointRadius: 0,
      tension: 0.28,
    },
    {
      label: "Vibration",
      data: [],
      borderColor: "#ffc35a",
      backgroundColor: "rgba(255, 195, 90, 0.13)",
      pointRadius: 0,
      tension: 0.28,
    },
    {
      label: "Pressure",
      data: [],
      borderColor: "#9ec0ff",
      backgroundColor: "rgba(158, 192, 255, 0.13)",
      pointRadius: 0,
      tension: 0.28,
    },
  ]);
}

export function createProbabilityChart(canvas, label = "Failure Probability") {
  const chart = createLineChart(
    canvas,
    [
      {
        label,
        data: [],
        borderColor: "#ff7b7b",
        backgroundColor: "rgba(255, 123, 123, 0.15)",
        pointRadius: 0,
        tension: 0.32,
      },
    ],
    1
  );

  chart.options.scales.y.ticks.callback = (value) => `${Math.round(value * 100)}%`;
  return chart;
}

export function createPieChart(canvas, label = "Risk Distribution") {
  return new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Safe", "Warning", "Critical"],
      datasets: [
        {
          label,
          data: [0, 0, 0],
          backgroundColor: ["#35d18f", "#f4c44c", "#ff5f5f"],
          borderColor: ["#35d18f", "#f4c44c", "#ff5f5f"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#e4eef7",
          },
        },
      },
    },
  });
}

export function updateLineSeries(chart, labels, seriesValues) {
  chart.data.labels = labels;
  chart.data.datasets.forEach((dataset, index) => {
    dataset.data = seriesValues[index] || [];
  });
  chart.update("none");
}

export function updatePieChart(chart, distribution) {
  chart.data.datasets[0].data = [
    distribution.safe || 0,
    distribution.warning || 0,
    distribution.critical || 0,
  ];
  chart.update("none");
}

export function toTimeLabel(isoLikeValue) {
  const time = new Date(isoLikeValue);
  if (Number.isNaN(time.getTime())) {
    return "--";
  }
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}
