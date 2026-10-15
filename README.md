# QubitLab
## Quantum Teleportation Protocol with Fidelity Analysis Under Noise

A complete, production-grade quantum computing capstone application: **React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + Recharts 3** connected to a high-performance **Python 3.13 + FastAPI + NumPy 2.3 + Qiskit 2.5 + Qiskit Aer 0.17** simulation backend.

This is a working scientific application, not a frontend mockup. It executes the real 3-qubit quantum teleportation protocol, inserts explicit Kraus noise channels into the circuit on Bob's Bell-pair qubit ($q_2$), validates Bob’s output density matrix, calculates exact state fidelity $F = \langle\psi|\rho_{\text{out}}|\psi\rangle$, evaluates state-averaged fidelity sweeps across Fibonacci-sphere lattices, and executes digital channel-repetition zero-noise extrapolation (ZNE).

---

## 1. Quick Start Guide

### Prerequisites
- Python **3.11–3.13** (tested with Python 3.13.16).
- Node.js **20.19+** or Node 22, and npm (tested with Node 20.20.2 / npm 10.8.2).
- Google Chrome or Chromium (for Playwright E2E testing).
- No external quantum hardware accounts, API keys, or cloud databases are required. All simulations run locally on Qiskit Aer.

### Setup and Installation

From the project root directory:

```bash
# 1. Set up Python virtual environment & install backend requirements
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt

# 2. Install frontend dependencies
cd frontend
npm ci
cd ..
```

*(On Windows PowerShell, activate the environment using `.venv\Scripts\Activate.ps1`)*

---

### Running Development Mode (Dual Server with Proxy)

#### Terminal 1 — Backend API Server
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- Health Check: <http://127.0.0.1:8000/api/health>
- Interactive Swagger API Docs: <http://127.0.0.1:8000/docs>

#### Terminal 2 — Frontend Development Server
```bash
cd frontend
npm run dev
```
Open **<http://localhost:5173>**. Vite automatically proxies all relative `/api/*` HTTP requests to port 8000.

---

### Production Build & Single-Origin Deployment

FastAPI can serve both the backend API and the compiled React production SPA from a single port (`8000`):

