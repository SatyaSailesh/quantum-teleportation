import type { ChannelKey, ExperimentConfig, LocationKey } from './types';

export const CHANNELS: { key: ChannelKey; name: string; short: string; color: string; description: string; mechanism: string; formula: string }[] = [
  { key: 'amplitude_damping', name: 'Amplitude damping', short: 'AD', color: '#66d9ed', description: 'Energy relaxation', mechanism: 'An excited qubit relaxes toward |0⟩. This changes populations and reduces coherence.', formula: 'K₀ = diag(1, √(1−p)),  K₁ = √p |0⟩⟨1|' },
  { key: 'phase_damping', name: 'Phase damping', short: 'PD', color: '#b09aff', description: 'Coherence loss', mechanism: 'Phase information fades without changing computational-basis populations. Aer scales off-diagonal elements by √(1−p).', formula: 'ρ₀₁ → √(1−p) ρ₀₁,  ρ₀₀ and ρ₁₁ unchanged' },
  { key: 'depolarizing', name: 'Depolarizing', short: 'DEP', color: '#f4bd69', description: 'Random Pauli disturbances', mechanism: 'The state mixes with I/2. In the Aer convention, p is the mixing strength, not the total nonidentity Pauli probability.', formula: 'ℰ(ρ) = (1−p)ρ + p I/2' },
  { key: 'bit_flip', name: 'Bit flip', short: 'BF', color: '#f08095', description: 'Computational-basis flip', mechanism: 'An X error flips |0⟩ and |1⟩ with probability p. At p=1 this is a deterministic X, not a maximally mixed state.', formula: 'ℰ(ρ) = (1−p)ρ + p XρX' },
];

export const LOCATIONS: { key: LocationKey; stage: 'entanglement'; label: string; detail: string; qubit: number }[] = [
  { key: 'bell_cx_q2', stage: 'entanglement', label: 'Bob’s Bell qubit (q2)', detail: 'Post-CX(1,2) resource-state noise before Alice’s Bell measurement', qubit: 2 },
];

export const DEFAULT_CONFIG: ExperimentConfig = {
  theta: Math.PI / 2,
  phi: Math.PI / 4,
  noise: { enabled: false, channel: 'amplitude_damping', p: 0.2, locations: ['bell_cx_q2'] }
};

export const channelInfo = (key: ChannelKey) => CHANNELS.find(c => c.key === key)!;
export const locationSummary = (locations: LocationKey[] = ['bell_cx_q2']) =>
  locations.map(l => LOCATIONS.find(x => x.key === l)?.label || 'Bob’s Bell qubit (q2)').join(' · ');
