import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentControls, LocationPicker } from '../src/components/Controls';
import { ExperimentProvider, useExperiment } from '../src/lib/ExperimentContext';

beforeEach(() => {
  // These unit tests deliberately make the engine unavailable. Live positive
  // simulation integration is tested separately in Playwright, without mocks.
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ detail: 'Unit-test backend unavailable' }), { status: 503 })));
});
afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const { config, error, result, reset } = useExperiment();
  return (
    <>
      <output data-testid="config">{JSON.stringify(config)}</output>
      <output data-testid="error">{error}</output>
      <output data-testid="result">{result ? String(result.fidelity) : 'No result'}</output>
      <button onClick={reset}>Reset test circuit</button>
    </>
  );
}

function mount() {
  return render(
    <ExperimentProvider>
      <ExperimentControls />
      <Probe />
    </ExperimentProvider>
  );
}

function getConfig() {
  return JSON.parse(screen.getByTestId('config').textContent!);
}

describe('Working circuit controls', () => {
  it('changes the actual angle configuration when a state preset is selected', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: '|+i⟩' }));
    expect(getConfig().theta).toBeCloseTo(Math.PI / 2);
    expect(getConfig().phi).toBeCloseTo(Math.PI / 2);
  });

  it('noise is initially disabled and the switch changes its enabled flag', async () => {
    mount();
    const toggle = screen.getByRole('switch', { name: 'Enable circuit noise' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    expect(getConfig().noise.enabled).toBe(true);
  });

  it('channel control updates the REST configuration while preserving canonical q2 site', async () => {
    mount();
    await userEvent.selectOptions(screen.getByLabelText('Noise channel'), 'bit_flip');
    expect(getConfig().noise.channel).toBe('bit_flip');
    expect(getConfig().noise.locations).toEqual(['bell_cx_q2']);
  });

  it('reset returns to an ideal circuit rather than leaving noise enabled', async () => {
    mount();
    await userEvent.click(screen.getByRole('switch', { name: 'Enable circuit noise' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset to ideal circuit' }));
    expect(getConfig().noise.enabled).toBe(false);
    expect(getConfig().noise.locations).toEqual(['bell_cx_q2']);
  });

  it('shows backend failure with no synthetic simulation result', async () => {
    mount();
    await waitFor(
      () => expect(screen.getByTestId('error')).toHaveTextContent('Unit-test backend unavailable'),
      { timeout: 2000 }
    );
    expect(screen.getByTestId('result')).toHaveTextContent('No result');
  });

  it('allows normal keyboard editing of a decimal noise probability', async () => {
    mount();
    const input = screen.getByLabelText('p · Noise strength value');
    await userEvent.clear(input);
    await userEvent.type(input, '0.35');
    await userEvent.tab();
    expect(input).toHaveValue(0.35);
    expect(getConfig().noise.p).toBe(0.35);
  });

  it('normalizes an out-of-range probability on blur instead of sending it to the backend', async () => {
    mount();
    const input = screen.getByLabelText('p · Noise strength value');
    await userEvent.clear(input);
    await userEvent.type(input, '1.5');
    await userEvent.tab();
    expect(input).toHaveValue(1);
    expect(getConfig().noise.p).toBe(1);
  });

  it('displays the single canonical resource noise site card on q2', () => {
    render(<LocationPicker />);
    expect(screen.getByTestId('single-noise-site')).toBeInTheDocument();
    expect(screen.getByText('Bob’s Bell-pair qubit')).toBeInTheDocument();
    expect(screen.getByText(/Immediately after CX\(q1, q2\)/)).toBeInTheDocument();
  });
});
