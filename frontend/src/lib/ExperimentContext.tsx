import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { DEFAULT_CONFIG } from './constants';
import type { ExperimentConfig, Health, NoiseConfig, SimulationResult, SweepResult } from './types';

interface ExperimentContextValue {
  config: ExperimentConfig; setState: (theta: number, phi: number) => void; setNoise: (patch: Partial<NoiseConfig>) => void;
  reset: () => void; rerun: () => void; result?: SimulationResult; busy: boolean; error: string | null;
  health?: Health; healthError: boolean; fresh: boolean;
  sweep?: SweepResult; sweepBusy: boolean; sweepError: string | null; sweepFresh: boolean;
  sampleCount: number; setSampleCount: (n: number) => void; rerunSweep: () => void;
}
const Context = createContext<ExperimentContextValue | null>(null);
const defaultConfig = () => structuredClone(DEFAULT_CONFIG);

export function ExperimentProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ExperimentConfig>(defaultConfig);
  const [result, setResult] = useState<SimulationResult>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [health, setHealth] = useState<Health>();
  const [healthError, setHealthError] = useState(false);
  const [sweep, setSweep] = useState<SweepResult>();
  const [sweepBusy, setSweepBusy] = useState(true);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState(96);
  const [sweepTick, setSweepTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const check = () => api.health(controller.signal).then(h => { setHealth(h); setHealthError(false); }).catch(e => {
      if (e.name !== 'AbortError') { setHealthError(true); setHealth(undefined); }
    });
    void check();
    const timer = setInterval(check, 20000);
    return () => { clearInterval(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(null);
    const timer = setTimeout(() => {
      api.simulate(config, controller.signal).then(data => { setResult(data); setBusy(false); }).catch(e => {
        if (e.name !== 'AbortError') { setError(e.message); setBusy(false); }
      });
    }, 260);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [config, tick]);

  const sweepRequest = useMemo(() => ({ locations: config.noise.locations, sample_count: sampleCount, theta: config.theta, phi: config.phi }), [config.noise.locations, sampleCount, config.theta, config.phi]);
  useEffect(() => {
    const controller = new AbortController();
    setSweepBusy(true); setSweepError(null);
    if (!sweepRequest.locations.length) { setSweepError('Select at least one insertion point for the noise sweep.'); setSweepBusy(false); return; }
    const timer = setTimeout(() => {
      api.sweep(sweepRequest, controller.signal).then(data => { setSweep(data); setSweepBusy(false); }).catch(e => {
        if (e.name !== 'AbortError') { setSweepError(e.message); setSweepBusy(false); }
      });
    }, 420);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sweepRequest, sweepTick]);

  const setState = useCallback((theta: number, phi: number) => setConfig(c => ({ ...c, theta, phi })), []);
  const setNoise = useCallback((patch: Partial<NoiseConfig>) => setConfig(c => ({ ...c, noise: { ...c.noise, ...patch } })), []);
  const reset = useCallback(() => { setConfig(defaultConfig()); setTick(t => t + 1); }, []);
  const fresh = !!result && JSON.stringify(result.settings) === JSON.stringify(config) && !error;
  const sweepFresh = !!sweep && JSON.stringify([...sweep.settings.locations].sort()) === JSON.stringify([...sweepRequest.locations].sort()) && sweep.settings.sample_count === sampleCount && sweep.settings.theta === config.theta && sweep.settings.phi === config.phi && !sweepError;
  return <Context.Provider value={{ config, setState, setNoise, reset, rerun: () => setTick(t => t + 1), result, busy, error, health, healthError, fresh,
    sweep, sweepBusy, sweepError, sweepFresh, sampleCount, setSampleCount, rerunSweep: () => setSweepTick(t => t + 1) }}>{children}</Context.Provider>;
}
export function useExperiment() {
  const value = useContext(Context);
  if (!value) throw new Error('ExperimentProvider is required');
  return value;
}
