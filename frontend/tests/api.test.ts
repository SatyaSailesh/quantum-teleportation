import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/lib/api';
import { DEFAULT_CONFIG } from '../src/lib/constants';

afterEach(() => vi.unstubAllGlobals());

describe('Frontend REST contracts and failures', () => {
  it('posts the complete settings to a relative REST endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Deliberate test failure' }), { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.simulate(DEFAULT_CONFIG)).rejects.toThrow('Deliberate test failure');
    expect(fetch).toHaveBeenCalledWith('/api/simulate', expect.objectContaining({ method: 'POST', body: JSON.stringify(DEFAULT_CONFIG) }));
  });
  it('does not hide network failure behind an ideal fidelity', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')));
    await expect(api.simulate(DEFAULT_CONFIG)).rejects.toThrow('Cannot reach the quantum backend');
  });
  it('preserves request cancellation instead of treating it as a simulation error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    await expect(api.simulate(DEFAULT_CONFIG)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('exposes the backend validation error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ msg: 'Select at least one location' }] }), { status: 422 })));
    await expect(api.sweep({ locations: [], sample_count: 96, theta: 1, phi: 0 })).rejects.toThrow('Select at least one location');
  });
});
