import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHANNELS, channelInfo } from '../lib/constants';
import type { ChannelKey, SweepResult } from '../lib/types';
import { ErrorBox, LoadingState } from './ui';

export function FidelityChart({ result, busy = false, error, retry, channels = CHANNELS.map(c => c.key), height = 290, mode = 'average', legend = true, selectedP }: { result?: SweepResult; busy?: boolean; error?: string | null; retry?: () => void; channels?: ChannelKey[]; height?: number; mode?: 'average' | 'state'; legend?: boolean; selectedP?: number }) {
  const [hidden, setHidden] = useState<Set<ChannelKey>>(new Set());
  if (error) return <div className="chart-body"><ErrorBox message={error} retry={retry} /></div>;
  if (!result) return <LoadingState label="Simulating 44 circuit-derived process maps…" />;
  const data = result.points.map(point => ({ p: point.p, ...Object.fromEntries(channels.map(key => [key, mode === 'average' ? point.channels[key]?.average_fidelity : point.channels[key]?.state_fidelity])) }));
  return <div className={`chart-body ${busy ? 'chart-updating' : ''}`} data-testid="fidelity-chart">
    {busy && <div className="chart-refresh-label">Recomputing · previous sweep shown</div>}
    <ResponsiveContainer width="100%" height={height} minWidth={0}>
      <LineChart data={data} margin={{ top: 24, right: 23, bottom: 12, left: 1 }}>
        <CartesianGrid stroke="#233147" strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="p" type="number" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tick={{ fill: '#8c9fb8', fontSize: 11 }} axisLine={{ stroke: '#2a3c53' }} tickLine={false} label={{ value: 'Noise probability p', position: 'insideBottom', offset: -9, fill: '#7d91ad', fontSize: 11 }} tickFormatter={v => Number(v).toFixed(1)} />
        <YAxis type="number" domain={[0, 1.06]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tick={{ fill: '#8c9fb8', fontSize: 11 }} axisLine={false} tickLine={false} width={42} tickFormatter={v => Number(v).toFixed(1)} />
        <Tooltip contentStyle={{ background: '#132236', border: '1px solid #35465e', borderRadius: 9, fontSize: 12, boxShadow: '0 8px 24px #0005' }} labelStyle={{ color: '#d4e5f9', marginBottom: 5 }} labelFormatter={v => `p = ${Number(v).toFixed(1)}`} formatter={v => Number(v).toFixed(5)} cursor={{ stroke: '#456078', strokeDasharray: '4 3' }} />
        <ReferenceLine y={1} stroke="#76c4a5" strokeDasharray="5 5" label={{ value: 'Ideal · 1.0', position: 'insideTopRight', fill: '#7bbda8', fontSize: 10 }} />
        {mode === 'average' && <ReferenceLine y={2 / 3} stroke="#a4a6aa" strokeDasharray="5 5" label={{ value: 'Classical average · 2/3', position: 'insideBottomLeft', fill: '#929ca9', fontSize: 10 }} />}
        {selectedP !== undefined && <ReferenceLine x={selectedP} stroke="#667d94" strokeDasharray="2 3" />}
        {channels.filter(c => !hidden.has(c)).map(c => <Line key={c} name={channelInfo(c).name} dataKey={c} type="linear" stroke={channelInfo(c).color} strokeWidth={2.4} dot={{ r: 2.2, strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#111b2c', strokeWidth: 2 }} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
    {legend && <div className="chart-legend">{channels.map(c => <button type="button" key={c} className={hidden.has(c) ? 'muted' : ''} aria-pressed={!hidden.has(c)} onClick={() => setHidden(previous => { const next = new Set(previous); if (next.has(c)) next.delete(c); else next.add(c); return next; })}><i style={{ background: channelInfo(c).color }} />{channelInfo(c).name}</button>)}</div>}
    <div className="chart-footnote">{mode === 'average' ? `${result.settings.sample_count} equal-area pure states · Δp = 0.1 · same selected circuit sites` : 'Your selected input state · not a Bloch-sphere average'}<span>Calculated by Qiskit Aer</span></div>
  </div>;
}
