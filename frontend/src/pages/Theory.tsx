import { ArrowRight, BookOpen, ChevronDown, Code2, HelpCircle, Network, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, PageHeading, Panel } from '../components/ui';
import { CHANNELS } from '../lib/constants';

const questions = [
  ['What is actually teleported?', 'The unknown quantum state |ψ⟩, not a physical particle. Bob’s pre-existing qubit (q2) reconstructs the state; Alice’s original qubit (q0) is destroyed and projected by her Bell measurement.'],
  ['Why are three qubits and two classical bits needed?', 'q0 holds the unknown input state; q1 and q2 share the entangled Bell pair (|Φ⁺⟩). Alice’s joint Bell-state measurement has four possible orthogonal outcomes, so two classical bits (mZ, mX) are required to tell Bob which Pauli correction to apply.'],
  ['Which measurement bit controls which correction?', 'mZ is Alice’s q0 readout (in the computational basis after H) and controls Z(q2). mX is Alice’s q1 readout (after CX) and controls X(q2). Bob applies X if mX=1, followed by Z if mZ=1 (Z^mZ X^mX).'],
  ['Why does teleportation not violate the no-cloning theorem?', 'Alice’s input qubit is destroyed by projective measurement and does not retain |ψ⟩. After Bob applies his conditional Pauli corrections, only one copy of |ψ⟩ exists in the universe at Bob’s location.'],
  ['Can teleportation transmit information faster than light?', 'No. Bob must receive Alice’s two classical bits through a classical channel (bounded by the speed of light) to select the correct Pauli correction. Before Bob receives those bits, his reduced density matrix is maximally mixed (I/2), revealing zero information about |ψ⟩.'],
  ['Where is noise inserted in this implementation?', 'By methodological constraint, noise is inserted at exactly one location: on Bob’s Bell-pair qubit (q2) immediately after Bell-pair creation (H(q1), CX(1,2)) and before Alice’s Bell-measurement operations. This specifically models environmental decoherence and quantum channel noise on the distributed EPR resource state.'],
  ['Why use a density matrix rather than only a statevector?', 'Noisy quantum channels and statistical mixtures of measurement outcomes produce mixed states. A 2×2 density matrix represents both populations (diagonal elements) and coherences (off-diagonal elements), enabling exact calculation of fidelity F = ⟨ψ|ρout|ψ⟩, purity Tr(ρ²), and positivity validation.'],
  ['Does increasing noise strength p always reduce every state’s fidelity?', 'No. Certain quantum states can be eigenstates or invariants of specific noise channels. For example, bit-flip noise preserves the |+⟩ state (since X|+⟩ = |+⟩). We simulate the exact physics without artificially forcing a monotonic penalty.'],
  ['What does the 2/3 classical benchmark mean?', 'For an unknown pure single-qubit state uniformly distributed on the Bloch sphere, an optimal classical measure-and-prepare strategy achieves an ensemble average fidelity of 2/3 ≈ 0.6667. This is an ensemble average across the sphere, NOT a minimum threshold for every individual state.'],
  ['How are average fidelities computed efficiently?', 'Simulating four orthogonal probe states (|0⟩, |1⟩, |+⟩, |+i⟩) fully reconstructs the affine Bloch transformation r_out = T r_in + t. That linear CPTP process map is then integrated over an equal-area Fibonacci spiral lattice on the Bloch sphere. The continuous Haar integral cross-check is F_Haar = 1/2 + Tr(T)/6.'],
  ['What makes the measurement ensemble exact?', 'Aer first evolves the noisy circuit up to Alice’s readout. We extract the exact projection probabilities P(mZ, mX) = Tr(Π rho Π) for all four measurement branches, then execute deterministic conditional branches with Bob’s Qiskit if_test corrections. Summing P_b rho_b yields an exact theoretical ensemble without finite-shot statistical fluctuations.'],
  ['Is zero-noise extrapolation error correction?', 'No. ZNE is an error mitigation technique that infers an uncorrupted expectation value from controlled noisy experiments. It does not actively detect and correct syndrome errors during execution, does not use ancilla error-correction codes, and does not recover a physical quantum state.'],
  ['How is noise amplified for ZNE?', 'By digital channel repetition: the selected Kraus channel on Bob’s Bell qubit (q2) is inserted 1×, 2×, and 3× sequentially. For damping and depolarizing channels, repeated applications correspond to effective strengths 1−(1−p)^s. Extrapolation then fits a polynomial to evaluate the intercept at scale λ=0.'],
  ['What are the project’s scientific limitations?', 'This simulator executes independent single-qubit Markovian Kraus channels on qubit q2. It does not model correlated two-qubit crosstalk, non-Markovian memory effects, finite gate pulse durations, or measurement readout assignment errors. ZNE is evaluated on a simulator; physical quantum hardware would also introduce finite-shot sampling variance.'],
];

