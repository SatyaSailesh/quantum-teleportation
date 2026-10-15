# Scientific Implementation and Methodological Notes

## 1. Executed Protocol & Qubit Mapping

The unknown pure quantum state to be teleported is parameterized on the Bloch sphere as:
$$|\psi\rangle = \cos\left(\frac{\theta}{2}\right)|0\rangle + e^{i\phi} \sin\left(\frac{\theta}{2}\right)|1\rangle$$

Qiskit’s `U(theta, phi, 0)` gate prepares this state exactly on qubit $q_0$ from initial state $|0\rangle$.

### Qubit Assignments:
- **`q0`**: Alice's unknown input state $|\psi\rangle$ to be teleported.
- **`q1`**: Alice's half of the entangled Bell pair resource state.
- **`q2`**: Bob's half of the entangled Bell pair resource state and the sole location of circuit noise.

### The Canonical 9-Step Circuit Sequence:
1. **Prepare Input State**: Apply $U(\theta, \phi, 0)$ to qubit $q_0$.
2. **Bell-Pair Creation (Hadamard)**: Apply $H$ to qubit $q_1$.
3. **Bell-Pair Entanglement (CNOT)**: Apply $CX(1, 2)$ between Alice's $q_1$ (control) and Bob's $q_2$ (target) to create $|\Phi^+\rangle = \frac{|00\rangle + |11\rangle}{\sqrt{2}}$.
4. **Resource-State Noise**: Apply the selected noise channel $\mathcal{E}$ **exclusively to Bob's qubit $q_2$**.
5. **Alice Bell CNOT**: Apply $CX(0, 1)$ between input qubit $q_0$ and Alice's Bell qubit $q_1$.
6. **Alice Bell Hadamard**: Apply $H$ to input qubit $q_0$.
7. **Alice Projective Measurement**: Measure $q_0 \to mZ$ and $q_1 \to mX$ in the computational basis.
8. **Bob Conditional Pauli Feed-Forward**: Apply $X(q_2)$ conditioned on $mX=1$, then $Z(q_2)$ conditioned on $mZ=1$ ($Z^{mZ} X^{mX}$).
9. **Bob Output Density Matrix & Fidelity Evaluation**: Extract Bob's reduced output state $\rho_{\text{out}}$ on $q_2$ and compute exact state fidelity $F = \langle\psi|\rho_{\text{out}}|\psi\rangle$.

---

## 2. Resource-State Noise Placement (Single Supported Site)

By strict methodological design, noise is inserted at **exactly one location**:
- **Location Key**: `bell_cx_q2`
- **Target Qubit**: Bob's Bell-pair qubit $q_2$.
- **Circuit Position**: Immediately after $CX(1,2)$, prior to Alice's $CX(0,1)$ measurement operation.
- **Physical Motivation**: This models environmental decoherence and quantum channel transmission noise on the entangled Bell-pair photon/matter qubit sent across the channel to Bob before teleportation begins.

Alternative noise insertion points (such as noise on Alice's gates or noise after Bob's Pauli corrections) are explicitly rejected to preserve a unified, rigorous scientific experiment across simulation, visualization, data export, and analysis.

### Channel Definitions and Kraus Representations:
Each channel is converted to an explicit Qiskit instruction via `Kraus(error).to_instruction()` and appended directly to qubit $q_2$:

1. **Amplitude Damping (Energy Relaxation)**:
   $$K_0 = \begin{pmatrix} 1 & 0 \\ 0 & \sqrt{1-p} \end{pmatrix}, \quad K_1 = \begin{pmatrix} 0 & \sqrt{p} \\ 0 & 0 \end{pmatrix}$$
   Completeness: $K_0^\dagger K_0 + K_1^\dagger K_1 = I$. Populations relax toward $|0\rangle$; coherences decay by $\sqrt{1-p}$.

2. **Phase Damping (Dephasing / Coherence Loss)**:
   $$K_0 = \begin{pmatrix} 1 & 0 \\ 0 & \sqrt{1-p} \end{pmatrix}, \quad K_1 = \begin{pmatrix} 0 & 0 \\ 0 & \sqrt{p} \end{pmatrix}$$
   Completeness: $K_0^\dagger K_0 + K_1^\dagger K_1 = I$. Populations are completely unchanged ($\rho_{00}, \rho_{11}$ invariant); off-diagonal elements decay as $\rho_{01} \to \sqrt{1-p}\,\rho_{01}$. Distinct from a phase-flip channel.

3. **Depolarizing Noise (Aer Convention)**:
   $$\mathcal{E}(\rho) = (1-p)\rho + p\frac{I}{2}$$
   In Qiskit Aer (`depolarizing_error(p, 1)`), this is equivalent to identity with probability $1 - \frac{3}{4}p$ and each Pauli $X, Y, Z$ with probability $\frac{p}{4}$.

4. **Bit-Flip Noise (Pauli X Channel)**:
   $$\mathcal{E}(\rho) = (1-p)\rho + p X \rho X$$
   Kraus operators $K_0 = \sqrt{1-p}I$, $K_1 = \sqrt{p}X$. At $p=1$, this is a deterministic bit-flip ($X$).

---

## 3. Exact Measurement-Branch Ensemble Simulation

In standard shot-based quantum hardware, Alice's measurement randomly collapses the system into one of four classical bit outcomes $(mZ, mX) \in \{(0,0), (0,1), (1,0), (1,1)\}$.