```bash
# 1. Build the production bundle
cd frontend
npm run build
cd ..

# 2. Start the FastAPI single-origin server
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Open **<http://localhost:8000>**. All routes (`/`, `/simulator`, `/noise`, `/analysis`, `/mitigation`, `/theory`) serve the compiled SPA directly with instant deep-linking.

---

## Deploying to Render (without Docker)

The root `render.yaml` defines a native Python API service and a static Vite frontend. To deploy both:

1. In the [Render Dashboard](https://dashboard.render.com), choose **New → Blueprint**.
2. Connect `SatyaSailesh/quantum-teleportation` and select the `main` branch.
3. Review the two services and choose **Apply**. Render builds the frontend and backend, then supplies the backend URL to the frontend automatically.
4. Open the frontend service URL. Check the backend at `<backend-service-url>/api/health`.

The backend allows cross-origin requests because the API is public and the Render frontend and API use separate URLs; it does not enable credentialed requests. The free plan may sleep when idle and has limited memory, which can affect simulation startup or heavier experiments.

---

## 2. Core Scientific Architecture

### Qubit Roles & Circuit Sequence
- **`q0`**: Alice's unknown input state $|\psi\rangle = \cos(\theta/2)|0\rangle + e^{i\phi}\sin(\theta/2)|1\rangle$.
- **`q1`**: Alice's half of the shared Bell pair.
- **`q2`**: Bob's half of the shared Bell pair and the single location of resource-state noise.

### The Canonical 9-Step Sequence
```text
q0: ──U(θ,φ,0)─────────────────────●──H──M → mZ
q1: ────────────H──●──────────────X─────M → mX
q2: ───────────────X──[Kraus(q2)]───────────X if mX=1──Z if mZ=1──ρout
```
1. **Input Preparation**: Prepare $|\psi\rangle$ on $q_0$ using $U(\theta, \phi, 0)$.
2. **Bell Pair Creation (Hadamard)**: Apply $H$ on $q_1$.
3. **Bell Pair Entanglement (CNOT)**: Apply $CX(1, 2)$ between $q_1$ and $q_2$.
4. **Resource-State Noise**: Apply the selected noise channel **exclusively to $q_2$** immediately after $CX(1,2)$, prior to Alice's measurement.
5. **Alice Bell CNOT**: Apply $CX(0, 1)$ between input $q_0$ and Alice's Bell qubit $q_1$.
6. **Alice Bell Hadamard**: Apply $H$ on input $q_0$.
7. **Alice Joint Measurement**: Measure $q_0 \to mZ$ and $q_1 \to mX$ in the computational basis.
8. **Bob Conditional Feed-Forward**: Apply $X(q_2)$ if $mX=1$, then $Z(q_2)$ if $mZ=1$ ($Z^{mZ} X^{mX}$).
9. **State Evaluation**: Calculate Bob's reduced density matrix $\rho_{\text{out}}$ and exact state fidelity $F = \langle\psi|\rho_{\text{out}}|\psi\rangle$.

### Single Supported Noise-Insertion Location
- **Location**: `bell_cx_q2` (Bob's Bell-pair qubit immediately after $CX(1,2)$ and before Alice's $CX(0,1)$).
- **Physical Rationale**: Models channel decoherence and transmission noise experienced by the distributed entangled EPR qubit as it travels to Bob across the quantum network.
- **Enforcement**: Alternative noise sites are rejected at the REST API schema level with HTTP 422 errors. The backend simulator, frontend circuit visualization, SVG exporter, and sweeps strictly implement this single canonical circuit.

---

## 3. Four Quantum Noise Channels

All channels are implemented via explicit Kraus operator sets $\mathcal{E}(\rho) = \sum_i K_i \rho K_i^\dagger$ with completeness $\sum_i K_i^\dagger K_i = I$:

1. **Amplitude Damping (Energy Relaxation)**:
   $$K_0 = \begin{pmatrix} 1 & 0 \\ 0 & \sqrt{1-p} \end{pmatrix}, \quad K_1 = \begin{pmatrix} 0 & \sqrt{p} \\ 0 & 0 \end{pmatrix}$$
2. **Phase Damping (Pure Dephasing)**:
   $$K_0 = \begin{pmatrix} 1 & 0 \\ 0 & \sqrt{1-p} \end{pmatrix}, \quad K_1 = \begin{pmatrix} 0 & 0 \\ 0 & \sqrt{p} \end{pmatrix}$$
   Populations remain unchanged; off-diagonal coherences scale by $\sqrt{1-p}$.
3. **Depolarizing Noise (Aer Convention)**:
   $$\mathcal{E}(\rho) = (1-p)\rho + p\frac{I}{2}$$
   Equivalent to Pauli errors with probability $p/4$ for each of $X, Y, Z$, and $1 - \frac{3}{4}p$ for identity.
4. **Bit-Flip Noise (Pauli X)**:
   $$\mathcal{E}(\rho) = (1-p)\rho + p X \rho X$$
   Kraus operators $K_0 = \sqrt{1-p}I$, $K_1 = \sqrt{p}X$.

---

## 4. Exact Measurement-Branch Ensemble Mechanics

Unlike stochastic Monte Carlo shot sampling, QubitLab computes the **exact theoretical ensemble**:
- Aer evolves the full 3-qubit density matrix up to Alice's readout.
- Projective branch probabilities $P(mZ, mX)$ are derived from orthogonal measurement projectors.
- For each branch with $P > 0$, the projected state is routed through Bob's conditional Pauli corrections ($Z^{mZ} X^{mX}$).
- Bob's unconditional output state is:
  $$\rho_{\text{out}} = \sum_{mZ, mX} P(mZ, mX) \rho_{\text{Bob}}^{(mZ, mX)}$$
- Unit trace ($\mathrm{Tr}(\rho)=1$), Hermiticity ($\rho = \rho^\dagger$), and positive semidefiniteness ($\lambda_i \ge 0$) are validated numerically.

---

## 5. The Six Interactive Pages

| Page | Route | Description |
|---|---|---|
| **Overview** | `/` | Protocol summary, live fidelity metrics, purity, Bloch sphere 3D trajectory, synchronized circuit diagram, and classical benchmark context. |
| **Circuit Simulator** | `/simulator` | Interactive $\theta$ and $\phi$ controls, state presets ($|0\rangle, |1\rangle, |+\rangle, |-\rangle, |+i\rangle$), exact density matrices $\rho_{\text{in}}$ and $\rho_{\text{out}}$, 4-branch readout table, and SVG/Text Qiskit circuit exports. |
| **Noise Laboratory** | `/noise` | Single-click selection of the 4 noise channels on Bob's qubit $q_2$, continuous strength slider $p \in [0, 1]$, and real-time degradation plots. |
| **Fidelity Analysis** | `/analysis` | Uniform Fibonacci-sphere state sample sweeps ($p = 0.0 \to 1.0$, $\Delta p = 0.1$), 4-channel comparison charts, selected results data table, continuous Haar integral cross-check, and CSV export. |
| **Error Mitigation** | `/mitigation` | Digital channel repetition ($1\times, 2\times, 3\times$ copies on $q_2$), polynomial extrapolation (Linear least-squares and Quadratic 3-point), and unclipped zero-noise estimate ($F(0)$). |
| **Theory & Viva Guide** | `/theory` | 7-step mathematical protocol breakdown, noise physics, 14 academic viva defense questions, and application architecture system diagram. |

---

## 6. Testing, Validation & Reproducibility

Execute all automated test suites locally:

```bash
# 1. Run backend unit tests & independent mathematical cross-checks
python -m pytest -q --junitxml=docs/backend-tests.xml

