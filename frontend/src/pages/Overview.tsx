import { ArrowRight, Braces, CheckCircle2, CircleDot, GitBranch, Layers, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BlochSphere } from '../components/BlochSphere';
import { CircuitViewer } from '../components/CircuitViewer';
import { FidelityChart } from '../components/FidelityChart';
import { Snapshot } from '../components/StateDisplay';
import { Badge, Metric, PageHeading, Panel } from '../components/ui';
import { useExperiment } from '../lib/ExperimentContext';
import { channelInfo } from '../lib/constants';
import { f4 } from '../lib/format';

export function Overview() {
  const { result, fresh, busy, sweep, sweepBusy, sweepError, rerunSweep } = useExperiment();
  const live = fresh ? result : undefined;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CAPSTONE RESEARCH WORKSPACE"
        title="Quantum Teleportation Protocol"
        description="Fidelity analysis under circuit-level noise channels on the shared Bell-pair resource state."
        action={
          <Link className="btn btn-primary" to="/simulator">
            <Sparkles size={15} />Open circuit simulator<ArrowRight size={15} />
          </Link>
        }
      />

      <div className="metric-grid">
        <Metric
          label="STATE FIDELITY F(ψ, ρout)"
          value={f4(live?.fidelity)}
          testId="overview-fidelity"
          detail={
            live ? (
              <span className={live.difference_from_ideal < 1e-8 ? 'text-emerald-300' : 'text-amber-300'}>
                {live.difference_from_ideal < 1e-8 ? 'Exact unitary transfer (F = 1.0)' : `${(100 * live.difference_from_ideal).toFixed(2)}% below ideal`}
              </span>
            ) : busy ? (
              'Simulating ⟨ψ|ρout|ψ⟩…'
            ) : (
              'Awaiting valid result'
            )
          }
          icon={<CircleDot size={17} />}
        />
        <Metric
          label="OUTPUT PURITY Tr(ρ²)"
          value={f4(live?.purity)}
          detail={live ? (live.purity > 0.999999 ? 'Pure state |ψ⟩⟨ψ|' : 'Mixed state ensemble') : 'Tr(ρout²)'}
          icon={<Layers size={17} />}
          accent="purple"
        />
        <Metric
          label="RESOURCE NOISE SITE"
          value={live?.settings.noise.enabled ? 'q2' : 'Ideal'}
          detail={
            live
              ? live.settings.noise.enabled
                ? `${channelInfo(live.settings.noise.channel).short} · p = ${live.settings.noise.p.toFixed(2)}`
                : 'Noise disabled (p = 0)'
              : 'Post-CX(1,2) on Bob qubit'
          }
          icon={<Braces size={17} />}
          accent="amber"
        />
        <Metric
          label="MEASUREMENT BRANCHES"
          value={live ? String(live.branches.length).padStart(2, '0') : '04'}
          detail="Exact 4-branch ensemble"
          icon={<GitBranch size={17} />}
          accent="green"
        />
      </div>

      <div className="overview-hero">
        <div className="hero-copy">
          <div className="hero-label">
            <span className="tiny-dot" />RESEARCH OBJECTIVE & PROTOCOL
          </div>
          <h2>
            Quantum Teleportation<br />
            <span>with In-Circuit Noise Analysis</span>
          </h2>
          <p>
            Alice and Bob share an entangled Bell pair (|Φ⁺⟩). Alice performs a Bell-state measurement on her half (q1) and an arbitrary input state (q0), transmitting two classical bits (mZ, mX) to Bob. Bob applies conditional Pauli corrections (Z^mZ X^mX) to recover the state.
          </p>
          <div className="hero-chips">
            <span><CheckCircle2 size={13} />Deterministic Qiskit Aer density matrix</span>
            <span>4 noise channels</span>
            <span>Resource qubit q2 insertion</span>
          </div>
          <Link className="text-link mt-5" to="/noise">
            Explore noise laboratory<ArrowRight size={14} />
          </Link>
        </div>

        <div className="hero-sphere">
          <div className="sphere-caption">
            BLOCH SPHERE TRAJECTORY<Badge tone="cyan">Geometric visualization</Badge>
          </div>
          <BlochSphere input={live?.input_bloch} output={live?.output_bloch} compact />
          <div className="sphere-note">
            Output Bloch length |r⃗|: {live ? Math.hypot(...live.output_bloch).toFixed(4) : '—'}
          </div>
        </div>
      </div>

      <CircuitViewer compact />

      <div className="overview-bottom">
        <Panel
          title="Fidelity degradation across noise channels"
          subtitle="Average fidelity over a uniform Bloch-sphere pure state sample"
          action={
            <Link className="text-link" to="/analysis">
              Comprehensive analysis<ArrowRight size={13} />
            </Link>
          }
        >
          <FidelityChart result={sweep} busy={sweepBusy} error={sweepError} retry={rerunSweep} height={260} />
          <div className="panel-note">
            Each curve reflects in-circuit noise on Bob’s Bell-pair qubit (q2) between Bell creation and Alice’s measurement.
          </div>
        </Panel>
        <Snapshot result={live} />
      </div>

      <div className="benchmark-banner">
        <div className="benchmark-number">2/3</div>
        <div>
          <strong>The Classical Average-Fidelity Benchmark</strong>
          <p>
            An optimal classical measure-and-prepare strategy for uniformly unknown pure single-qubit states achieves an ensemble average fidelity of 2/3 ≈ 0.6667. This is an ensemble average across the entire Bloch sphere, NOT an individual per-state threshold.
          </p>
        </div>
        <Link to="/theory" className="text-link">
          Scientific derivation<ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