export function ArchitectureDiagram() {
  return (
    <div className="architecture-scroll">
      <svg
        viewBox="0 0 950 278"
        role="img"
        aria-label="System architecture: React client, FastAPI REST API, Qiskit Aer circuit engine and NumPy fidelity analysis"
        className="architecture-svg"
      >
        <defs>
          <marker id="architecture-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7" fill="#6c94ab" />
          </marker>
        </defs>
        <path d="M237 126H319 M502 126H583 M764 126H813" stroke="#6c94ab" strokeWidth="1.5" markerEnd="url(#architecture-arrow)" />
        <path d="M319 147H237 M583 147H502 M813 147H764" stroke="#6c94ab" strokeWidth="1.5" markerEnd="url(#architecture-arrow)" />
        {[
          { x: 20, w: 217, title: 'React 19 Frontend', sub: 'Vite 6 · TypeScript · Tailwind', desc: 'Circuit SVG, Bloch sphere, Recharts', color: '#67d9ed' },
          { x: 320, w: 183, title: 'FastAPI Backend', sub: 'Pydantic v2 validation', desc: '/simulate, /sweep, /mitigate', color: '#b09aff' },
          { x: 584, w: 180, title: 'Qiskit Aer 0.17', sub: 'Density-matrix simulation', desc: 'In-circuit Kraus on q2, if_test', color: '#f4bd69' },
          { x: 814, w: 117, title: 'NumPy 2.3', sub: 'Ensemble analytics', desc: 'Fidelity, CPTP, ZNE', color: '#83d5b5' },
        ].map(n => (
          <g key={n.title}>
            <rect x={n.x} y="75" width={n.w} height="119" rx="11" fill="#14243a" stroke="#34506b" />
            <rect x={n.x + 14} y="90" width="5" height="20" rx="2" fill={n.color} />
            <text x={n.x + 28} y="105" fill={n.color} fontSize="13" fontWeight="600">{n.title}</text>
            <text x={n.x + 14} y="135" fill="#c0d0e4" fontSize="10">{n.sub}</text>
            <text x={n.x + 14} y="156" fill="#8298b4" fontSize="9">{n.desc}</text>
          </g>
        ))}
        <text x="275" y="107" textAnchor="middle" fill="#8ca2ba" fontSize="9">JSON / REST</text>
        <text x="544" y="107" textAnchor="middle" fill="#8ca2ba" fontSize="9">QuantumCircuit</text>
        <text x="787" y="107" textAnchor="middle" fill="#8ca2ba" fontSize="9">ρ (4 branches)</text>
        <path d="M115 194V234H860V194" stroke="#2c455f" fill="none" strokeDasharray="4 5" />
        <text x="479" y="256" textAnchor="middle" fill="#8ca2ba" fontSize="10">
          Deterministic quantum execution → Bob’s reduced density matrix → Fidelity calculations & charts
        </text>
        <text x="20" y="36" fill="#7e96b2" fontSize="10" letterSpacing="2">
          APPLICATION ARCHITECTURE · SCIENTIFIC RESEARCH WORKSPACE
        </text>
      </svg>
    </div>
  );
}

