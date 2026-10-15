export type ChannelKey = 'amplitude_damping' | 'phase_damping' | 'depolarizing' | 'bit_flip';
export type LocationKey = 'bell_cx_q2';
export interface Complex { re: number; im: number }
export interface NoiseConfig { enabled: boolean; channel: ChannelKey; p: number; locations: LocationKey[] }
export interface ExperimentConfig { theta: number; phi: number; noise: NoiseConfig }
export interface Operation { name: string; label: string; qubits: number[]; clbits: number[]; stage: string; noise: boolean; params: number[]; condition: { bit: string; value: number } | null }
export interface Insertion { location: LocationKey; stage: string; qubit: number; gate: string; label: string; description: string; condition?: string; channel: ChannelKey; probability: number; repetitions: number; physically_nonzero: boolean }
export interface SimulationResult {
  settings: ExperimentConfig;
  input_state: Complex[];
  input_density: Complex[][];
  output_density: Complex[][];
  input_bloch: number[];
  output_bloch: number[];
  fidelity: number;
  ideal_fidelity: number;
  difference_from_ideal: number;
  purity: number;
  validation: { valid: boolean; hermitian: boolean; trace: number; eigenvalues: number[]; positive_semidefinite: boolean };
  branches: { mZ: number; mX: number; probability: number; correction: string; fidelity: number; output_density: Complex[][] }[];
  circuit: { svg: string; text: string; operations: Operation[]; noise_insertions: Insertion[]; classical_mapping: Record<string, string> };
  engine: { name: string; method: string; sampling: boolean; ensemble: string; measurement_branches: number; elapsed_ms: number };
}
export interface Health { status: string; engine: string; method: string; qiskit: string; qiskit_aer: string; version: string; exact_branch_ensemble: boolean }
export interface ChannelStats {
  average_fidelity: number; haar_average_fidelity: number; minimum: number; maximum: number; population_std: number;
  sample_count: number; sample_id: string; state_fidelity: number; noise: NoiseConfig; difference_from_ideal: number;
}
export interface SweepPoint { p: number; channels: Record<ChannelKey, ChannelStats> }
export interface SweepResult {
  points: SweepPoint[];
  table: SweepPoint[];
  settings: { locations: LocationKey[]; sample_count: number; sample_id: string; channels: ChannelKey[]; theta: number; phi: number; probabilities: number[] };
  method: string; probe_states: string[]; benchmark: number; benchmark_explanation: string; ideal_reference: number;
}
export interface MitigationConfig {
  channel: Exclude<ChannelKey, 'bit_flip'>; p: number; locations: LocationKey[]; scales: number[]; degree: 1 | 2;
  target: 'average' | 'state'; sample_count: number; theta: number; phi: number;
}
export interface MitigationResult {
  method: string; settings: MitigationConfig;
  points: { scale: number; fidelity: number; average_fidelity: number; state_fidelity: number; effective_p_per_site: number; channel_instructions: number; noise: NoiseConfig }[];
  baseline_fidelity: number; ideal_fidelity: number; extrapolated_fidelity: number;
  fit: { estimate: number; weights: number[]; coefficients: number[]; fit_rmse: number; physical: boolean };
  improved: boolean; improvement: number; before_error: number; after_error: number; sample_id: string; warnings: string[];
}
