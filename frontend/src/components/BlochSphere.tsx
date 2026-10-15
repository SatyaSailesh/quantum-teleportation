import { useId } from 'react';

export function BlochSphere({ input, output, compact = false }: { input?: number[]; output?: number[]; compact?: boolean }) {
  const id = useId().replaceAll(':', '');
  const project = (v: number[]) => [156 + 103 * (0.7071 * v[0] - 0.7071 * v[1]), 144 + 103 * (0.4056 * v[0] + 0.4056 * v[1] - 0.8192 * v[2])];
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return <div className={`bloch-wrap ${compact ? 'bloch-compact' : ''}`}><svg role="img" aria-label="Bloch sphere: original and reconstructed state vectors" viewBox="0 0 312 280">
    <defs><radialGradient id={`sphere-${id}`} cx="38%" cy="35%"><stop offset="0" stopColor="#21485a" stopOpacity="0.65" /><stop offset="1" stopColor="#112432" stopOpacity="0.25" /></radialGradient><marker id={`in-${id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#67e8f9" /></marker><marker id={`out-${id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#f5bc73" /></marker></defs>
    <circle cx="156" cy="144" r="103" fill={`url(#sphere-${id})`} stroke="#3a6b83" strokeWidth="1" />
    <ellipse cx="156" cy="144" rx="103" ry="39" fill="none" stroke="#3a6b83" strokeWidth="0.8" />
    <ellipse cx="156" cy="144" rx="50" ry="103" fill="none" stroke="#305c73" strokeWidth="0.8" transform="rotate(-27 156 144)" />
    <ellipse cx="156" cy="144" rx="50" ry="103" fill="none" stroke="#305c73" strokeWidth="0.8" transform="rotate(27 156 144)" />
    {axes.map((v, i) => { const [x, y] = project(v.map(n => n * 1.2)); const [bx, by] = project(v.map(n => -n * 1.15)); return <g key={i}><line x1={bx} y1={by} x2={x} y2={y} stroke="#68809b" strokeWidth="0.9" strokeDasharray="3 4" /><text x={x + (i === 1 ? -13 : 5)} y={y + (i === 2 ? -4 : 10)} fill="#8fa9c6" fontSize="11" fontFamily="monospace">{['x', 'y', 'z'][i]}</text></g>; })}
    <text x="166" y="47" fontSize="10" fill="#a8c3d9">|0⟩</text><text x="166" y="248" fontSize="10" fill="#a8c3d9">|1⟩</text>
    {input && <g><line x1="156" y1="144" x2={project(input)[0]} y2={project(input)[1]} stroke="#67e8f9" strokeWidth="3" markerEnd={`url(#in-${id})`} /><circle cx={project(input)[0]} cy={project(input)[1]} r="4" fill="#67e8f9" /><text x={project(input)[0] + 9} y={project(input)[1] - 8} fill="#a5f3fc" fontSize="11">|ψ⟩</text></g>}
    {output && <g><line x1="156" y1="144" x2={project(output)[0]} y2={project(output)[1]} stroke="#f5bc73" strokeWidth="2" strokeDasharray="4 3" markerEnd={`url(#out-${id})`} /><circle cx={project(output)[0]} cy={project(output)[1]} r="3" fill="#f5bc73" /><text x={project(output)[0] + 9} y={project(output)[1] + 16} fill="#f5bc73" fontSize="11">ρB</text></g>}
    <circle cx="156" cy="144" r="3" fill="#bdd3e6" />
  </svg><div className="bloch-legend"><span><i style={{ background: '#67e8f9' }} />Input state</span><span><i style={{ background: '#f5bc73' }} />Bob’s output</span></div></div>;
}
