import { RotateCcw, SlidersHorizontal, Zap } from 'lucide-react';
import { useExperiment } from '../lib/ExperimentContext';
import { CHANNELS, channelInfo } from '../lib/constants';
import { degrees, radians } from '../lib/format';
import type { ChannelKey, LocationKey } from '../lib/types';
import { Badge, Button, Slider, Switch } from './ui';

export function LocationPicker(_props?: { value?: LocationKey[]; onChange?: (v: LocationKey[]) => void; compact?: boolean }) {
  return (
    <div className="location-picker">
      <div className="field-label">
        <span>Resource noise insertion site</span>
        <Badge tone="cyan">Single site · q2</Badge>
      </div>
      <div className="single-location-card" data-testid="single-noise-site">
        <div className="single-location-header">
          <span className="qubit-chip">q2</span>
          <div>
            <strong>Bob’s Bell-pair qubit</strong>
            <small>Immediately after CX(q1, q2) · before Alice’s CX(q0, q1)</small>
          </div>
        </div>
        <p className="field-note mt-2">
          Methodological constraint: Noise is applied exclusively to Bob’s half of the Bell pair during transmission across the quantum channel.
        </p>
      </div>
    </div>
  );
}

export function ExperimentControls({ compactLocations = false }: { compactLocations?: boolean }) {
  const { config, setState, setNoise, busy, rerun, reset } = useExperiment();
  const activeChannel = channelInfo(config.noise.channel);

  return (
    <aside className="panel controls-panel">
      <div className="panel-heading">
        <div>
          <h2><SlidersHorizontal size={16} /> Experiment controls</h2>
          <p>Updates execute the actual circuit</p>
        </div>
        <span className="live-dot" />
      </div>
      <div className="controls-body">
        <div className="control-section">
          <div className="section-label">INPUT STATE |ψ⟩</div>
          <div className="state-presets">
            {[
              { label: '|0⟩', theta: 0, phi: 0 },
              { label: '|1⟩', theta: Math.PI, phi: 0 },
              { label: '|+⟩', theta: Math.PI / 2, phi: 0 },
              { label: '|−⟩', theta: Math.PI / 2, phi: Math.PI },
              { label: '|+i⟩', theta: Math.PI / 2, phi: Math.PI / 2 },
            ].map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => setState(s.theta, s.phi)}
                className={Math.abs(config.theta - s.theta) < 1e-6 && Math.abs(config.phi - s.phi) < 1e-6 ? 'selected' : ''}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Slider
            label="θ · Polar angle"
            value={degrees(config.theta)}
            min={0}
            max={180}
            step={1}
            unit="°"
            onChange={v => setState(radians(v), config.phi)}
          />
          <Slider
            label="φ · Azimuthal angle"
            value={degrees(config.phi)}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={v => setState(config.theta, radians(v))}
          />
          <div className="state-formula">cos(θ/2)|0⟩ + e<sup>iφ</sup>sin(θ/2)|1⟩</div>
        </div>

        <div className="control-section">
          <div className="noise-enable">
            <div>
              <div className="section-label">RESOURCE NOISE</div>
              <span>{config.noise.enabled ? `Active on q2 · ${activeChannel.short}` : 'Ideal circuit · noise disabled'}</span>
            </div>
            <Switch
              label="Enable circuit noise"
              checked={config.noise.enabled}
              onChange={enabled => setNoise({ enabled })}
            />
          </div>

          <label className="select-label">
            Noise channel
            <select
              aria-label="Noise channel"
              value={config.noise.channel}
              onChange={e => setNoise({ channel: e.target.value as ChannelKey })}
            >
              {CHANNELS.map(c => (
                <option value={c.key} key={c.key}>{c.name}</option>
              ))}
            </select>
          </label>

          <Slider
            label="p · Noise strength"
            value={config.noise.p}
            min={0}
            max={1}
            step={0.01}
            onChange={p => setNoise({ p })}
          />
          {!config.noise.enabled && (
            <p className="field-note ideal-note">p is configured but not applied while noise is disabled.</p>
          )}
        </div>

        <div className="control-section">
          <LocationPicker compact={compactLocations} />
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="primary" className="w-full justify-center" onClick={rerun} disabled={busy}>
            <Zap size={15} />{busy ? 'Simulating…' : 'Run simulation'}
          </Button>
          <Button variant="ghost" className="w-full justify-center text-xs" onClick={reset}>
            <RotateCcw size={13} />Reset to ideal circuit
          </Button>
        </div>
        <p className="field-note text-center mt-2">Angles shown in degrees; simulation engine uses exact radians.</p>
      </div>
    </aside>
  );
}
