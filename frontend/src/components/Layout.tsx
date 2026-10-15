import { Activity, Atom, BookOpen, ChevronRight, FlaskConical, HelpCircle, LayoutDashboard, Menu, Network, RotateCcw, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useExperiment } from '../lib/ExperimentContext';
import { Badge, Button, Spinner } from './ui';

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, section: 'WORKSPACE' },
  { to: '/simulator', label: 'Circuit simulator', icon: Network },
  { to: '/noise', label: 'Noise laboratory', icon: FlaskConical },
  { to: '/analysis', label: 'Fidelity analysis', icon: TrendingUp },
  { to: '/mitigation', label: 'Error mitigation', icon: ShieldCheck },
  { to: '/theory', label: 'Theory & viva', icon: BookOpen, section: 'RESOURCES' },
];
export function Layout() {
  const { health, healthError, reset, config } = useExperiment();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const current = navigation.find(n => n.to === location.pathname)?.label || 'Workspace';
  return <div className="app-shell"><button className={`sidebar-scrim ${menuOpen ? 'visible' : ''}`} aria-label="Close navigation" onClick={() => setMenuOpen(false)} tabIndex={menuOpen ? 0 : -1} />
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}><NavLink to="/" className="brand" onClick={() => setMenuOpen(false)}><div className="brand-mark"><Atom size={26} strokeWidth={1.6} /></div><div><strong>Qubit<span>Lab</span></strong><small>QUANTUM TELEPORTATION</small></div></NavLink>
      <div className="project-tag"><span className="tiny-dot" />Research workspace<Badge>v1.0</Badge></div>
      <nav aria-label="Main navigation">{navigation.map(n => <div key={n.to}>{n.section && <div className="nav-section">{n.section}</div>}<NavLink end={n.to === '/'} to={n.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMenuOpen(false)}><n.icon size={18} /><span>{n.label}</span><ChevronRight className="nav-arrow" size={13} /></NavLink></div>)}</nav>
      <div className="sidebar-bottom"><div className="engine-card"><div><Activity size={15} /><strong>Simulation engine</strong></div><p>Qiskit Aer <span>{health ? health.qiskit_aer : '—'}</span></p><small>Density matrix · exact ensemble</small><div className={health ? 'engine-ready' : 'engine-unready'}><span className="tiny-dot" />{health ? 'Connected & ready' : healthError ? 'Backend unavailable' : 'Connecting…'}</div></div><div className="project-footer"><div className="footer-icon"><Atom size={14} /></div><div>B.Tech CSE mini-project<small>Protocol · noise · fidelity</small></div></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><Button variant="ghost" className="mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</Button><span className="breadcrumb-root">Workspace</span><ChevronRight size={13} /><strong>{current}</strong></div><div className="topbar-actions"><div className={`backend-status ${health ? 'online' : healthError ? 'offline' : ''}`}>{health ? <span className="tiny-dot" /> : healthError ? <span className="tiny-dot" /> : <Spinner />}{health ? 'Engine online' : healthError ? 'Engine offline' : 'Connecting'}</div><div className="topbar-divider" /><Button variant="ghost" onClick={reset} aria-label="Reset to ideal circuit"><RotateCcw size={15} /><span className="reset-label">Reset to ideal</span></Button><NavLink to="/theory" className="help-link" aria-label="Open theory and help"><HelpCircle size={18} /></NavLink></div></header>
      <main className="main-content"><Outlet /></main><footer className="main-footer"><span>Quantum teleportation protocol with fidelity analysis under noise</span><span><span className={`tiny-dot ${config.noise.enabled ? 'amber' : ''}`} />{config.noise.enabled ? 'Circuit noise enabled' : 'Ideal circuit selected'} · Qiskit + NumPy</span></footer>
    </div>
  </div>;
}
