# Executed validation report

Generated from the saved JUnit reports and real production HTTP checks, **2026-10-14T17:52:18+05:30**.

## Results

| Executed suite | Passed / total | Failed | Raw JUnit evidence |
|---|---:|---:|---|
| Backend / scientific + API | 103 / 103 | 0 | backend-tests.xml |
| Frontend / Vitest unit + contract | 16 / 16 | 0 | frontend-tests.xml |
| Chromium / live development integration | 8 / 8 | 0 | e2e-tests.xml |
| Chromium / built production integration | 8 / 8 | 0 | production-e2e-tests.xml |
| Built-production HTTP smoke checks | 17 / 17 | 0 | production-http-checks.json |

- `npm run build`: TypeScript checking and Vite production bundling executed successfully. See `production-build-output.txt`.
- `npm audit`: recorded separately in `npm-audit-final.json`.
- `python scripts/export_results.py`: executed the real engine and generated all report data/circuit/plot exports. See `figure-export-output.txt`.
- No failed or skipped test is counted as passing. The eight browser scenarios were executed twice: on the Vite development app and on the built SPA served by FastAPI.

## Environment

- OS: Linux x86_64
- Python: 3.13.16
- Node: v20.20.2; npm: 10.8.2
- Qiskit: 2.5.2; Qiskit Aer: 0.17.2
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

Settings: Bell-pair target q2 immediately after CX(q1,q2), same **96** Fibonacci-sphere states, sample ID `6663b1d1c042e1f9`. Values below are sampled means from actual circuit-derived process maps, not hardcoded application data.

| p | Amplitude damping | Phase damping | Depolarizing | Bit flip |
|---:|---:|---:|---:|---:|
| 0.0 | 1.000000 | 1.000000 | 1.000000 | 1.000000 |
| 0.2 | 0.931477 | 0.964807 | 0.900000 | 0.866674 |
| 0.5 | 0.819039 | 0.902364 | 0.750000 | 0.666686 |
| 0.8 | 0.682409 | 0.815728 | 0.600000 | 0.466697 |
| 1.0 | 0.500000 | 0.666649 | 0.500000 | 0.333372 |

The complete JSON/CSV and all plots are in `reference-results/`. Small differences between sampled means and the continuous Haar values are quadrature effects; both are exported. In particular the classical reference 2/3 is a uniform-unknown-state **average**, not an individual-state threshold.

Default genuine mitigation experiment: depolarizing p=0.1 at the same Bell-resource site, scales [1,2,3], linear fit. Baseline **0.950000**, amplified fidelities **0.950000, 0.905000, 0.864500**, raw estimate **0.992000**; selected case improved. At p=1 the tests verify no improvement is claimed. This remains an extrapolated observable estimate, not a recovered density matrix.

## Limitations and observed warnings

- One third-party Starlette test-client deprecation warning recommends `httpx2`; the pinned `httpx` test client still executed all backend tests successfully. It is not suppressed or counted as a failure.
- Hardware execution, calibrated device noise, correlated two-qubit/readout errors, Firefox, Safari, deployment hardening, and cross-platform installation were not tested.
- Error mitigation improvement is not guaranteed. All channel conventions, exact ensemble details, and scope limitations are documented in `SCIENTIFIC_NOTES.md`.
- During development an AbortError cross-realm handling issue and a reused-response unit-test fixture were corrected. Final reports above are from executed reruns, not the initial failing run.
