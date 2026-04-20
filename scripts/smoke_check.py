from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Any

import requests


@dataclass
class CheckResult:
    name: str
    passed: bool
    details: dict[str, Any]


def _json_or_text(response: requests.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return response.text


def _request(
    session: requests.Session,
    method: str,
    url: str,
    timeout: float,
    **kwargs: Any,
) -> tuple[bool, dict[str, Any], requests.Response | None]:
    try:
        response = session.request(method=method, url=url, timeout=timeout, **kwargs)
        return True, {"status_code": response.status_code, "body": _json_or_text(response)}, response
    except requests.RequestException as exc:
        return False, {"error": str(exc)}, None


def check_environment(
    name: str,
    base_url: str,
    timeout: float,
    api_key: str | None,
) -> CheckResult:
    session = requests.Session()
    headers: dict[str, str] = {}
    if api_key:
        headers["X-API-Key"] = api_key

    details: dict[str, Any] = {"base_url": base_url.rstrip("/")}
    checks_ok = True

    ok, payload, response = _request(session, "GET", f"{base_url.rstrip('/')}/", timeout, headers=headers)
    details["health"] = payload
    if not ok or response is None:
        return CheckResult(name=name, passed=False, details=details)
    health_body = payload.get("body", {}) if isinstance(payload, dict) else {}
    if response.status_code != 200 or not isinstance(health_body, dict) or health_body.get("status") != "ok":
        checks_ok = False
    if not bool(health_body.get("model_loaded", False)):
        checks_ok = False

    ok, payload, response = _request(session, "GET", f"{base_url.rstrip('/')}/client-config", timeout, headers=headers)
    details["client_config"] = payload
    auth_required = False
    if not ok or response is None or response.status_code != 200:
        checks_ok = False
    else:
        cfg_body = payload.get("body", {}) if isinstance(payload, dict) else {}
        if isinstance(cfg_body, dict):
            auth_required = bool(cfg_body.get("auth_required", False))
        else:
            checks_ok = False

    predict_payload = {
        "machine_id": "M-SMOKE",
        "temperature": 86.1,
        "vibration": 4.2,
        "pressure": 39.1,
    }
    ok, payload, response = _request(
        session,
        "POST",
        f"{base_url.rstrip('/')}/predict",
        timeout,
        headers=headers,
        json=predict_payload,
    )
    details["predict"] = payload
    if not ok or response is None:
        checks_ok = False
    elif response.status_code == 401 and auth_required and not api_key:
        checks_ok = False
        details["predict_auth_hint"] = "Set --api-key because auth_required=true"
    elif response.status_code != 200:
        checks_ok = False
    else:
        body = payload.get("body", {}) if isinstance(payload, dict) else {}
        prob = body.get("probability") if isinstance(body, dict) else None
        if not isinstance(prob, (int, float)) or prob < 0.0 or prob > 1.0:
            checks_ok = False

    batch_predict_payload = {
        "persist": False,
        "rows": [
            {
                "temperature": 84.3,
                "vibration": 3.8,
                "pressure": 37.5,
            }
        ],
    }
    ok, payload, response = _request(
        session,
        "POST",
        f"{base_url.rstrip('/')}/predict/batch",
        timeout,
        headers=headers,
        json=batch_predict_payload,
    )
    details["predict_batch"] = payload
    if not ok or response is None:
        checks_ok = False
    elif response.status_code == 401 and auth_required and not api_key:
        checks_ok = False
        details["predict_batch_auth_hint"] = "Set --api-key because auth_required=true"
    elif response.status_code != 200:
        checks_ok = False
    else:
        body = payload.get("body", {}) if isinstance(payload, dict) else {}
        results = body.get("results") if isinstance(body, dict) else None
        if not isinstance(results, list) or len(results) != 1:
            checks_ok = False
        else:
            prob = results[0].get("probability")
            if not isinstance(prob, (int, float)) or prob < 0.0 or prob > 1.0:
                checks_ok = False

    ok, payload, response = _request(
        session,
        "GET",
        f"{base_url.rstrip('/')}/history?limit=5",
        timeout,
        headers=headers,
    )
    details["history"] = payload
    if not ok or response is None:
        checks_ok = False
    elif response.status_code == 401 and auth_required and not api_key:
        checks_ok = False
        details["history_auth_hint"] = "Set --api-key because auth_required=true"
    elif response.status_code != 200:
        checks_ok = False
    else:
        body = payload.get("body", []) if isinstance(payload, dict) else []
        if not isinstance(body, list):
            checks_ok = False

    ok, payload, response = _request(session, "GET", f"{base_url.rstrip('/')}/ui", timeout, headers=headers)
    details["ui"] = payload
    if not ok or response is None or response.status_code != 200:
        checks_ok = False
    else:
        body = payload.get("body") if isinstance(payload, dict) else ""
        if not isinstance(body, str) or "Predictive Maintenance" not in body:
            checks_ok = False

    ok, payload, response = _request(session, "GET", f"{base_url.rstrip('/')}/ui/app.js", timeout, headers=headers)
    details["ui_app_js"] = payload
    if not ok or response is None or response.status_code != 200:
        checks_ok = False

    ok, payload, response = _request(session, "GET", f"{base_url.rstrip('/')}/ui/styles.css", timeout, headers=headers)
    details["ui_styles_css"] = payload
    if not ok or response is None or response.status_code != 200:
        checks_ok = False

    return CheckResult(name=name, passed=checks_ok, details=details)


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke check local and production predictive-maintenance features")
    parser.add_argument("--local-url", default="http://127.0.0.1:8000", help="Local backend base URL")
    parser.add_argument(
        "--production-url",
        default="https://predictive-maintenance-api.vercel.app",
        help="Production backend base URL",
    )
    parser.add_argument("--timeout", type=float, default=10.0, help="Request timeout seconds")
    parser.add_argument("--api-key", default="", help="Optional API key for protected endpoints")
    parser.add_argument("--skip-local", action="store_true", help="Skip local environment checks")
    parser.add_argument("--skip-production", action="store_true", help="Skip production environment checks")
    args = parser.parse_args()

    if args.skip_local and args.skip_production:
        print("At least one environment must be checked.")
        return 2

    results: list[CheckResult] = []
    key = args.api_key.strip() or None

    if not args.skip_local:
        results.append(check_environment("local", args.local_url, args.timeout, key))
    if not args.skip_production:
        results.append(check_environment("production", args.production_url, args.timeout, key))

    output = {
        "all_passed": all(item.passed for item in results),
        "results": [
            {"environment": item.name, "passed": item.passed, "details": item.details}
            for item in results
        ],
    }
    print(json.dumps(output, indent=2))
    return 0 if output["all_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())