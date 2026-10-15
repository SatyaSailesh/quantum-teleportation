import { AlertTriangle, ArrowUpRight, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Spinner({ className = '' }: { className?: string }) { return <LoaderCircle aria-label="Loading" className={`h-4 w-4 animate-spin ${className}`} />; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'cyan' | 'green' | 'amber' | 'red' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function Button({ children, variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) { return <button type="button" className={`btn btn-${variant} ${className}`} {...props}>{children}</button>; }
export function Panel({ children, title, subtitle, action, className = '' }: { children: ReactNode; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>
    {(title || action) && <div className="panel-heading"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action && <div className="panel-actions">{action}</div>}</div>}
    {children}
  </section>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-actions">{action}</div>}</div>;
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-box" role="alert"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>Experiment could not be completed</strong><p>{message}</p><p className="text-xs opacity-70">No placeholder results are substituted.</p></div>{retry && <Button variant="ghost" onClick={retry}><RefreshCw size={14} /> Retry</Button>}</div>;
}
export function LoadingState({ label = 'Running the quantum circuit…', compact = false }: { label?: string; compact?: boolean }) {
  return <div className={`loading-state ${compact ? 'compact' : ''}`}><div className="loading-orbit"><Spinner className="h-5 w-5" /></div><span>{label}</span></div>;
}
export function Metric({ label, value, detail, icon, accent = 'cyan', testId }: { label: string; value: ReactNode; detail: ReactNode; icon: ReactNode; accent?: string; testId?: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${accent}`}>{icon}</div></div><div className="metric-value" data-testid={testId}>{value}</div><div className="metric-detail">{detail}</div></div>;
}
export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} type="button" disabled={disabled}><span /></button>;
}
export function Slider({ label, value, min, max, step, onChange, unit = '', disabled = false, testId }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string; disabled?: boolean; testId?: string }) {
  const precision = step >= 1 ? 0 : 2;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Number(value.toFixed(precision))));
  const bounded = (n: number) => Number(Math.min(max, Math.max(min, Math.round(n / step) * step)).toFixed(precision));
  useEffect(() => { if (!editing) setDraft(String(Number(value.toFixed(precision)))); }, [value, editing, precision]);
  return <div className={`slider-field ${disabled ? 'is-disabled' : ''}`}><div className="field-label"><span>{label}</span><div className="number-field"><input type="number" min={min} max={max} step={step} value={draft} disabled={disabled} aria-label={`${label} value`} onFocus={() => setEditing(true)} onBlur={() => {
    const n = draft.trim() === '' ? value : Number(draft);
    const next = Number.isFinite(n) ? bounded(n) : value;
    setDraft(String(Number(next.toFixed(precision)))); setEditing(false); if (Math.abs(next - value) > 1e-12) onChange(next);
  }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} onChange={e => {
    setDraft(e.target.value);
    if (e.target.value !== '') { const n = Number(e.target.value); if (Number.isFinite(n) && n >= min && n <= max) onChange(bounded(n)); }
  }} />{unit && <span>{unit}</span>}</div></div><input data-testid={testId} className="range-input" type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} disabled={disabled} style={{ background: `linear-gradient(to right, #67d7ea 0%, #67d7ea ${(value - min) / (max - min) * 100}%, #2a374c ${(value - min) / (max - min) * 100}%, #2a374c 100%)` }} /><div className="range-limits"><span>{min}{unit}</span><span>{max}{unit}</span></div></div>;
}
export function TextLink({ children, href }: { children: ReactNode; href: string }) { return <a className="text-link" href={href}>{children}<ArrowUpRight size={14} /></a>; }
