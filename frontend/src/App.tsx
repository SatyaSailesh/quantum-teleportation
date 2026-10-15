import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ExperimentProvider } from './lib/ExperimentContext';
import { Overview } from './pages/Overview';
import { Simulator } from './pages/Simulator';
import { NoiseLab } from './pages/NoiseLab';
import { Analysis } from './pages/Analysis';
import { Mitigation } from './pages/Mitigation';
import { Theory } from './pages/Theory';

export default function App() {
  return <BrowserRouter><ExperimentProvider><Routes><Route element={<Layout />}><Route index element={<Overview />} /><Route path="simulator" element={<Simulator />} /><Route path="noise" element={<NoiseLab />} /><Route path="analysis" element={<Analysis />} /><Route path="mitigation" element={<Mitigation />} /><Route path="theory" element={<Theory />} /><Route path="*" element={<div className="page-stack"><h1 className="text-3xl">Page not found</h1><p>This workspace has six pages. Use the navigation to return to a quantum experiment.</p></div>} /></Route></Routes></ExperimentProvider></BrowserRouter>;
}
