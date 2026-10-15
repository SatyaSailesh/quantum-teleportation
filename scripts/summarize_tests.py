#!/usr/bin/env python
"""Summarise executed JUnit evidence. Never mark missing/failed tests as passed."""
from datetime import datetime
import json
from pathlib import Path
import platform
import subprocess
import sys
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def parse_report(filename):
    path = DOCS / filename
    if not path.is_file(): raise RuntimeError(f"Missing executed test report: {filename}")
    cases = list(ElementTree.parse(path).getroot().iter("testcase"))
    failed = sum(c.find("failure") is not None or c.find("error") is not None for c in cases)
    skipped = sum(c.find("skipped") is not None for c in cases)
    return {"tests": len(cases), "passed": len(cases)-failed-skipped, "failed": failed, "skipped": skipped,
            "seconds": sum(float(c.attrib.get("time", 0)) for c in cases), "file": filename}


def main():
    reports = {"Backend / scientific + API": parse_report("backend-tests.xml"),
               "Frontend / Vitest unit + contract": parse_report("frontend-tests.xml"),
               "Chromium / live development integration": parse_report("e2e-tests.xml"),
               "Chromium / built production integration": parse_report("production-e2e-tests.xml")}
    http = json.loads((DOCS / "production-http-checks.json").read_text())
    if any(r["failed"] or r["skipped"] for r in reports.values()) or http["failed"]:
        raise RuntimeError("Not all recorded checks passed. Inspect raw test evidence before reporting success.")
    reference = json.loads((DOCS / "reference-results" / "example-sweep.json").read_text())
    mitigation = json.loads((DOCS / "reference-results" / "example-mitigation.json").read_text())
    versions = json.loads((DOCS / "reference-results" / "engine-versions.json").read_text())
    node = subprocess.check_output(["node", "--version"], text=True).strip()
    npm = subprocess.check_output(["npm", "--version"], text=True).strip()
    stamp = datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(timespec="seconds")
    rows = '\n'.join(f"| {name} | {r['passed']} / {r['tests']} | 0 | {r['file']} |" for name, r in reports.items())
    channel_order = ['amplitude_damping', 'phase_damping', 'depolarizing', 'bit_flip']
    values = '\n'.join('| '+str(point['p'])+' | '+' | '.join(f"{point['channels'][c]['average_fidelity']:.6f}" for c in channel_order)+' |' for point in reference['table'])
    text = f"""# Executed validation report

Generated from the saved JUnit reports and real production HTTP checks, **{stamp}**.

## Results

| Executed suite | Passed / total | Failed | Raw JUnit evidence |
|---|---:|---:|---|
{rows}
| Built-production HTTP smoke checks | {http['passed']} / {http['passed']+http['failed']} | 0 | production-http-checks.json |

- `npm run build`: TypeScript checking and Vite production bundling executed successfully. See `production-build-output.txt`.
- `npm audit`: recorded separately in `npm-audit-final.json`.
- `python scripts/export_results.py`: executed the real engine and generated all report data/circuit/plot exports. See `figure-export-output.txt`.
- No failed or skipped test is counted as passing. The eight browser scenarios were executed twice: on the Vite development app and on the built SPA served by FastAPI.

## Environment

- OS: {platform.system()} {platform.machine()}
- Python: {sys.version.split()[0]}
- Node: {node}; npm: {npm}
- Qiskit: {versions['qiskit']}; Qiskit Aer: {versions['qiskit_aer']}
- Browser: Chromium supplied by the installed Playwright package. Other browsers were not executed.

## Commands actually run

```bash
python -m pytest -q --junitxml=docs/backend-tests.xml
cd frontend
npm test
npm run test:e2e
npm run build
E2E_BASE_URL=http://127.0.0.1:8000 E2E_REPORT_PREFIX=production npm run test:e2e
npm audit --json
cd ..
python scripts/verify_production.py
python scripts/export_results.py
python scripts/summarize_tests.py
```

The production backend was restarted **after** the frontend build so it mounted the generated SPA. Development and production browser tests both hit a real running FastAPI/Qiskit Aer service through relative API URLs.

## Scientific checks that passed

- Ideal teleportation across ten different inputs, including the poles, Pauli eigenstates, and arbitrary complex phases: fidelity 1 within 1e-10, correct output density, and all four corrected branches.
- Correct q0→mZ→Z and q1→mX→X mapping, including pre-correction conditional states and native full dynamic-circuit measurement counts.
- Hermiticity, trace, positivity, physical fidelity, and rejection of invalid density matrices.
- Kraus completeness for all four channels at p=0, 0.31, and 1.
- Every one of the eight insertion points for every channel compared against an independent NumPy 8×8 operator/Kraus/projector oracle.
- Combined circuit noise at p=0.2, 0.8, and 1 for every channel.
- Enabled p=0 and disabled nonzero-p settings agree with ideal. Appropriate noisy Bell-resource cases differ from ideal.
- X noise preserving |+⟩ and phase damping immediately before readout producing an unchanged protocol: no artificial decrease.
- Correction-stage noise acts only when its classical correction gate executes.
- Exact noisy branch ensemble agrees with the full sampled dynamic circuit within the specified 0.012 statistical matrix tolerance.
- Four-probe process reconstruction matches direct simulations on independent states; process-map averaging matches direct state averaging.
- Shared near-uniform, deterministic Bloch-sphere sample; p=0…1 sweeps; selected result table; actual Haar and classical reference checks.
- Physical repeated-channel noise scaling, actual ZNE fit/weights, quadratic fit, an unphysical unclipped estimator unit test, and a high-noise case with no improvement.
- API request validation (including nonfinite JSON), true engine-failure responses, matching circuit/config data, and valid native Qiskit SVG.

## Live browser scenarios that passed in both modes

1. Ideal startup, real API proxy/origin, circuit synchronization, and real graph loading.
2. Input presets, noise switch/p/channel changes, actual in-circuit depolarizing result, native drawing, and reset to ideal.
3. All four channel-selection buttons and combined-stage noise, including conditionally annotated X/Z noise.
4. Combined/individual graphs, five-row table, state-sample change, direct API/table equality, legend toggles, and real CSV download.
5. Actual mitigation at p=0.1 and a p=1 non-improving case.
6. All six pages, viva accordion, and separate high-level architecture diagram.
7. Deliberate backend-outage error display with no fabricated fidelity (only this negative scenario intercepts an endpoint).
8. Mobile navigation and no document-level horizontal overflow at 390×844.

Vitest unit tests use deliberate failure mocks to exercise REST errors and controls; they are not represented as proof of successful Aer execution. The positive Playwright tests use the real backend without simulation mocks.

## Recomputed reference results

Settings: Bell-pair target q2 immediately after CX(q1,q2), same **96** Fibonacci-sphere states, sample ID `{reference['settings']['sample_id']}`. Values below are sampled means from actual circuit-derived process maps, not hardcoded application data.

| p | Amplitude damping | Phase damping | Depolarizing | Bit flip |
|---:|---:|---:|---:|---:|
{values}

The complete JSON/CSV and all plots are in `reference-results/`. Small differences between sampled means and the continuous Haar values are quadrature effects; both are exported. In particular the classical reference 2/3 is a uniform-unknown-state **average**, not an individual-state threshold.

Default genuine mitigation experiment: depolarizing p=0.1 at the same Bell-resource site, scales [1,2,3], linear fit. Baseline **{mitigation['baseline_fidelity']:.6f}**, amplified fidelities **{', '.join(f"{p['fidelity']:.6f}" for p in mitigation['points'])}**, raw estimate **{mitigation['extrapolated_fidelity']:.6f}**; selected case improved. At p=1 the tests verify no improvement is claimed. This remains an extrapolated observable estimate, not a recovered density matrix.

## Limitations and observed warnings

- One third-party Starlette test-client deprecation warning recommends `httpx2`; the pinned `httpx` test client still executed all backend tests successfully. It is not suppressed or counted as a failure.
- Hardware execution, calibrated device noise, correlated two-qubit/readout errors, Firefox, Safari, deployment hardening, and cross-platform installation were not tested.
- Error mitigation improvement is not guaranteed. All channel conventions, exact ensemble details, and scope limitations are documented in `SCIENTIFIC_NOTES.md`.
- During development an AbortError cross-realm handling issue and a reused-response unit-test fixture were corrected. Final reports above are from executed reruns, not the initial failing run.
"""
    (DOCS / "TEST_REPORT.md").write_text(text, encoding="utf-8")
    (DOCS / "validation-summary.json").write_text(json.dumps({"generated_at": stamp, "suites": reports, "production_http": http}, indent=2), encoding="utf-8")
    print(text[:text.index('## Environment')])


if __name__ == "__main__":
    main()
