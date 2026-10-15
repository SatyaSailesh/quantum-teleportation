import { ArrowRight, CheckCircle2, Download, Info, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, ErrorBox, LoadingState, Metric, PageHeading, Panel, Slider } from '../components/ui';
import { api } from '../lib/api';
import { useExperiment } from '../lib/ExperimentContext';
import { CHANNELS, channelInfo } from '../lib/constants';
import { downloadText, f4 } from '../lib/format';
import type { MitigationConfig, MitigationResult } from '../lib/types';

export function Mitigation() {
  const { config: inputConfig, sampleCount } = useExperiment();
  const [settings, setSettings] = useState<MitigationConfig>({
    channel: 'depolarizing',
    p: 0.1,
    locations: ['bell_cx_q2'],
    scales: [1, 2, 3],
    degree: 1,
    target: 'average',
    sample_count: sampleCount,
    theta: inputConfig.theta,
    phi: inputConfig.phi,
  });
  const [result, setResult] = useState<MitigationResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  const effectiveSettings = { ...settings, sample_count: sampleCount, theta: inputConfig.theta, phi: inputConfig.phi };
  const fresh = result && JSON.stringify(result.settings) === JSON.stringify(effectiveSettings);

  async function run(body = effectiveSettings) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(null);
    try {
      const data = await api.mitigate(body, controller.signal);
      setResult(data);
      setBusy(false);
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    void run();
    return () => active.current?.abort();
  }, []);

  const fitData = result
    ? Array.from({ length: 31 }, (_, i) => {
        const scale = i / 10;
        const f = result.fit.coefficients.reduce((total, c, j) => total + c * scale ** j, 0);
        return {
          scale,
          fit: f,
          measured: result.points.find(p => Math.abs(p.scale - scale) < 1e-9)?.fidelity,
          estimate: i === 0 ? result.extrapolated_fidelity : undefined,
        };
      })
    : [];

  const minF = result ? Math.min(0.4, ...fitData.map(p => p.fit), ...result.points.map(p => p.fidelity)) : 0.4;
  const maxF = result ? Math.max(1.05, ...fitData.map(p => p.fit)) : 1.05;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="04 / ERROR MITIGATION"
        title="Zero-Noise Extrapolation (ZNE)"
        description="Amplify resource-state noise via digital channel repetition, fit the degradation response, and extrapolate to the zero-noise limit."
        action={
          <Button
            disabled={!result || !fresh || busy}
            onClick={() => downloadText('zero-noise-extrapolation.json', JSON.stringify(result, null, 2), 'application/json')}
          >
            <Download size={15} />Export Experiment JSON
          </Button>
        }
      />

      <div className="mitigation-intro">
        <div className="mitigation-intro-icon">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2>Genuine Zero-Noise Extrapolation Protocol</h2>
          <p>
            Standard teleportation always includes Bob’s conditional Pauli corrections. This mitigation study digitally amplifies noise by inserting 1×, 2×, and 3× sequential Kraus channel copies on Bob’s Bell qubit (q2), fitting polynomial models to estimate the zero-noise intercept at scale 0.
          </p>
        </div>
        <Badge tone="cyan">Simulation Study</Badge>
      </div>

      <div className="experiment-grid">
        <div className="page-stack min-w-0">
          {error && <ErrorBox message={error} retry={() => void run()} />}
          {result && !fresh && (
            <div className="inline-notice">
              <Info size={15} />Settings modified. The displayed curve is from the previous run; execute extrapolation to update.
            </div>
          )}

          <div className="metric-grid three">
            <Metric
              label="NOISY BASELINE (1×)"
              value={f4(result?.baseline_fidelity)}
              detail="Actual simulated circuit fidelity"
              icon={<TriangleAlert size={16} />}
              accent="amber"
            />
            <Metric
              label="EXTRAPOLATED ESTIMATE (0×)"
              value={f4(result?.extrapolated_fidelity)}
              testId="zne-estimate"
              detail={result ? (result.fit.physical ? 'Raw estimate · unclipped' : 'Unphysical intercept · unclipped') : 'Polynomial intercept at scale 0'}
              icon={<Sparkles size={16} />}
            />
            <Metric
              label="ERROR REDUCTION"
              value={result ? `${result.improvement >= 0 ? '+' : ''}${result.improvement.toFixed(4)}` : '—'}
              detail={result ? (result.improved ? 'Closer to ideal in this regime' : 'No physical improvement') : 'Improvement not guaranteed'}
              icon={<CheckCircle2 size={16} />}
              accent={result?.improved ? 'green' : 'amber'}
            />
          </div>

          <Panel
            title="Noise-Scaling Extrapolation Curve"
            subtitle={result ? `${channelInfo(result.settings.channel).name} · baseline p = ${result.settings.p.toFixed(2)} on qubit q2` : 'Simulating amplified noise circuits…'}
            action={
              <Badge tone={result?.improved ? 'green' : 'amber'}>
                {busy ? 'Simulating…' : result?.improved ? 'Improved fidelity estimate' : 'No improvement in this regime'}
              </Badge>
            }
          >
            {!result ? (
              <LoadingState label="Executing channel-amplification circuits…" />
            ) : (
              <div className={`chart-body ${busy ? 'chart-updating' : ''}`} data-testid="mitigation-chart">
                <ResponsiveContainer width="100%" height={315} minWidth={0}>
                  <LineChart data={fitData} margin={{ top: 22, right: 26, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="#233147" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="scale"
                      type="number"
                      domain={[0, 3]}
                      ticks={[0, 1, 2, 3]}
                      tick={{ fill: '#8c9fb8', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#2b3c54' }}
                      label={{ value: 'Noise scale factor λ (channel repetitions on q2)', position: 'insideBottom', offset: -6, fill: '#8c9fb8', fontSize: 11 }}
                    />
                    <YAxis
                      domain={[minF, maxF]}
                      tick={{ fill: '#8c9fb8', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={v => Number(v).toFixed(2)}
                    />
                    <Tooltip
                      contentStyle={{ background: '#132236', border: '1px solid #35465e', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#d4e5f9' }}
                      labelFormatter={v => `Noise scale λ = ${Number(v).toFixed(1)}`}
                      formatter={v => Number(v).toFixed(5)}
                    />
                    <ReferenceLine y={1} stroke="#76c4a5" strokeDasharray="5 5" label={{ value: 'Ideal · 1.0', position: 'insideTopRight', fill: '#7bbda8', fontSize: 10 }} />
                    <Line
                      dataKey="fit"
                      name={`${result.settings.degree === 1 ? 'Linear' : 'Quadratic'} fit`}
                      stroke="#8e9fb6"
                      strokeDasharray="5 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="measured"
                      name="Simulated circuit fidelity"
                      stroke="#f4bd69"
                      strokeWidth={0}
                      dot={{ r: 5, fill: '#f4bd69', strokeWidth: 0 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="estimate"
                      name="Zero-noise estimate (λ=0)"
                      stroke="#67d9ed"
                      strokeWidth={0}
                      dot={{ r: 6, fill: '#67d9ed', stroke: '#132236', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="chart-legend static">
                  <span><i style={{ background: '#f4bd69' }} />Simulated fidelity at λ ∈ &#123;1, 2, 3&#125;</span>
                  <span><i style={{ background: '#67d9ed' }} />Extrapolated zero-noise estimate (λ=0)</span>
                  <span><i style={{ background: '#8e9fb6' }} />Polynomial fit curve</span>
                </div>
                <div className="chart-footnote">
                  {result.settings.target === 'average' ? `${result.settings.sample_count} shared pure states` : 'Selected single input state'}
                  <span>Fidelity estimator, not a recovered physical state</span>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Measured Noise Scales & Fit Statistics"
            subtitle="Raw data from explicit channel repetitions on Bob’s Bell qubit (q2)"
          >
            {result ? (
              <>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Scale factor λ</th>
                        <th>Kraus copies on q2</th>
                        <th>Effective p / site</th>
                        <th>Fidelity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.points.map(p => (
                        <tr key={p.scale}>
                          <td className="mono">{p.scale}×{p.scale === 1 && <span className="table-tag">baseline</span>}</td>
                          <td>{p.scale}</td>
                          <td className="mono">{p.effective_p_per_site.toFixed(4)}</td>
                          <td className="mono">{p.fidelity.toFixed(6)}</td>
                        </tr>
                      ))}
                      <tr className="estimate-row">
                        <td className="mono">0×<span className="table-tag">estimate</span></td>
                        <td>Extrapolated (λ = 0)</td>
                        <td>0.0000</td>
                        <td className="mono">
                          {result.extrapolated_fidelity.toFixed(6)}
                          {!result.fit.physical && ' ⚠ (unphysical)'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="panel-note">
                  Estimator weights: [{result.fit.weights.map(w => w.toFixed(4)).join(', ')}] · Fit RMSE: {result.fit.fit_rmse.toExponential(3)}. The zero-noise point is a mathematical extrapolation, not a fabricated physical measurement.
                </div>
              </>
            ) : (
              <LoadingState compact label="Simulating amplified noise circuits…" />
            )}
          </Panel>

          <Panel title="Methodological Bounds & Honest Interpretation" subtitle="Scientific scope of digital zero-noise extrapolation">
            <ul className="limitation-list">
              {(result?.warnings || [
                'This is an extrapolated fidelity estimate, not a recovered density matrix.',
                'Polynomial extrapolation may yield unphysical values (> 1 or < 0) under high noise.',
              ]).map(w => (
                <li key={w}>
                  <Info size={14} />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="panel controls-panel mitigation-controls">
          <div className="panel-heading">
            <div>
              <h2><ShieldCheck size={17} />Mitigation settings</h2>
              <p>Controlled noise-scaling parameters</p>
            </div>
          </div>
          <div className="controls-body">
            <div className="control-section">
              <label className="select-label">
                Noise channel
                <select
                  aria-label="Mitigation noise channel"
                  value={settings.channel}
                  onChange={e => setSettings(s => ({ ...s, channel: e.target.value as MitigationConfig['channel'] }))}
                >
                  {CHANNELS.filter(c => c.key !== 'bit_flip').map(c => (
                    <option value={c.key} key={c.key}>{c.name}</option>
                  ))}
                </select>
              </label>
              <Slider
                label="p · Baseline noise"
                value={settings.p}
                min={0.01}
                max={1}
                step={0.01}
                onChange={p => setSettings(s => ({ ...s, p }))}
              />
              <p className="field-note">
                Low noise (p ≤ 0.2) represents the valid perturbative regime. Bit-flip is excluded because repeated flips oscillate mod 2.
              </p>
            </div>

            <div className="control-section">
              <div className="field-label">
                <span>Resource noise site</span>
                <Badge tone="cyan">q2 only</Badge>
              </div>
              <div className="single-location-card">
                <div className="single-location-header">
                  <span className="qubit-chip">q2</span>
                  <div>
                    <strong>Bob’s Bell-pair qubit</strong>
                    <small>Channel copies repeated sequentially on q2</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="control-section">
              <div className="field-label">
                <span>Amplification scale factors</span>
                <Badge>Digital repetition</Badge>
              </div>
              <div className="noise-scales">
                {settings.scales.map(s => (
                  <div key={s}>
                    <strong>{s}×</strong>
                    <small>{s === 1 ? 'Baseline' : 'Amplified'}</small>
                  </div>
                ))}
              </div>
              <label className="select-label">
                Extrapolation model
                <select
                  aria-label="Extrapolation model"
                  value={settings.degree}
                  onChange={e => setSettings(s => ({ ...s, degree: Number(e.target.value) as 1 | 2 }))}
                >
                  <option value={1}>Linear (2 or 3 points, least-squares)</option>
                  <option value={2}>Quadratic (3-point exact fit)</option>
                </select>
              </label>
              <label className="select-label">
                Fidelity metric target
                <select
                  aria-label="Mitigation fidelity target"
                  value={settings.target}
                  onChange={e => setSettings(s => ({ ...s, target: e.target.value as 'average' | 'state' }))}
                >
                  <option value="average">Average over {sampleCount} sphere states</option>
                  <option value="state">Current input state |ψ⟩</option>
                </select>
              </label>
            </div>

            <Button
              variant="primary"
              className="w-full justify-center"
              disabled={busy}
              onClick={() => void run()}
            >
              <Sparkles size={15} />
              {busy ? 'Simulating scales…' : 'Run ZNE extrapolation'}
              <ArrowRight size={14} />
            </Button>
            <p className="field-note mt-3">
              Unclipped raw estimates are presented honestly. Teleportation conditional Pauli corrections are not mitigation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