To eliminate finite-shot statistical fluctuations and obtain deterministic research-grade results, QubitLab computes the **exact theoretical ensemble**:
1. Qiskit Aer evolves the full 3-qubit density matrix $\rho_{012}$ up to Alice's readout (after step 6).
2. For each branch $b = (mZ, mX)$, the orthogonal measurement projector is $\Pi_b = |mZ\rangle\langle mZ|_0 \otimes |mX\rangle\langle mX|_1 \otimes I_2$.
3. The exact branch probability is $P(b) = \mathrm{Tr}(\Pi_b \rho_{012} \Pi_b)$.
4. The normalized conditional pre-correction state is $\rho_{b} = \frac{\Pi_b \rho_{012} \Pi_b}{P(b)}$.
5. Aer executes Bob's feed-forward Pauli corrections ($Z^{mZ} X^{mX}$) deterministically for each branch.
6. The unconditional output state at Bob is the exact probability-weighted mixture:
   $$\rho_{\text{out}} = \sum_{b} P(b) \rho_{\text{Bob}}^{(b)}$$
7. Physical validation verifies: $\mathrm{Tr}(\rho_{\text{out}}) = 1.0 \pm 10^{-9}$, $\rho_{\text{out}} = \rho_{\text{out}}^\dagger$, and all eigenvalues $\lambda_i \ge -10^{-9}$.

---

## 4. Fidelity, Purity, and Classical Benchmark

### Fidelity Metric:
$$F(\psi, \rho_{\text{out}}) = \langle\psi|\rho_{\text{out}}|\psi\rangle$$
Because $\rho_{\text{out}}$ is a density matrix, calculating overlap directly with a statevector without density matrix mechanics is invalid. $F \in [0, 1]$, and $F = 1$ if and only if $\rho_{\text{out}} = |\psi\rangle\langle\psi|$.

### Output Purity:
$$\gamma = \mathrm{Tr}(\rho_{\text{out}}^2), \quad 0.5 \le \gamma \le 1.0$$
Pure states have $\gamma = 1$; maximally mixed states have $\gamma = 0.5$.

### The 2/3 Classical Benchmark:
For an unknown pure single-qubit state uniformly distributed across the Bloch sphere (Haar measure), any classical measure-and-prepare strategy (measuring the qubit and classically transmitting outcomes to prepare a guess state) has an optimal average fidelity of:
$$\overline{F}_{\text{classical}} = \frac{2}{3} \approx 0.6667$$
**Methodological Note**: This benchmark is an **ensemble average across uniformly distributed pure states**, NOT an individual per-state threshold. Individual states under noise may have fidelity above or below $2/3$.

### Average Fidelity via Linear CPTP Map Reconstruction:
Because the teleportation protocol is a trace-preserving completely positive linear map on Bob's qubit, the transformation of the Bloch vector $\vec{r}_{\text{in}} \mapsto \vec{r}_{\text{out}}$ is affine:
$$\vec{r}_{\text{out}} = T \vec{r}_{\text{in}} + \vec{t}$$
We reconstruct $T$ and $\vec{t}$ from 4 orthogonal circuit probes ($|0\rangle, |1\rangle, |+\rangle, |+i\rangle$). The continuous Haar average is analytically given by:
$$\overline{F}_{\text{Haar}} = \frac{1}{2} + \frac{1}{6}\mathrm{Tr}(T)$$
For discrete numerical verification, QubitLab integrates across an equal-area Fibonacci spiral lattice on the Bloch sphere ($N \in \{32, 64, 96, 128, 256\}$).

---

## 5. Digital Zero-Noise Extrapolation (ZNE)

Zero-Noise Extrapolation infers the zero-noise limit ($p \to 0$) without requiring quantum error correction codes or ancilla overhead.

- **Noise Amplification**: Implemented via digital channel repetition: the Kraus instruction on Bob's qubit $q_2$ is repeated $s \in \{1, 2, 3\}$ times.
- **Fitting Models**:
  - Linear fit: $F(\lambda) = c_0 + c_1 \lambda$ (least-squares regression).
  - Quadratic fit: $F(\lambda) = c_0 + c_1 \lambda + c_2 \lambda^2$ (3-point exact polynomial).
- **Zero-Noise Estimate**: The uncorrupted estimate is the intercept $F(0) = c_0$.
- **Scientific Caveat**: ZNE is an estimation technique for expectation values, not a state-recovery protocol. Extrapolation can produce unphysical estimates ($c_0 > 1$ or $c_0 < 0$) in high-noise regimes, which QubitLab reports honestly without clipping.

---

## 6. Verification & Automated Test Summary

Every claim in QubitLab is backed by automated test suites executed against the real code:
1. **Backend Unit & Physics Tests (Pytest)**: 103 tests passing (Hermiticity, trace-1, positivity, Kraus completeness, gate sequence, 4-branch ensemble, independent NumPy oracle cross-checks).
2. **Frontend Unit & Component Tests (Vitest)**: 16 tests passing (sliders, angles, state presets, REST error handling, single-site validation).
3. **Playwright E2E Tests (Chromium)**: 16 tests passing (8 on Vite dev proxy + 8 on compiled production SPA).
4. **Production HTTP Smoke Checks**: 17 tests passing (routes, asset hashes, REST endpoints, 404/422 handling).
5. **Total Executed Automated Checks**: **152 passing, 0 failed, 0 skipped**.