export function Theory() {
  const [tab, setTab] = useState<'protocol' | 'noise' | 'viva' | 'architecture'>('protocol');
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="REFERENCE / SCIENTIFIC DOCUMENTATION"
        title="Theory & Viva Defense Guide"
        description="Quantum mechanics fundamentals, circuit execution mechanics, and academic viva preparation."
        action={
          <Link className="btn btn-secondary" to="/simulator">
            <Network size={15} />Open interactive circuit<ArrowRight size={14} />
          </Link>
        }
      />

      <div className="theory-tabs" role="tablist" aria-label="Theory topics">
        {[
          { key: 'protocol', label: 'Teleportation Protocol', icon: BookOpen },
          { key: 'noise', label: 'Noise & Fidelity Physics', icon: ShieldCheck },
          { key: 'viva', label: 'Viva Defense Questions', icon: HelpCircle },
          { key: 'architecture', label: 'System Architecture', icon: Code2 },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key as any)}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'protocol' && (
        <>
          <Panel
            title="The Canonical Three-Qubit Teleportation Sequence"
            subtitle="Shared entanglement (|Φ⁺⟩₁₂) + 2 classical bits (mZ, mX) = State Transfer"
            action={<Badge tone="cyan">q0: Input · q1: Alice Bell · q2: Bob Bell</Badge>}
          >
            <div className="protocol-steps">
              {[
                ['01. Prepare Arbitrary Input State |ψ⟩', 'Qubit q0 belongs to Alice. We apply U(θ, φ, 0) to prepare the normalized pure state on q0.', '|ψ⟩₀ = cos(θ/2)|0⟩ + eⁱᵠ sin(θ/2)|1⟩'],
                ['02. Create Bell Pair (|Φ⁺⟩₁₂)', 'Apply H(q1), followed by CX(q1, q2). Alice holds qubit q1; Bob holds qubit q2.', '|Φ⁺⟩₁₂ = (|00⟩ + |11⟩)/√2'],
                ['03. Resource-State Noise on Bob’s Qubit', 'Apply the selected quantum noise channel exclusively to Bob’s Bell-pair qubit (q2) to model channel decoherence.', 'ℰ(ρ) = ∑ Kᵢ ρ Kᵢ†  on q2 only'],
                ['04. Alice’s Bell-State Measurement', 'Alice performs joint Bell measurement by applying CX(q0, q1) and H(q0), projecting her two qubits.', 'CX(0,1) → H(0)'],
                ['05. Computational Readout & Classical Transmission', 'Alice measures q0 into classical bit mZ and q1 into classical bit mX. Four outcomes each occur with P = 1/4 (ideal).', '(mZ, mX) ∈ {(0,0), (0,1), (1,0), (1,1)}'],
                ['06. Bob’s Conditional Pauli Feed-Forward', 'Bob applies Pauli X if mX = 1, followed by Pauli Z if mZ = 1 to recover the teleported state.', 'Bob correction operator: Zᵐᶻ Xᵐˣ'],
                ['07. Reduced Density Matrix & Fidelity Evaluation', 'Trace out Alice’s qubits (q0, q1) to obtain Bob’s reduced 2×2 density matrix ρout and compute state fidelity.', 'F = ⟨ψ|ρout|ψ⟩  (Ideal: F = 1.0)'],
              ].map(([title, desc, formula], i) => (
                <div key={title} className="protocol-step">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                    <div className="science-formula">{formula}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <div className="inline-notice">
            <HelpCircle size={17} />
            Quantum teleportation transfers state information without moving physical matter. Two classical bits are strictly required to reconstruct the state; causality is preserved.
          </div>
        </>
      )}

      {tab === 'noise' && (
        <>
          <div className="theory-noise-grid">
            {CHANNELS.map(c => (
              <Panel key={c.key} title={<><span className="chart-channel-dot" style={{ background: c.color }} />{c.name}</>}>
                <div className="p-5">
                  <p className="theory-paragraph">{c.mechanism}</p>
                  <div className="science-formula mt-4">{c.formula}</div>
                  <p className="field-note mt-3">
                    Applied exclusively to Bob’s Bell-pair qubit (q2) immediately after CX(q1, q2).
                  </p>
                </div>
              </Panel>
            ))}
          </div>

          <Panel title="Mathematical Definitions of Quantitative Metrics" subtitle="Rigorous formulations">
            <div className="theory-explanation">
              <h3>Pure-Input State Fidelity</h3>
              <div className="science-formula">F(|ψ⟩, ρout) = ⟨ψ|ρout|ψ⟩</div>
              <p>
                Because the output state ρout is generally mixed under noise, comparing statevectors directly is invalid. The fidelity F is real, bounded in [0, 1], and equals 1 if and only if ρout = |ψ⟩⟨ψ|.
              </p>

              <h3>Output State Purity</h3>
              <div className="science-formula">P = Tr(ρout²), &nbsp; 0.5 ≤ P ≤ 1.0</div>
              <p>
                Purity measures degree of mixing: P = 1 for a completely pure single-qubit state, and P = 0.5 for a maximally mixed state (I/2).
              </p>

              <h3>The 2/3 Classical Average-Fidelity Benchmark</h3>
              <p>
                For an unknown pure qubit state uniformly distributed on the Bloch sphere, any classical measure-and-prepare protocol (measuring the qubit and transmitting classical outcomes to prepare an estimate) is mathematically bounded by an average fidelity of <strong>2/3 ≈ 0.6667</strong>. This is an <em>ensemble average</em>, not an individual per-state threshold.
              </p>

              <h3>Parameter Conventions in Qiskit Aer</h3>
              <p>
                • <strong>Amplitude Damping:</strong> K0 = diag(1, √(1-p)), K1 = √p |0⟩⟨1|.<br />
                • <strong>Phase Damping:</strong> Populations unchanged; off-diagonal coherences scaled by √(1-p).<br />
                • <strong>Depolarizing:</strong> ℰ(ρ) = (1-p)ρ + p(I/2). Each non-identity Pauli (X, Y, Z) occurs with probability p/4.<br />
                • <strong>Bit-Flip:</strong> ℰ(ρ) = (1-p)ρ + p XρX.
              </p>
            </div>
          </Panel>
        </>
      )}

      {tab === 'viva' && (
        <Panel title="Viva Defense Questions & Academic Answers" subtitle="Physics fundamentals, engineering choices, and limitations" action={<Badge>{questions.length} questions</Badge>}>
          <div className="viva-list">
            {questions.map(([question, answer], i) => (
              <div className="viva-item" key={question}>
                <button
                  type="button"
                  onClick={() => setOpenQuestion(openQuestion === i ? null : i)}
                  aria-expanded={openQuestion === i}
                >
                  <span className="viva-number">{String(i + 1).padStart(2, '0')}</span>
                  <strong>{question}</strong>
                  <ChevronDown size={16} className={openQuestion === i ? 'rotate-180' : ''} />
                </button>
                {openQuestion === i && <p>{answer}</p>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'architecture' && (
        <>
          <Panel title="System Architecture & Software Engineering" subtitle="Production-grade client-server decoupling">
            <ArchitectureDiagram />
          </Panel>
          <div className="method-grid panel">
            <div>
              <h3>Frontend Architecture</h3>
              <p>
                React 19, TypeScript, Vite 6, Tailwind CSS 4, and Recharts 3. Real-time SVG rendering generated directly from Qiskit backend instructions. Responsive layout with clean scientific workstation aesthetics.
              </p>
            </div>
            <div>
              <h3>Backend Simulation Engine</h3>
              <p>
                FastAPI with Pydantic v2 validation. Qiskit 2.5 constructs the circuit; Qiskit Aer 0.17 executes density-matrix evolution; NumPy 2.3 computes Bloch vectors, state purities, and ZNE polynomial regression.
              </p>
            </div>
            <div>
              <h3>Reproducibility & Integrity</h3>
              <p>
                Exact deterministic seeds (731), 4-branch projective ensemble summation, Fibonacci-sphere equal-area lattices, and continuous Haar analytical integral cross-checks. Zero synthetic fallback values.
              </p>
            </div>
          </div>
          <Panel title="REST API Endpoint Contract" subtitle="OpenAPI documentation available at /docs">
            <div className="table-scroll">
              <table className="data-table api-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['GET', '/api/health', 'Liveness check, Qiskit & Aer version metadata'],
                    ['GET', '/api/config', 'Valid channel definitions, noise site specification (q2), classical benchmark'],
                    ['POST', '/api/simulate', 'Execute 3-qubit teleportation circuit → Bob’s density matrix, fidelity, branches, SVG'],
                    ['POST', '/api/sweep', 'Evaluate 4 channels across p ∈ [0, 1] on uniform Bloch-sphere lattice'],
                    ['POST', '/api/mitigate', 'Digital noise-amplification (1×, 2×, 3×) on q2 with polynomial ZNE extrapolation'],
                    ['POST', '/api/circuit/native', 'Native Qiskit Matplotlib horizontal circuit drawer in SVG format'],
                  ].map(([method, endpoint, purpose]) => (
                    <tr key={endpoint}>
                      <td><Badge tone={method === 'GET' ? 'green' : 'cyan'}>{method}</Badge></td>
                      <td className="mono">{endpoint}</td>
                      <td>{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