# 2. Run frontend component & contract tests
cd frontend
npm test

# 3. Run Playwright end-to-end browser tests
npm run test:e2e

# 4. Run compiled production SPA end-to-end tests
npm run build
E2E_BASE_URL=http://127.0.0.1:8000 E2E_REPORT_PREFIX=production npm run test:e2e
cd ..

# 5. Run single-origin production HTTP smoke checks
python scripts/verify_production.py

# 6. Recompute example reference results and figures
python scripts/export_results.py

# 7. Generate consolidated validation summary
python scripts/summarize_tests.py
```

### Execution Status:
- **Pytest (Backend & Physics)**: 103 passed, 0 failed
- **Vitest (Frontend & Contracts)**: 16 passed, 0 failed
- **Playwright E2E (Development Server)**: 8 passed, 0 failed
- **Playwright E2E (Production Server)**: 8 passed, 0 failed
- **Production HTTP Smoke Checks**: 17 passed, 0 failed
- **Total Executed Checks**: **152 passed, 0 failed, 0 skipped**

---

## 7. Project Structure

```text
quantum-teleportation/
├── backend/
│   ├── app/
│   │   ├── circuit.py          # Qiskit circuit builder, Kraus insertion on q2, SVG drawer
│   │   ├── engine.py           # Exact 4-branch ensemble simulation, Bloch maps, CPTP
│   │   ├── experiments.py      # Fibonacci-sphere sweeps, polynomial ZNE fitting
│   │   ├── main.py             # FastAPI REST endpoints, static SPA mounting
│   │   └── models.py           # Pydantic v2 strict data models (q2 noise constraint)
│   ├── tests/
│   │   ├── reference_numpy.py  # Independent pure matrix oracle (no Qiskit)
│   │   ├── test_analysis.py    # Sweeps, Haar cross-checks, classical benchmark
│   │   ├── test_api.py         # HTTP endpoint tests & invalid location rejection
│   │   ├── test_ideal.py       # Ideal teleportation on 10 diverse states
│   │   ├── test_mitigation.py  # Repeated channel scaling & ZNE extrapolation
│   │   └── test_noise.py       # Kraus completeness, noise isolation on q2
│   ├── requirements.txt        # Production dependencies
│   └── requirements-dev.txt    # Testing & development dependencies
├── frontend/
│   ├── src/
│   │   ├── components/         # CircuitViewer, Controls, BlochSphere, FidelityChart, UI
│   │   ├── lib/                # API client, types, formatters, ExperimentContext
│   │   ├── pages/              # Overview, Simulator, NoiseLab, Analysis, Mitigation, Theory
│   │   └── styles.css          # Restrained, polished scientific workstation styling
│   ├── tests/                  # Vitest unit tests & Playwright E2E test suite
│   ├── index.html              # HTML shell
│   ├── package.json            # Node dependencies (React 19, Vite 6, Tailwind 4)
│   └── vite.config.ts          # Vite build config with /api reverse proxy
├── docs/
│   ├── SCIENTIFIC_NOTES.md     # In-depth physics documentation & conventions
│   ├── TEST_REPORT.md          # Consolidated test execution report
│   └── reference-results/      # Exported CSV, JSON data, and high-res vector plots
├── scripts/
│   ├── export_results.py       # Recompute reference figures and data
│   ├── package_source.py       # Create clean distribution ZIP
│   ├── summarize_tests.py      # Consolidate JUnit test reports
│   ├── validate_qiskit_live.py # Comprehensive live numerical validation runner
│   └── verify_production.py    # Production HTTP API smoke test suite
└── README.md
```
