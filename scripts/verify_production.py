#!/usr/bin/env python
"""Real HTTP smoke checks against the single-origin production service.

First run `npm run build` in frontend and start FastAPI. This script does NOT
use an in-process TestClient or import simulation functions.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    results = []

    def request(path, payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(args.base_url + path, data=body,
                                     headers={"Content-Type": "application/json"} if body else {})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return response.status, response.headers.get("Content-Type", ""), response.read().decode()
        except urllib.error.HTTPError as response:
            return response.code, response.headers.get("Content-Type", ""), response.read().decode()

    def check(name, condition, detail=""):
        results.append({"name": name, "passed": bool(condition), "detail": detail})
        print(("PASS" if condition else "FAIL") + " · " + name)

    html = ""
    for route in ["/", "/simulator", "/noise", "/analysis", "/mitigation", "/theory"]:
        status, kind, content = request(route)
        check("SPA route " + route, status == 200 and "text/html" in kind and '<div id="root"></div>' in content)
        if route == "/": html = content
    assets = sorted(set(re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html)))
    check("Built CSS and JavaScript are referenced", bool(assets) and any(a.endswith('.css') for a in assets) and any(a.endswith('.js') for a in assets), str(assets))
    for asset in assets:
        status, kind, content = request(asset)
        check("Asset " + asset, status == 200 and len(content) > 100 and "text/html" not in kind, kind)
    status, _, body = request("/api/health")
    health = json.loads(body)
    check("Real API engine", status == 200 and health.get("engine") == "Qiskit Aer" and health.get("exact_branch_ensemble"), json.dumps(health))
    status, _, body = request("/api/simulate", {})
    ideal = json.loads(body)
    check("Ideal fidelity and density", status == 200 and abs(ideal.get("fidelity", 0) - 1) < 1e-10 and ideal.get("validation", {}).get("valid", False))
    noise = {"enabled": True, "channel": "depolarizing", "p": .5, "locations": ["bell_cx_q2"]}
    status, _, body = request("/api/simulate", {"noise": noise})
    noisy = json.loads(body)
    check("In-circuit noisy calculation", status == 200 and abs(noisy.get("fidelity", 0) - .75) < 1e-9 and len(noisy.get("circuit", {}).get("noise_insertions", [])) == 1)
    status, _, body = request("/api/mitigate", {})
    mitigation = json.loads(body)
    check("Actual ZNE estimate", status == 200 and abs(mitigation.get("extrapolated_fidelity", 0) - .992) < 1e-9 and mitigation.get("improved", False))
    status, kind, _ = request("/api/does-not-exist")
    check("Unknown API remains JSON 404", status == 404 and "application/json" in kind)
    status, kind, body = request("/api/simulate", {"noise": {"enabled": True, "p": 1.5}})
    check("Invalid request is rejected", status == 422 and "application/json" in kind and bool(json.loads(body).get("detail")))
    report = {"checked_at": datetime.now(timezone.utc).isoformat(), "base_url": args.base_url,
              "passed": sum(r["passed"] for r in results), "failed": sum(not r["passed"] for r in results), "checks": results}
    (ROOT / "docs" / "production-http-checks.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"{report['passed']} passed, {report['failed']} failed")
    if report['failed']: raise SystemExit(1)


if __name__ == "__main__":
    main()
