import { Download, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CircuitViewer, SimulationNotice } from '../components/CircuitViewer';
import { ExperimentControls } from '../components/Controls';
import { BlochSphere } from '../components/BlochSphere';
import { BranchTable, StateComparison } from '../components/StateDisplay';
import { Badge, Button, PageHeading, Panel } from '../components/ui';
import { useExperiment } from '../lib/ExperimentContext';
import { downloadText } from '../lib/format';

export function Simulator() {
  const { result, fresh } = useExperiment();
  const live = fresh ? result : undefined;
  return <div className="page-stack"><PageHeading eyebrow="01 / PROTOCOL" title="Circuit simulator" description="Prepare Alice’s input, follow the classical bits, and inspect Bob’s reconstructed density matrix." action={<Button onClick={() => downloadText('teleportation-result.json', JSON.stringify(result, null, 2), 'application/json')} disabled={!fresh}><Download size={15} />Export result</Button>} />
    <SimulationNotice />
    <div className="experiment-grid"><div className="page-stack min-w-0"><CircuitViewer /><StateComparison /><BranchTable />
      <Panel title="State-vector geometry" subtitle="Bloch coordinates calculated from the input and output density matrices" action={<Badge tone="cyan">r = Tr(ρσ)</Badge>}><div className="geometry-panel"><BlochSphere input={live?.input_bloch} output={live?.output_bloch} /><div className="bloch-coordinates"><h3>Original → reconstructed</h3>{['x', 'y', 'z'].map((axis, i) => <div key={axis}><span>{axis}</span><code>{live ? live.input_bloch[i].toFixed(5) : '—'}</code><span>→</span><code>{live ? live.output_bloch[i].toFixed(5) : '—'}</code></div>)}<p>A mixed state’s Bloch vector lies inside the unit sphere. A pure state lies on its surface.</p></div></div></Panel>
      <div className="inline-notice"><FlaskConical size={15} /><span>Ready to compare the four noise mechanisms? <Link className="inline-link" to="/noise">Open the noise laboratory →</Link></span></div>
    </div><ExperimentControls /></div>
  </div>;
}
