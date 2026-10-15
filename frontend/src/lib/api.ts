import type { ExperimentConfig, Health, MitigationConfig, MitigationResult, SimulationResult, SweepResult } from './types';

export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message); this.name = 'ApiError'; }
}
async function checkedFetch(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(`/api${path}`, init); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the quantum backend. Start FastAPI on port 8000, then retry.');
  }
  if (!response.ok) {
    let detail = `Backend returned HTTP ${response.status}.`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((x: { msg: string }) => x.msg).join('; ');
    } catch { /* Preserve the real HTTP status if the proxy returned non-JSON. */ }
    throw new ApiError(detail, response.status);
  }
  return response;
}
export async function requestJson<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await checkedFetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal,
  });
  return response.json() as Promise<T>;
}
export const api = {
  health: (signal?: AbortSignal) => requestJson<Health>('/health', undefined, signal),
  simulate: (config: ExperimentConfig, signal?: AbortSignal) => requestJson<SimulationResult>('/simulate', config, signal),
  sweep: (body: { locations: ExperimentConfig['noise']['locations']; sample_count: number; theta: number; phi: number }, signal?: AbortSignal) => requestJson<SweepResult>('/sweep', body, signal),
  mitigate: (body: MitigationConfig, signal?: AbortSignal) => requestJson<MitigationResult>('/mitigate', body, signal),
  nativeCircuit: async (body: ExperimentConfig, signal?: AbortSignal) => {
    const response = await checkedFetch('/circuit/native', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    return response.text();
  },
};
