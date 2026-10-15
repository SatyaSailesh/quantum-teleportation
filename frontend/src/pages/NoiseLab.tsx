import { ArrowRight, Check, FlaskConical, Info, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CircuitViewer } from '../components/CircuitViewer';
import { ExperimentControls } from '../components/Controls';
import { FidelityChart } from '../components/FidelityChart';
import { Badge, Button, LoadingState, Metric, PageHeading, Panel } from '../components/ui';
import { useExperiment } from '../lib/ExperimentContext';
import { CHANNELS, channelInfo } from '../lib/constants';
import { f4 } from '../lib/format';

export function NoiseLab() {
  const { config, setNoise, result, fresh, sweep, sweepBusy, sweepError, rerunSweep } = useExperiment();
  const selected = channelInfo(config.noise.channel);
  const live = fresh ? result : undefined;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="02 / CONTROLLED NOISE EXPERIMENTS"
        title="Noise Laboratory"
        description="Inject quantum noise channels into the teleportation circuit on Bob’s resource qubit (q2)."
        action={<Badge tone="amber"><FlaskConical size={12} />Resource-State Noise</Badge>}
      />

      <div className="channel-grid">
        {CHANNELS.map(c => (
          <button
            type="button"
            key={c.key}
            className={`channel-card ${config.noise.channel === c.key && config.noise.enabled ? 'active' : ''}`}
            onClick={() => setNoise({ channel: c.key, enabled: true })}
            style={{ '--channel-color': c.color } as React.CSSProperties}
          >
            <div className="channel-card-top">
              <span className="channel-symbol">{c.short}</span>
              {config.noise.channel === c.key && config.noise.enabled && <Check size={15} />}
            </div>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <div className="channel-card-footer">
              Select channel on q2<ArrowRight size={13} />
            </div>
          </button>
        ))}
      </div>

      <div className="experiment-grid">
        <div className="page-stack min-w-0">
          <Panel
            className="channel-explainer"
            title={
              <>
                <Waves size={17} />
                <span style={{ color: selected.color }}>{selected.name} Channel</span>
              </>
            }
            action={
              <Badge tone={config.noise.enabled ? 'amber' : 'neutral'}>
                {config.noise.enabled ? `Active · p = ${config.noise.p.toFixed(2)}` : 'Noise disabled (ideal)'}
              </Badge>
            }
          >
            <div className="explainer-body">
              <p>{selected.mechanism}</p>
              <div className="science-formula">{selected.formula}</div>
              <p className="field-note">
                Methodological constraint: Noise is applied exclusively to Bob’s Bell-pair qubit (q2) immediately after CX(q1, q2) and before Alice’s CX(q0, q1).
              </p>
            </div>
          </Panel>

          <div className="metric-grid three">
            <Metric
              label="STATE FIDELITY"
              value={f4(live?.fidelity)}
              detail="⟨ψ|ρout|ψ⟩ vs. original pure input"
              icon={<FlaskConical size={16} />}
            />
            <Metric
              label="FIDELITY LOSS"
              value={live ? live.difference_from_ideal.toFixed(4) : '—'}
              detail="1 − F, exact simulation loss"
              icon={<Waves size={16} />}
              accent="amber"
            />
            <Metric
              label="OUTPUT PURITY"
              value={f4(live?.purity)}
              detail={live ? (live.purity > 0.999999 ? 'Pure state' : 'Mixed state') : 'Tr(ρ²)'}
              icon={<Info size={16} />}
              accent="purple"
            />
          </div>

          <CircuitViewer />

          <Panel
            title="Executed Noise Insertion Specification"
            subtitle="Recorded instruction sequence from the simulated Qiskit circuit"
            action={<Badge tone="cyan">1 active site · q2</Badge>}
          >
            {live ? (
              live.circuit.noise_insertions.length ? (
                <div className="insertion-list">
                  {live.circuit.noise_insertions.map(point => (
                    <div key={point.location}>
                      <span className="noise-point-dot" />
                      <div>
                        <strong>{point.label}</strong>
                        <p>{point.description}</p>
                      </div>
                      <code>{channelInfo(point.channel).short} · p = {point.probability.toFixed(2)}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-note">
                  <Check size={18} />Ideal circuit mode: No noise instructions are attached to the circuit (F = 1.0).
                </div>
              )
            ) : (
              <LoadingState compact label="Inspecting circuit instructions…" />
            )}
            {live?.settings.noise.enabled && live.settings.noise.p > 0 && live.fidelity > 1 - 1e-8 && (
              <div className="inline-notice m-5">
                <Info size={16} />This input state is invariant under this channel. The physical Kraus operation is present in the circuit; fidelity is not artificially penalized.
              </div>
            )}
          </Panel>

          <Panel
            title="Single-State Fidelity Response"
            subtitle={`${selected.name} · Selected state (θ=${(config.theta * 180 / Math.PI).toFixed(1)}°, φ=${(config.phi * 180 / Math.PI).toFixed(1)}°)`}
          >
            <FidelityChart
              result={sweep}
              busy={sweepBusy}
              error={sweepError}
              retry={rerunSweep}
              channels={[config.noise.channel]}
              mode="state"
              selectedP={config.noise.enabled ? config.noise.p : 0}
              height={270}
            />
            <div className="panel-note">
              Shows how the current single pure state degrades. The classical 2/3 line is an ensemble average, not a per-state threshold.
            </div>
          </Panel>
        </div>

        <ExperimentControls compactLocations />
      </div>

      <Panel
        title="Cross-Channel Fidelity Comparison"
        subtitle="Simulated response across all 4 noise channels on Bob’s Bell-pair qubit (q2)"
        action={
          <Button onClick={rerunSweep} disabled={sweepBusy}>
            <FlaskConical size={14} />{sweepBusy ? 'Computing…' : 'Recompute comparison'}
          </Button>
        }
      >
        <FidelityChart result={sweep} busy={sweepBusy} error={sweepError} retry={rerunSweep} height={310} />
        <div className="panel-note flex items-center justify-between gap-3">
          <span>Each sweep applies one channel at a time to q2 across probabilities p ∈ [0, 1].</span>
          <Link to="/analysis" className="text-link shrink-0">
            Numerical tables & Haar averages<ArrowRight size={13} />
          </Link>
        </div>
      </Panel>
    </div>
  );
}
