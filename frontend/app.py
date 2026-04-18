from __future__ import annotations

import os
import time
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st

DEFAULT_API_BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
DEFAULT_API_KEY = os.getenv("API_KEY", "")
RISK_ORDER = ["safe", "warning", "critical"]
RISK_COLORS = {
    "safe": "#2EC27E",
    "warning": "#F5C451",
    "critical": "#E65159",
}


def trend_badge(delta: float, unit: str = "%") -> tuple[str, str]:
    if delta > 0.01:
        return f"▲ {delta:.2f}{unit}", "trend-up"
    if delta < -0.01:
        return f"▼ {abs(delta):.2f}{unit}", "trend-down"
    return f"• {abs(delta):.2f}{unit}", "trend-flat"


def apply_theme() -> None:
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&family=Rajdhani:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

        :root {
            --bg: #060d13;
            --bg-2: #0b1b25;
            --panel: #0f2734;
            --panel-2: #153746;
            --text: #ecf8ff;
            --muted: #9ab3c4;
            --accent: #2dd4bf;
            --accent-2: #fbbf24;
            --border: #2f637b;
            --danger: #ef4444;
        }

        .stApp {
            background:
                radial-gradient(circle at 10% 5%, rgba(45, 212, 191, 0.20), transparent 38%),
                radial-gradient(circle at 85% 90%, rgba(251, 191, 36, 0.19), transparent 34%),
                linear-gradient(160deg, #060d13 0%, #0b1b25 100%),
                var(--bg);
            color: var(--text);
            font-family: 'Rajdhani', sans-serif;
            position: relative;
        }

        .stApp::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
                repeating-linear-gradient(
                    90deg,
                    rgba(39, 80, 102, 0.10) 0,
                    rgba(39, 80, 102, 0.10) 1px,
                    transparent 1px,
                    transparent 70px
                ),
                repeating-linear-gradient(
                    0deg,
                    rgba(39, 80, 102, 0.08) 0,
                    rgba(39, 80, 102, 0.08) 1px,
                    transparent 1px,
                    transparent 70px
                );
            mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.26), transparent 72%);
            z-index: 0;
        }

        .stApp::after {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background-image: radial-gradient(rgba(255, 255, 255, 0.03) 0.7px, transparent 0.7px);
            background-size: 3px 3px;
            opacity: 0.22;
            z-index: 0;
        }

        .block-container {
            padding-top: 1.1rem;
            max-width: 1240px;
            position: relative;
            z-index: 1;
        }

        .hero-shell {
            border: 1px solid var(--border);
            border-radius: 0;
            background: linear-gradient(140deg, rgba(15, 39, 52, 0.94) 0%, rgba(8, 20, 29, 0.96) 100%);
            clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 24px, 100% 100%, 0 100%);
            padding: 0.95rem 1rem 1rem 1rem;
            margin-bottom: 0.95rem;
            box-shadow: 0 14px 28px rgba(0, 0, 0, 0.35);
        }

        .hazard-strip {
            height: 7px;
            margin: -0.95rem -1rem 0.78rem -1rem;
            background: repeating-linear-gradient(
                -45deg,
                rgba(251, 191, 36, 0.95) 0,
                rgba(251, 191, 36, 0.95) 10px,
                rgba(6, 13, 19, 0.95) 10px,
                rgba(6, 13, 19, 0.95) 20px
            );
            animation: stripShift 13s linear infinite;
        }

        @keyframes stripShift {
            from { background-position-x: 0; }
            to { background-position-x: 260px; }
        }

        .hero-grid {
            display: grid;
            grid-template-columns: minmax(320px, 1.35fr) minmax(220px, 0.65fr);
            gap: 0.85rem;
            align-items: stretch;
        }

        .hero-kicker {
            font-family: 'IBM Plex Mono', monospace;
            color: var(--accent);
            letter-spacing: 0.18em;
            font-size: 0.72rem;
            text-transform: uppercase;
            margin-bottom: 0.35rem;
        }

        .headline {
            color: var(--text);
            font-family: 'Orbitron', sans-serif;
            font-size: clamp(1.8rem, 3.2vw, 2.7rem);
            font-weight: 800;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            margin: 0;
            line-height: 1.15;
            text-shadow: 0 0 20px rgba(45, 212, 191, 0.22);
        }

        .subtitle {
            color: var(--muted);
            margin-top: 0.45rem;
            margin-bottom: 0;
            font-size: 1rem;
            max-width: 58ch;
        }

        .ops-panel {
            border: 1px solid #2f617d;
            border-radius: 0;
            background: linear-gradient(180deg, rgba(21, 55, 70, 0.9) 0%, rgba(10, 26, 36, 0.9) 100%);
            padding: 0.7rem 0.82rem;
            min-height: 100%;
            clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
        }

        .ops-title {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.72rem;
            letter-spacing: 0.1em;
            color: #c6d6e4;
            margin-bottom: 0.34rem;
            text-transform: uppercase;
        }

        .ops-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin-top: 0.35rem;
        }

        .ops-pill {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.74rem;
            border-radius: 0;
            padding: 0.22rem 0.52rem;
            border: 1px solid #355d73;
            color: #e8f6ff;
            background: rgba(17, 38, 50, 0.72);
        }

        .pill-ok {
            border-color: rgba(45, 212, 191, 0.55);
            color: #8cf0e1;
        }

        .pill-bad {
            border-color: rgba(239, 68, 68, 0.55);
            color: #ffb0b0;
        }

        .badge {
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 0.3rem 0.7rem;
            display: inline-block;
            color: #dbe8ff;
            background: rgba(22, 35, 58, 0.75);
            font-size: 0.86rem;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
            font-family: 'IBM Plex Mono', monospace;
        }

        [data-testid='stSidebar'] {
            background:
                linear-gradient(180deg, #0a151f 0%, #081019 100%),
                repeating-linear-gradient(
                    180deg,
                    rgba(47, 99, 123, 0.10) 0,
                    rgba(47, 99, 123, 0.10) 1px,
                    transparent 1px,
                    transparent 36px
                );
            border-right: 1px solid #224a60;
        }

        [data-testid='stMetric'] {
            background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 0.6rem;
        }

        [data-testid='stMetricLabel'] {
            font-family: 'IBM Plex Mono', monospace;
            letter-spacing: 0.03em;
        }

        [data-testid='stMetricValue'] {
            font-family: 'Orbitron', sans-serif;
            color: #f7fbff;
        }

        .stButton > button {
            border: 1px solid #2f647e;
            background: linear-gradient(135deg, rgba(45, 212, 191, 0.20), rgba(245, 158, 11, 0.22));
            color: #eef7ff;
            font-weight: 600;
            border-radius: 0;
            transition: transform 120ms ease, border-color 120ms ease;
        }

        .stButton > button:hover {
            transform: translateY(-1px);
            border-color: #4b8cad;
        }

        .section-card {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: rgba(17, 26, 45, 0.82);
            padding: 0.9rem 1rem;
            margin-bottom: 0.9rem;
        }

        .summary-card {
            border: 1px solid var(--border);
            border-radius: 0;
            background: linear-gradient(180deg, rgba(16, 35, 47, 0.95) 0%, rgba(21, 48, 63, 0.84) 100%);
            padding: 0.85rem 0.95rem;
            min-height: 104px;
            margin-bottom: 0.4rem;
            box-shadow: 0 8px 18px rgba(2, 8, 12, 0.22);
            clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
        }

        .summary-title {
            font-size: 0.74rem;
            color: var(--muted);
            margin-bottom: 0.22rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            font-family: 'IBM Plex Mono', monospace;
        }

        .summary-value {
            font-size: 1.42rem;
            font-weight: 700;
            color: #f2f6ff;
            font-family: 'Orbitron', sans-serif;
            line-height: 1.2;
            margin-bottom: 0.2rem;
        }

        .summary-delta {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.76rem;
            display: inline-block;
            padding: 0.1rem 0.42rem;
            border-radius: 999px;
            border: 1px solid #2c3f60;
        }

        .trend-up {
            color: #f0a500;
            background: rgba(240, 165, 0, 0.12);
        }

        .trend-down {
            color: #4de1a8;
            background: rgba(77, 225, 168, 0.12);
        }

        .trend-flat {
            color: #b7c8e8;
            background: rgba(183, 200, 232, 0.12);
        }

        .stTabs [data-baseweb="tab-list"] {
            gap: 0.4rem;
        }

        .stTabs [data-baseweb="tab"] {
            border: 1px solid #30566b;
            border-radius: 0;
            background: rgba(14, 30, 40, 0.62);
            padding: 0.34rem 0.75rem;
            color: #d7e5f0;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 0.75rem;
            letter-spacing: 0.03em;
        }

        @media (max-width: 900px) {
            .hero-grid {
                grid-template-columns: 1fr;
            }

            .headline {
                font-size: clamp(1.4rem, 7vw, 2rem);
            }
        }

        .stTabs [aria-selected="true"] {
            border-color: #4f87a3;
            background: rgba(24, 55, 71, 0.78);
        }

        .critical-glow {
            border-color: #7e2b35;
            animation: pulseBorder 1.8s infinite;
        }

        @keyframes pulseBorder {
            0% { box-shadow: 0 0 0 rgba(230, 81, 89, 0.08); }
            50% { box-shadow: 0 0 18px rgba(230, 81, 89, 0.35); }
            100% { box-shadow: 0 0 0 rgba(230, 81, 89, 0.08); }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def classify_risk(probability: float) -> str:
    if probability < 0.30:
        return "safe"
    if probability <= 0.70:
        return "warning"
    return "critical"


def _request_headers(api_key: str) -> dict[str, str]:
    return {"X-API-Key": api_key} if api_key else {}


def fetch_history(api_base: str, api_key: str, limit: int = 200) -> pd.DataFrame:
    response = requests.get(
        f"{api_base}/history",
        params={"limit": limit},
        headers=_request_headers(api_key),
        timeout=8,
    )
    response.raise_for_status()
    data = response.json()
    if not data:
        return pd.DataFrame()

    frame = pd.DataFrame(data)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
    if "risk_level" not in frame.columns:
        frame["risk_level"] = frame["probability"].astype(float).apply(classify_risk)
    if "advisory" not in frame.columns:
        frame["advisory"] = ""
    frame = frame.sort_values("timestamp")
    return frame


def fetch_api_health(api_base: str, api_key: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        response = requests.get(f"{api_base}/", headers=_request_headers(api_key), timeout=5)
        response.raise_for_status()
        return response.json(), None
    except requests.RequestException as exc:
        return None, str(exc)


def send_prediction(api_base: str, payload: dict[str, Any], api_key: str) -> dict[str, Any]:
    response = requests.post(
        f"{api_base}/predict",
        json=payload,
        headers=_request_headers(api_key),
        timeout=8,
    )
    response.raise_for_status()
    return response.json()


def show_risk_banner(risk_level: str, advisory: str) -> None:
    message = advisory or "No advisory message returned by backend."
    if risk_level == "critical":
        st.error(f"CRITICAL RISK: {message}")
    elif risk_level == "warning":
        st.warning(f"WARNING RISK: {message}")
    else:
        st.success(f"SAFE: {message}")


def predict_uploaded_dataframe(api_base: str, api_key: str, dataframe: pd.DataFrame) -> pd.DataFrame:
    results: list[dict[str, Any]] = []
    progress = st.progress(0, text="Starting batch inference...")
    total = len(dataframe)

    for idx, (_, row) in enumerate(dataframe.iterrows(), start=1):
        machine_id = str(row.get("machine_id", f"M-UPL-{idx:03d}"))
        payload = {
            "machine_id": machine_id,
            "temperature": float(row["temperature"]),
            "vibration": float(row["vibration"]),
            "pressure": float(row["pressure"]),
        }
        try:
            prediction = send_prediction(api_base=api_base, payload=payload, api_key=api_key)
            results.append(prediction)
        except (ValueError, TypeError, requests.RequestException) as exc:
            results.append(
                {
                    "machine_id": machine_id,
                    "prediction": None,
                    "probability": None,
                    "alert": False,
                    "risk_level": "error",
                    "advisory": f"Prediction failed: {exc}",
                    "timestamp": pd.Timestamp.utcnow().isoformat(),
                }
            )

        progress.progress(idx / total, text=f"Processed {idx}/{total} rows")

    progress.empty()
    merged = dataframe.reset_index(drop=True).copy()
    prediction_frame = pd.DataFrame(results)
    return pd.concat([merged, prediction_frame], axis=1)


def render_executive_strip(history_df: pd.DataFrame) -> None:
    if history_df.empty:
        return

    data = history_df.dropna(subset=["probability", "prediction"]).copy()
    if data.empty:
        return

    data = data.sort_values("timestamp")
    split_idx = max(1, len(data) // 2)
    previous = data.iloc[:split_idx]
    current = data.iloc[split_idx:]
    if current.empty:
        current = data

    avg_risk_current = float(current["probability"].mean()) * 100.0
    avg_risk_prev = float(previous["probability"].mean()) * 100.0 if not previous.empty else avg_risk_current
    risk_delta = avg_risk_current - avg_risk_prev

    uptime_current = (1.0 - float(current["prediction"].mean())) * 100.0
    uptime_prev = (1.0 - float(previous["prediction"].mean())) * 100.0 if not previous.empty else uptime_current
    uptime_delta = uptime_current - uptime_prev

    critical_current = int((current["risk_level"] == "critical").sum())
    critical_prev = int((previous["risk_level"] == "critical").sum()) if not previous.empty else critical_current
    critical_delta = float(critical_current - critical_prev)

    latest = data.iloc[-1]
    latest_risk = str(latest.get("risk_level", classify_risk(float(latest["probability"]))))

    machines_active = int(data["machine_id"].nunique())

    risk_badge, risk_trend_cls = trend_badge(risk_delta)
    uptime_badge, uptime_trend_cls = trend_badge(uptime_delta)
    critical_badge, critical_trend_cls = trend_badge(critical_delta, unit="")
    active_badge = f"• {machines_active} online"

    critical_card_class = "summary-card critical-glow" if latest_risk == "critical" else "summary-card"

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(
            (
                "<div class='summary-card'>"
                "<div class='summary-title'>Average Risk</div>"
                f"<div class='summary-value'>{avg_risk_current:.2f}%</div>"
                f"<span class='summary-delta {risk_trend_cls}'>{risk_badge}</span>"
                "</div>"
            ),
            unsafe_allow_html=True,
        )
    with c2:
        st.markdown(
            (
                "<div class='summary-card'>"
                "<div class='summary-title'>Estimated Uptime</div>"
                f"<div class='summary-value'>{uptime_current:.2f}%</div>"
                f"<span class='summary-delta {uptime_trend_cls}'>{uptime_badge}</span>"
                "</div>"
            ),
            unsafe_allow_html=True,
        )
    with c3:
        st.markdown(
            (
                f"<div class='{critical_card_class}'>"
                "<div class='summary-title'>Critical Events</div>"
                f"<div class='summary-value'>{critical_current}</div>"
                f"<span class='summary-delta {critical_trend_cls}'>{critical_badge}</span>"
                "</div>"
            ),
            unsafe_allow_html=True,
        )
    with c4:
        st.markdown(
            (
                "<div class='summary-card'>"
                "<div class='summary-title'>Active Machines</div>"
                f"<div class='summary-value'>{machines_active}</div>"
                f"<span class='summary-delta trend-flat'>{active_badge}</span>"
                "</div>"
            ),
            unsafe_allow_html=True,
        )

    spark = px.line(
        data.tail(120),
        x="timestamp",
        y="probability",
        color="risk_level",
        color_discrete_map=RISK_COLORS,
        title="Executive Risk Sparkline",
        template="plotly_dark",
    )
    spark.update_yaxes(range=[0, 1])
    spark.update_layout(
        height=200,
        margin=dict(l=10, r=10, t=40, b=8),
        legend_title_text="",
    )
    st.plotly_chart(spark, width="stretch")


def render_live_monitoring(api_base: str, api_key: str, history_limit: int) -> None:
    st.subheader("Live Monitoring")

    try:
        history_df = fetch_history(api_base=api_base, api_key=api_key, limit=history_limit)
    except requests.RequestException as exc:
        st.error(f"Could not load history: {exc}")
        return

    if history_df.empty:
        st.info("No live records yet. Start simulator and refresh.")
        return

    latest = history_df.iloc[-1]
    risk_level = str(latest.get("risk_level", classify_risk(float(latest["probability"]))))
    risk_color = RISK_COLORS.get(risk_level, "#8094bb")

    kpi_1, kpi_2, kpi_3 = st.columns(3)
    kpi_1.metric("Temperature", f"{latest['temperature']:.2f} C")
    kpi_2.metric("Risk Level", risk_level.upper())
    kpi_3.metric("Failure Probability", f"{float(latest['probability']) * 100:.2f}%")

    st.markdown(
        f"<div class='section-card' style='border-left: 5px solid {risk_color};'>"
        f"<strong>Machine:</strong> {latest['machine_id']}<br>"
        f"<strong>Status:</strong> {risk_level.upper()}<br>"
        f"<strong>Timestamp:</strong> {latest['timestamp']}"
        f"</div>",
        unsafe_allow_html=True,
    )
    show_risk_banner(risk_level=risk_level, advisory=str(latest.get("advisory", "")))

    machine_filter_options = ["All"] + sorted(history_df["machine_id"].astype(str).unique().tolist())
    selected_machine = st.selectbox("Machine filter", options=machine_filter_options)
    chart_df = history_df if selected_machine == "All" else history_df[history_df["machine_id"] == selected_machine]

    sensor_fig = px.line(
        chart_df,
        x="timestamp",
        y=["temperature", "vibration", "pressure"],
        title="Sensor Trends",
        template="plotly_dark",
    )
    sensor_fig.update_layout(legend_title_text="Signal", margin=dict(l=10, r=10, t=46, b=10))
    st.plotly_chart(sensor_fig, width="stretch")

    risk_fig = px.line(
        chart_df,
        x="timestamp",
        y="probability",
        color="machine_id",
        title="Failure Probability Trend",
        template="plotly_dark",
    )
    risk_fig.update_yaxes(range=[0, 1])
    risk_fig.update_layout(margin=dict(l=10, r=10, t=46, b=10))
    st.plotly_chart(risk_fig, width="stretch")


def render_manual_prediction(api_base: str, api_key: str) -> None:
    st.subheader("Manual Prediction")
    st.caption("Try custom sensor values and inspect model output instantly.")

    with st.form("manual_prediction_form"):
        left, middle, right = st.columns(3)
        with left:
            machine_id = st.selectbox("Machine", options=[f"M-{i:03d}" for i in range(1, 21)], index=0)
        with middle:
            temperature = st.slider("Temperature", min_value=20.0, max_value=140.0, value=72.0, step=0.1)
        with right:
            vibration = st.slider("Vibration", min_value=0.1, max_value=12.0, value=3.0, step=0.01)

        pressure = st.slider("Pressure", min_value=5.0, max_value=120.0, value=35.0, step=0.1)
        submitted = st.form_submit_button("Run Prediction", width="stretch")

    if not submitted:
        return

    payload = {
        "machine_id": machine_id,
        "temperature": temperature,
        "vibration": vibration,
        "pressure": pressure,
    }

    try:
        result = send_prediction(api_base=api_base, payload=payload, api_key=api_key)
    except requests.RequestException as exc:
        st.error(f"Prediction request failed: {exc}")
        return

    prob = float(result["probability"])
    risk_level = str(result.get("risk_level", classify_risk(prob)))

    c1, c2, c3 = st.columns(3)
    c1.metric("Machine", result["machine_id"])
    c2.metric("Risk Level", risk_level.upper())
    c3.metric("Failure Probability", f"{prob * 100:.2f}%")
    show_risk_banner(risk_level=risk_level, advisory=str(result.get("advisory", "")))

    gauge = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=prob * 100,
            number={"suffix": "%"},
            title={"text": "Failure Probability"},
            gauge={
                "axis": {"range": [0, 100]},
                "bar": {"color": RISK_COLORS.get(risk_level, "#8094bb")},
                "steps": [
                    {"range": [0, 30], "color": "rgba(46, 194, 126, 0.25)"},
                    {"range": [30, 70], "color": "rgba(245, 196, 81, 0.25)"},
                    {"range": [70, 100], "color": "rgba(230, 81, 89, 0.30)"},
                ],
            },
        )
    )
    gauge.update_layout(template="plotly_dark", margin=dict(l=16, r=16, t=48, b=8), height=320)
    st.plotly_chart(gauge, width="stretch")
    st.json(result)


def render_upload_dataset(api_base: str, api_key: str) -> None:
    st.subheader("Upload Dataset")
    st.caption("Upload a CSV and run backend inference on every row.")

    uploaded_file = st.file_uploader("Upload CSV", type=["csv"])
    if uploaded_file is None:
        st.info("Expected columns: temperature, vibration, pressure (optional: machine_id).")
        return

    try:
        uploaded_df = pd.read_csv(uploaded_file)
    except Exception as exc:
        st.error(f"Could not parse CSV: {exc}")
        return

    required_columns = {"temperature", "vibration", "pressure"}
    missing = required_columns - set(uploaded_df.columns)
    if missing:
        st.error(f"Missing required columns: {sorted(missing)}")
        return

    st.markdown("**Uploaded Preview**")
    st.dataframe(uploaded_df.head(20), height=260, width="stretch")

    max_rows = min(len(uploaded_df), 1000)
    row_limit = st.slider("Rows to score", min_value=1, max_value=max_rows, value=max_rows, step=1)
    run_batch = st.button("Run Batch Prediction", width="stretch")

    if not run_batch:
        return

    scoring_df = uploaded_df.head(row_limit).copy()
    result_df = predict_uploaded_dataframe(api_base=api_base, api_key=api_key, dataframe=scoring_df)

    risk_counts = result_df["risk_level"].value_counts(dropna=False).rename_axis("risk_level").reset_index(name="count")
    risk_counts["risk_level"] = risk_counts["risk_level"].astype(str)

    k1, k2, k3 = st.columns(3)
    k1.metric("Rows Scored", str(len(result_df)))
    k2.metric("Critical Cases", str(int((result_df["risk_level"] == "critical").sum())))
    k3.metric("Warnings", str(int((result_df["risk_level"] == "warning").sum())))

    bar_fig = px.bar(
        risk_counts,
        x="risk_level",
        y="count",
        color="risk_level",
        color_discrete_map=RISK_COLORS,
        title="Risk Distribution",
        template="plotly_dark",
    )
    bar_fig.update_layout(margin=dict(l=10, r=10, t=42, b=10), showlegend=False)
    st.plotly_chart(bar_fig, width="stretch")

    timeline_df = result_df.reset_index().rename(columns={"index": "sample_index"})
    if "probability" in timeline_df.columns:
        trend_fig = px.line(
            timeline_df,
            x="sample_index",
            y="probability",
            color="risk_level",
            color_discrete_map=RISK_COLORS,
            title="Uploaded Data Risk Trend",
            template="plotly_dark",
        )
        trend_fig.update_layout(margin=dict(l=10, r=10, t=42, b=10))
        st.plotly_chart(trend_fig, width="stretch")

    st.markdown("**Prediction Output**")
    st.dataframe(result_df, height=340, width="stretch")
    csv_bytes = result_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="Download Predictions CSV",
        data=csv_bytes,
        file_name="predictions_output.csv",
        mime="text/csv",
        width="stretch",
    )


def render_machine_analytics(api_base: str, api_key: str, history_limit: int) -> None:
    st.subheader("Machine Analytics")
    try:
        history_df = fetch_history(api_base=api_base, api_key=api_key, limit=history_limit)
    except requests.RequestException as exc:
        st.error(f"Could not load analytics data: {exc}")
        return

    if history_df.empty:
        st.info("No records available for analytics yet.")
        return

    summary_df = (
        history_df.groupby("machine_id", as_index=False)
        .agg(
            avg_risk=("probability", "mean"),
            failure_rate=("prediction", "mean"),
            critical_events=("risk_level", lambda s: int((s == "critical").sum())),
            total_events=("prediction", "count"),
        )
        .sort_values("avg_risk", ascending=False)
    )
    summary_df["uptime_pct"] = (1.0 - summary_df["failure_rate"]) * 100.0

    st.markdown("**Top Risky Machines**")
    st.dataframe(summary_df.head(10), height=280, width="stretch")

    top_fig = px.bar(
        summary_df.head(10),
        x="avg_risk",
        y="machine_id",
        orientation="h",
        color="avg_risk",
        title="Average Risk by Machine",
        color_continuous_scale="YlOrRd",
        template="plotly_dark",
    )
    top_fig.update_layout(margin=dict(l=10, r=10, t=42, b=10), yaxis_title="")
    st.plotly_chart(top_fig, width="stretch")

    compare_machines = st.multiselect(
        "Compare machines",
        options=sorted(history_df["machine_id"].astype(str).unique().tolist()),
        default=sorted(history_df["machine_id"].astype(str).unique().tolist())[:4],
    )
    if compare_machines:
        compare_df = history_df[history_df["machine_id"].isin(compare_machines)].copy()
        compare_fig = px.line(
            compare_df,
            x="timestamp",
            y="probability",
            color="machine_id",
            title="Side-by-Side Machine Risk Trends",
            template="plotly_dark",
        )
        compare_fig.update_yaxes(range=[0, 1])
        compare_fig.update_layout(margin=dict(l=10, r=10, t=42, b=10))
        st.plotly_chart(compare_fig, width="stretch")

    heatmap_source = history_df.copy()
    heatmap_source["hour"] = heatmap_source["timestamp"].dt.hour
    heatmap_df = heatmap_source.pivot_table(
        index="machine_id",
        columns="hour",
        values="probability",
        aggfunc="mean",
    ).sort_index()

    if not heatmap_df.empty:
        heatmap_fig = px.imshow(
            heatmap_df,
            color_continuous_scale="YlOrRd",
            aspect="auto",
            title="Risk Heatmap (Machine vs Hour)",
            template="plotly_dark",
        )
        heatmap_fig.update_layout(margin=dict(l=10, r=10, t=42, b=10))
        st.plotly_chart(heatmap_fig, width="stretch")


st.set_page_config(page_title="AI Predictive Maintenance Dashboard", layout="wide")
apply_theme()

with st.sidebar:
    st.header("Control Center")
    api_base = st.text_input("API Base URL", value=DEFAULT_API_BASE, key="cfg_api_base").strip().rstrip("/")
    api_key = st.text_input("API Key (optional)", value=DEFAULT_API_KEY, type="password", key="cfg_api_key").strip()
    mode = st.selectbox(
        "Select Mode",
        options=["Live Monitoring", "Manual Prediction", "Upload Dataset", "Machine Analytics"],
        key="cfg_mode",
    )
    history_limit = st.slider("History rows", min_value=50, max_value=800, value=300, step=50, key="cfg_history_limit")
    auto_refresh = st.toggle("Auto-refresh", value=False, key="cfg_auto_refresh")
    refresh_seconds = st.slider(
        "Refresh interval (seconds)",
        min_value=2,
        max_value=12,
        value=3,
        step=1,
        key="cfg_refresh_seconds",
    )
    if st.button("Refresh now", width="stretch", key="cfg_refresh_now"):
        st.rerun()

if auto_refresh and mode == "Live Monitoring":
    st.caption(f"Auto-refresh active: updating every {refresh_seconds}s without full page reload.")

health, health_error = fetch_api_health(api_base=api_base, api_key=api_key)
system_status = "RUNNING" if health else "OFFLINE"
model_loaded = bool(health.get("model_loaded", False)) if health else False
model_status = "LOADED" if model_loaded else "NOT LOADED"
status_tone = "pill-ok" if health else "pill-bad"

st.markdown(
    (
        "<section class='hero-shell'>"
        "<div class='hazard-strip'></div>"
        "<div class='hero-grid'>"
        "<div>"
        "<div class='hero-kicker'>Predictive Operations Console</div>"
        "<h1 class='headline'>Machine Risk Command Deck</h1>"
        "<p class='subtitle'>"
        "Real-time telemetry, advisory intelligence, and anomaly direction in a single industrial canvas."
        "</p>"
        "</div>"
        "<div class='ops-panel'>"
        "<div class='ops-title'>System Snapshot</div>"
        "<div class='ops-row'>"
        f"<span class='ops-pill {status_tone}'>SYSTEM: {system_status}</span>"
        f"<span class='ops-pill'>MODEL: {model_status}</span>"
        f"<span class='ops-pill'>MODE: {mode.upper()}</span>"
        f"<span class='ops-pill'>API: {api_base}</span>"
        f"<span class='ops-pill'>AUTO REFRESH: {'ON' if auto_refresh else 'OFF'}</span>"
        "</div>"
        "</div>"
        "</div>"
        "</section>"
    ),
    unsafe_allow_html=True,
)

if not health:
    st.error(f"API health check failed: {health_error}")

summary_history = pd.DataFrame()
if health:
    try:
        summary_history = fetch_history(api_base=api_base, api_key=api_key, limit=min(history_limit, 600))
    except requests.RequestException:
        summary_history = pd.DataFrame()

render_executive_strip(summary_history)

if mode == "Live Monitoring":
    render_live_monitoring(api_base=api_base, api_key=api_key, history_limit=history_limit)
elif mode == "Manual Prediction":
    render_manual_prediction(api_base=api_base, api_key=api_key)
elif mode == "Upload Dataset":
    render_upload_dataset(api_base=api_base, api_key=api_key)
else:
    render_machine_analytics(api_base=api_base, api_key=api_key, history_limit=history_limit)

if auto_refresh and mode == "Live Monitoring":
    # Use Streamlit rerun cycle instead of browser-level reload to avoid screen flash.
    time.sleep(refresh_seconds)
    st.rerun()
