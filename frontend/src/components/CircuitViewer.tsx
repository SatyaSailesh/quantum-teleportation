import { Code2, Download, Network, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useExperiment } from '../lib/ExperimentContext';
import { downloadText } from '../lib/format';
import { Badge, Button, ErrorBox, LoadingState, Panel, Spinner } from './ui';

export function CircuitViewer({ compact = false }: { compact?: boolean }) {
  const { result, busy, error, fresh, rerun } = useExperiment();
  const [view, setView] = useState<'readable' | 'native' | 'text'>('readable');
  const [native, setNative] = useState('');
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [nativeBusy, setNativeBusy] = useState(false);
  const [nativeTick, setNativeTick] = useState(0);
  const settings = result?.settings;
  useEffect(() => {
    if (view !== 'native' || !settings) return;
    const controller = new AbortController();
    setNative(''); setNativeBusy(true); setNativeError(null);
    api.nativeCircuit(settings, controller.signal).then(svg => { setNative(svg); setNativeBusy(false); }).catch(e => {
      if (e.name !== 'AbortError') { setNativeError(e.message); setNativeBusy(false); }
    });
    return () => controller.abort();
  }, [view, settings, nativeTick]);
  const svg = view === 'native' ? native : result?.circuit.svg;
  return <Panel className="circuit-panel" title={<><Network size={17} /><span>Teleportation circuit</span><Badge tone={result?.settings.noise.enabled ? 'amber' : 'green'}>{result?.settings.noise.enabled ? 'Noisy circuit' : 'Ideal circuit'}</Badge></>} subtitle="Generated from the Qiskit instructions used by the simulator" action={<>
    {!compact && <div className="segmented-control"><button className={view === 'readable' ? 'selected' : ''} onClick={() => setView('readable')} type="button">Readable</button><button className={view === 'native' ? 'selected' : ''} onClick={() => setView('native')} type="button">Qiskit native</button><button aria-label="Qiskit circuit text" className={view === 'text' ? 'selected' : ''} onClick={() => setView('text')} type="button"><Code2 size={13} /></button></div>}
    <Button variant="ghost" aria-label="Download circuit SVG" title="Download actual circuit SVG" disabled={!svg || !fresh || nativeBusy} onClick={() => downloadText('teleportation-circuit.svg', svg!, 'image/svg+xml')}><Download size={15} /></Button>
  </>}>
    {error && <div className="px-5 pt-4"><ErrorBox message={error} retry={rerun} /></div>}
    {!result ? <LoadingState label={error ? 'No simulation result is available.' : 'Preparing the three-qubit circuit…'} /> : <>
      <div className="circuit-status"><div><span className="circuit-key quantum" />Quantum wire<span className="circuit-key classical" />Classical feed-forward<span className="circuit-key noise" />Selected channel</div><span>{busy ? <><Spinner /> Updating…</> : !fresh ? 'Last successful run · settings changed' : <><span className="tiny-dot" />Circuit and result synchronized</>}</span></div>
      <div className={`circuit-scroll ${compact ? 'compact-circuit' : ''}`} data-testid="circuit-view" aria-busy={busy || nativeBusy}>
        {view === 'text' ? <pre className="native-text">{result.circuit.text}</pre> : nativeBusy ? <LoadingState label="Drawing the native Qiskit circuit…" /> : nativeError && view === 'native' ? <ErrorBox message={nativeError} retry={() => setNativeTick(t => t + 1)} /> : svg && <div className={view === 'native' ? 'native-svg' : 'circuit-svg'} dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
      <div className="circuit-footer"><span><strong>mZ ← q0</strong> controls Z · <strong>mX ← q1</strong> controls X</span><span>{result.circuit.operations.filter(o => o.noise).length} channel instructions · 3 qubits · 2 bits</span></div>
    </>}
  </Panel>;
}

export function SimulationNotice() {
  const { result, busy, error, rerun } = useExperiment();
  if (error) return <ErrorBox message={error} retry={rerun} />;
  if (busy && result) return <div className="inline-notice"><RefreshCw size={14} className="animate-spin" /> Recalculating the circuit. Previous results are labelled and exports are paused.</div>;
  return null;
}
