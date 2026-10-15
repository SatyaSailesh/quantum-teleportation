import { CheckCircle2, CopyCheck, Download } from 'lucide-react';
import { useExperiment } from '../lib/ExperimentContext';
import { channelInfo, locationSummary } from '../lib/constants';
import { degrees, downloadText, f4, formatComplex } from '../lib/format';
import type { Complex, SimulationResult } from '../lib/types';
import { Badge, Button, LoadingState, Panel } from './ui';

export function DensityMatrix({ matrix, label }: { matrix: Complex[][]; label: string }) {
  return (
    <div className="density-wrap">
      <span className="matrix-label">{label} =</span>
      <div className="density-matrix" aria-label={`${label} density matrix`}>
        {matrix.flatMap((row, i) =>
          row.map((value, j) => (
            <span key={`${i}-${j}`}>{formatComplex(value)}</span>
          ))
        )}
      </div>
    </div>
  );
}

export function StateComparison() {
  const { result, fresh, busy } = useExperiment();
  const live = fresh ? result : undefined;

  return (
    <div className="state-comparison">
      <Panel title="Alice’s Prepared Input State" subtitle="Pure state |ψ⟩ on qubit q0" action={<Badge tone="cyan">|ψ⟩</Badge>}>
        <div className="state-body">
          {live ? (
            <>
              <div className="ket-expression">
                ({formatComplex(live.input_state[0])}) |0⟩<br />
                <span>+ ({formatComplex(live.input_state[1])}) |1⟩</span>
              </div>
              <DensityMatrix label="ρin" matrix={live.input_density} />
              <div className="state-meta">
                θ = {degrees(live.settings.theta).toFixed(1)}° <span>φ = {degrees(live.settings.phi).toFixed(1)}°</span>
              </div>
            </>
          ) : (
            <LoadingState compact label={busy ? 'Preparing input state…' : 'Input unavailable'} />
          )}
        </div>
      </Panel>

      <Panel title="Bob’s Reconstructed Output State" subtitle="Reduced ensemble density matrix ρout on qubit q2" action={<Badge tone="green">ρout</Badge>}>
        <div className="state-body">
          {live ? (
            <>
              <div className="state-readout">
                <div>
                  <span>FIDELITY F(ψ, ρout)</span>
                  <strong data-testid="fidelity-value">{f4(live.fidelity)}</strong>
                </div>
                <div>
                  <span>PURITY Tr(ρ²)</span>
                  <strong>{f4(live.purity)}</strong>
                </div>
              </div>
              <DensityMatrix label="ρout" matrix={live.output_density} />
              <div className="state-validation">
                <CheckCircle2 size={13} /> Hermitian · Unit trace · Positive semidefinite
              </div>
            </>
          ) : (
            <LoadingState compact label={busy ? 'Reconstructing Bob’s state…' : 'Output unavailable'} />
          )}
        </div>
      </Panel>
    </div>
  );
}

export function BranchTable() {
  const { result, fresh } = useExperiment();
  return (
    <Panel
      title={
        <>
          <CopyCheck size={17} />
          Measurement Branches & Feed-Forward Corrections
        </>
      }
      subtitle="Exact 4-branch ensemble: ρout = ∑ P(mZ, mX) ρ(mZ, mX)"
      action={<Badge>Exact Ensemble</Badge>}
    >
      {result ? (
        <div className={!fresh ? 'previous-result' : ''}>
          <div className="table-scroll">
            <table className="data-table branch-table">
              <thead>
                <tr>
                  <th>mZ (q0 readout)</th>
                  <th>mX (q1 readout)</th>
                  <th>Branch Probability</th>
                  <th>Bob’s Pauli Correction</th>
                  <th>Branch Fidelity</th>
                </tr>
              </thead>
              <tbody>
                {result.branches.map(b => (
                  <tr key={`${b.mZ}${b.mX}`}>
                    <td><span className="bit-value">{b.mZ}</span></td>
                    <td><span className="bit-value">{b.mX}</span></td>
                    <td>{(100 * b.probability).toFixed(2)}%</td>
                    <td className="mono">{b.correction === 'X Z' ? 'X then Z' : b.correction}</td>
                    <td className="mono text-slate-200">{f4(b.fidelity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-note">
            Classical feed-forward applies X conditioned on mX=1, followed by Z conditioned on mZ=1. Bob’s reduced density matrix is the probability-weighted sum across all four branches.{!fresh && <strong> Displaying previous successful run.</strong>}
          </div>
        </div>
      ) : (
        <LoadingState label="Resolving measurement branches…" compact />
      )}
    </Panel>
  );
}

export function Snapshot({ result }: { result?: SimulationResult }) {
  const { fresh } = useExperiment();
  return (
    <Panel
      title="Experiment Snapshot"
      subtitle="Recorded simulation parameters"
      action={
        <Button
          variant="ghost"
          aria-label="Export simulation JSON"
          disabled={!result || !fresh}
          onClick={() => downloadText('teleportation-result.json', JSON.stringify(result, null, 2), 'application/json')}
        >
          <Download size={15} />
        </Button>
      }
    >
      {result ? (
        <div className="snapshot-body">
          <dl>
            <div>
              <dt>Noise channel</dt>
              <dd>{result.settings.noise.enabled ? channelInfo(result.settings.noise.channel).name : 'Disabled (ideal circuit)'}</dd>
            </div>
            <div>
              <dt>Applied strength</dt>
              <dd className="mono">{result.settings.noise.enabled ? `p = ${result.settings.noise.p.toFixed(2)}` : 'p = 0.00'}</dd>
            </div>
            <div>
              <dt>Insertion site</dt>
              <dd>{result.settings.noise.enabled ? locationSummary(result.settings.noise.locations) : 'None (ideal gates)'}</dd>
            </div>
            <div>
              <dt>Fidelity loss (1 − F)</dt>
              <dd className="mono">{result.difference_from_ideal.toFixed(6)}</dd>
            </div>
            <div>
              <dt>Simulator engine</dt>
              <dd>Qiskit Aer (density_matrix method)</dd>
            </div>
            <div>
              <dt>Ensemble method</dt>
              <dd>Exact four-branch projector summation</dd>
            </div>
          </dl>
          <div className="validated-strip">
            <CheckCircle2 size={15} />Density matrix physically validated
            <span>{result.engine.elapsed_ms.toFixed(0)} ms</span>
          </div>
        </div>
      ) : (
        <LoadingState compact label="Waiting for backend response…" />
      )}
    </Panel>
  );
}
