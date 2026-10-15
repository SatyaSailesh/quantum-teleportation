import { Download, Info, RefreshCw, ScanLine, TrendingUp } from 'lucide-react';
import { FidelityChart } from '../components/FidelityChart';
import { Badge, Button, LoadingState, PageHeading, Panel } from '../components/ui';
import { useExperiment } from '../lib/ExperimentContext';
import { CHANNELS, locationSummary } from '../lib/constants';
import { downloadText, sweepCsv } from '../lib/format';

export function Analysis() {
  const { sampleCount, setSampleCount, sweep, sweepBusy, sweepError, sweepFresh, rerunSweep } = useExperiment();
  const halfway = sweep?.points.find(p => p.p === 0.5);
  const best = halfway && [...CHANNELS].sort((a, b) => halfway.channels[b.key].average_fidelity - halfway.channels[a.key].average_fidelity)[0];

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="03 / QUANTITATIVE ANALYSIS"
        title="Fidelity Analysis"
        description="Comprehensive evaluation of all four noise channels across a uniform Fibonacci-sphere pure state sample."
        action={
          <Button
            disabled={!sweep || !sweepFresh || sweepBusy}
            onClick={() => downloadText('teleportation-fidelity-sweep.csv', sweepCsv(sweep!), 'text/csv')}
          >
            <Download size={15} />Export CSV Data
          </Button>
        }
      />

      <div className="analysis-toolbar">
        <div>
          <ScanLine size={17} />
          <span>Probability sweep:</span>
          <code>p = 0.0 → 1.0 · step 0.1</code>
        </div>
        <div>
          <label>
            State sample
            <select
              aria-label="State sample count"
              value={sampleCount}
              onChange={e => setSampleCount(Number(e.target.value))}
            >
              {[32, 64, 96, 128, 256].map(n => (
                <option key={n} value={n}>{n} states (Fibonacci sphere)</option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={rerunSweep} disabled={sweepBusy}>
            <RefreshCw size={14} className={sweepBusy ? 'animate-spin' : ''} />
            {sweepBusy ? 'Computing…' : 'Run sweep'}
          </Button>
        </div>
      </div>

      <Panel
        title={
          <>
            <TrendingUp size={17} />
            Average Fidelity vs. Noise Probability p
          </>
        }
        subtitle={locationSummary(['bell_cx_q2'])}
        action={<Badge tone="cyan">{sweep?.settings.sample_count || sampleCount} pure states</Badge>}
      >
        <FidelityChart result={sweep} busy={sweepBusy} error={sweepError} retry={rerunSweep} height={360} />
        <div className="chart-context">
          <Info size={16} />
          <p>
            The dashed 2/3 line represents the optimal <strong>classical measure-and-prepare average fidelity</strong> for uniformly distributed unknown pure single-qubit states. It is an ensemble average, not a per-state threshold.
          </p>
        </div>
      </Panel>

      {sweep && !sweepFresh && (
        <div className="inline-notice">
          <Info size={15} />Previous sweep shown in table and summary. Re-run sweep to synchronize with current sample size.
        </div>
      )}

      {sweep && (
        <div className={`analysis-insights ${!sweepFresh ? 'previous-result' : ''}`}>
          <div>
            <div className="section-label">SIMULATED PROCESS MAPS</div>
            <strong>44 linear CPTP maps</strong>
            <p>4 channels × 11 probabilities. Each map reconstructed via 4 exact Aer circuit probes.</p>
          </div>
          <div>
            <div className="section-label">CHANNEL ROBUSTNESS AT p = 0.5</div>
            <strong style={{ color: best?.color }}>{best?.name}</strong>
            <p>Highest average fidelity: {best && halfway ? halfway.channels[best.key].average_fidelity.toFixed(5) : '—'} on qubit q2.</p>
          </div>
          <div>
            <div className="section-label">SPHERE INTEGRATION LATTICE</div>
            <strong>{sweep.settings.sample_count} Fibonacci points</strong>
            <p className="mono">Lattice Hash: {sweep.settings.sample_id}</p>
          </div>
        </div>
      )}

      <Panel
        title="Sampled Average Fidelity Results"
        subtitle="Sample mean across uniform pure states at key noise strengths"
        action={<Badge>F = ⟨ψ|ρout|ψ⟩</Badge>}
      >
        {sweep ? (
          <div className={sweepBusy || !sweepFresh ? 'previous-result' : ''}>
            <div className="table-scroll">
              <table className="data-table fidelity-table" data-testid="fidelity-results-table">
                <thead>
                  <tr>
                    <th>Noise p</th>
                    {CHANNELS.map(c => (
                      <th key={c.key}>
                        <span style={{ color: c.color }}>{c.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sweep.table.map(point => (
                    <tr key={point.p}>
                      <td className="mono">
                        <span className="probability-value">{point.p.toFixed(1)}</span>
                      </td>
                      {CHANNELS.map(c => (
                        <td key={c.key} className="mono">
                          <span
                            className={
                              point.channels[c.key].average_fidelity < 2 / 3 - 1e-8
                                ? 'below-benchmark'
                                : 'text-slate-200'
                            }
                          >
                            {point.channels[c.key].average_fidelity.toFixed(5)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-note">
              Values highlighted in amber fall below the classical average benchmark (2/3 ≈ 0.66667). The CSV export contains both the discrete sample mean and the exact continuous Haar integral cross-check F_Haar = 1/2 + Tr(T)/6.
            </div>
          </div>
        ) : (
          <LoadingState compact label="Calculating fidelity table…" />
        )}
      </Panel>

      <div className="individual-charts">
        {CHANNELS.map(c => (
          <Panel
            key={c.key}
            title={
              <>
                <span className="chart-channel-dot" style={{ background: c.color }} />
                {c.name}
              </>
            }
            subtitle="Average fidelity curve on Bob's Bell qubit (q2)"
          >
            <FidelityChart
              result={sweep}
              busy={sweepBusy}
              error={sweepError}
              retry={rerunSweep}
              channels={[c.key]}
              height={235}
              legend={false}
            />
          </Panel>
        ))}
      </div>

      <Panel title="Mathematical Foundations of the Analysis" subtitle="Rigorous simulation & averaging methodology">
        <div className="method-grid">
          <div>
            <span className="method-number">01</span>
            <h3>Deterministic Aer Simulation</h3>
            <p>
              Qiskit Aer simulates in-circuit Kraus noise on q2 followed by exact projective measurement on (q0, q1) and Bob’s feed-forward Pauli corrections.
            </p>
          </div>
          <div>
            <span className="method-number">02</span>
            <h3>CPTP Map Reconstruction</h3>
            <p>
              Simulating four orthogonal probe states (|0⟩, |1⟩, |+⟩, |+i⟩) fully reconstructs the affine transformation r_out = T r_in + t of the Bloch vector.
            </p>
          </div>
          <div>
            <span className="method-number">03</span>
            <h3>Uniform Spherical Averaging</h3>
            <p>
              The reconstructed channel is integrated across an equal-area Fibonacci spiral lattice on the Bloch sphere, cross-verified with the analytical Haar average 1/2 + Tr(T)/6.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
