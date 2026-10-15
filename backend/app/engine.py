"""Exact three-qubit teleportation with circuit-stage Kraus channels.

Aer density-matrix evolution is deterministic before measurement. At Alice's
readout we enumerate the four orthogonal projectors, derive their probabilities,
then execute each projected branch through the SAME Qiskit measurement/if_test
suffix. Readouts in these branches are deterministic. Summing p_b rho_b gives
an exact ensemble, not an average of finitely many random shots.

Methodological constraint: The only supported noise location is 'bell_cx_q2'.
"""
from dataclasses import dataclass
from functools import lru_cache
import hashlib
import math
import threading

import numpy as np
from qiskit_aer import AerSimulator

from .circuit import prepare_prefix, build_branch
from .models import Channel, NoiseConfig

SIMULATOR = AerSimulator(method="density_matrix", max_parallel_threads=1, max_parallel_experiments=1)
AER_LOCK = threading.RLock()
PAULIS = np.array([[[0, 1], [1, 0]], [[0, -1j], [1j, 0]], [[1, 0], [0, -1]]], dtype=complex)
CLASSICAL_BENCHMARK = 2 / 3


def input_state(theta: float, phi: float) -> np.ndarray:
    return np.array([np.cos(theta / 2), np.exp(1j * phi) * np.sin(theta / 2)], dtype=complex)


def validate_density(rho: np.ndarray, atol: float = 1e-9):
    rho = np.asarray(rho, dtype=complex)
    if rho.shape != (2, 2):
        raise ValueError("Bob's density matrix must be 2×2.")
    if not np.isfinite(rho).all() or not np.allclose(rho, rho.conj().T, atol=atol, rtol=0):
        raise ValueError("Density matrix is not finite and Hermitian.")
    trace = float(np.trace(rho).real)
    eigenvalues = np.linalg.eigvalsh(rho)
    if abs(trace - 1) > atol or eigenvalues.min() < -atol:
        raise ValueError("Density matrix is not positive semidefinite and trace-one.")
    return {"hermitian": True, "trace": trace, "eigenvalues": eigenvalues.tolist(),
            "positive_semidefinite": True, "valid": True}


def fidelity(psi: np.ndarray, rho: np.ndarray) -> float:
    validate_density(rho)
    value = float(np.vdot(psi, rho @ psi).real)
    if not -1e-9 <= value <= 1 + 1e-9:
        raise ValueError("Fidelity fell outside the physical interval.")
    # Only remove floating-point roundoff; no artificial degradation or repair.
    return float(np.clip(value, 0, 1))


def bloch_vector(rho: np.ndarray) -> np.ndarray:
    return np.einsum("kij,ji->k", PAULIS, rho).real


def encode_complex(array):
    a = np.asarray(array)
    if a.ndim == 1:
        return [{"re": float(x.real), "im": float(x.imag)} for x in a]
    return [encode_complex(row) for row in a]


@dataclass(frozen=True)
class Branch:
    mZ: int
    mX: int
    probability: float
    rho: np.ndarray


@dataclass(frozen=True)
class Simulation:
    rho: np.ndarray
    branches: tuple[Branch, ...]
    pre_measurement: np.ndarray


def simulation_key(theta, phi, noise, scale=1):
    return (float(theta), float(phi), bool(noise.enabled), noise.channel.value,
            float(noise.p), tuple(sorted(noise.locations)), int(scale))


def simulate(theta: float, phi: float, noise: NoiseConfig, scale: int = 1) -> Simulation:
    if scale < 1 or scale > 7:
        raise ValueError("Noise scale must be an integer in [1,7].")
    return _simulate(*simulation_key(theta, phi, noise, scale))


@lru_cache(maxsize=4096)
def _simulate(theta, phi, enabled, channel, p, locations, scale):
    noise = NoiseConfig(enabled=enabled, channel=channel, p=p, locations=list(locations))
    prefix = prepare_prefix(theta, phi, noise, scale)
    prefix.save_density_matrix(label="pre")
    with AER_LOCK:
        result = SIMULATOR.run(prefix, shots=1, seed_simulator=731).result()
        if not result.success:
            raise RuntimeError(f"Aer prefix simulation failed: {result.status}")
        rho = np.asarray(result.data(0)["pre"], dtype=complex)
        branch_specs = []
        circuits = []
        # Qiskit is little endian: index = q0 + 2*q1 + 4*q2.
        # mZ measures q0, mX measures q1. X(mX) then Z(mZ) on Bob.
        for mz in (0, 1):
            for mx in (0, 1):
                indices = [mz + 2 * mx, mz + 2 * mx + 4]
                block = rho[np.ix_(indices, indices)]
                probability = float(np.trace(block).real)
                if probability <= 1e-14:
                    continue
                projected = np.zeros((8, 8), dtype=complex)
                projected[np.ix_(indices, indices)] = block / probability
                circuits.append(build_branch(projected))
                branch_specs.append((mz, mx, probability))
        result = SIMULATOR.run(circuits, shots=1, seed_simulator=731).result()
        if not result.success:
            raise RuntimeError(f"Aer conditional branch simulation failed: {result.status}")
        branches = []
        output = np.zeros((2, 2), dtype=complex)
        for i, (mz, mx, probability) in enumerate(branch_specs):
            bob = np.asarray(result.data(i)["bob"], dtype=complex)
            validate_density(bob)
            output += probability * bob
            bob.setflags(write=False)
            branches.append(Branch(mz, mx, probability, bob))
    if not np.isclose(sum(b.probability for b in branches), 1, atol=1e-10):
        raise ValueError("Measurement-branch probabilities do not sum to 1.")
    output = (output + output.conj().T) / 2
    validate_density(output)
    output.setflags(write=False)
    rho.setflags(write=False)
    return Simulation(output, tuple(branches), rho)


@lru_cache(maxsize=1024)
def process_map(channel: str, p: float, locations: tuple[str, ...], scale: int = 1):
    """Reconstruct r_out = T r_in + t using four actual Aer input probes.

    |0>, |1>, |+>, |+i> span Hermitian single-qubit operators. The complete
    teleportation circuit (including feed-forward) is a linear CPTP map, so the
    reconstruction is exact. This is not a fitted/predetermined noise formula.
    """
    noise = NoiseConfig(enabled=True, channel=channel, p=p, locations=list(locations))
    probe_parameters = [(0, 0), (math.pi, 0), (math.pi / 2, 0), (math.pi / 2, math.pi / 2)]
    a, b, c, d = [bloch_vector(simulate(th, ph, noise, scale).rho) for th, ph in probe_parameters]
    translation = (a + b) / 2
    transfer = np.column_stack((c - translation, d - translation, (a - b) / 2))
    transfer.setflags(write=False)
    translation.setflags(write=False)
    return transfer, translation


@lru_cache(maxsize=32)
def sphere_samples(n: int = 96):
    """Equal-area Fibonacci sphere, deterministic and shared between channels.
    
    Generates a uniform distribution of points over the Bloch sphere by sampling
    cos(theta) uniformly in [-1, 1] and azimuth uniformly.
    """
    if not 24 <= n <= 512:
        raise ValueError("Use 24–512 state samples.")
    index = np.arange(n, dtype=float)
    z = 1 - 2 * (index + 0.5) / n
    azimuth = index * math.pi * (3 - math.sqrt(5))
    radial = np.sqrt(1 - z * z)
    states = np.column_stack((radial * np.cos(azimuth), radial * np.sin(azimuth), z))
    states.setflags(write=False)
    return states


def state_sample_id(n: int):
    return hashlib.sha256(sphere_samples(n).tobytes()).hexdigest()[:16]


def average_from_map(transfer, translation, n=96):
    states = sphere_samples(n)
    outputs = states @ transfer.T + translation
    values = (1 + np.einsum("ij,ij->i", states, outputs)) / 2
    if np.any(values < -1e-8) or np.any(values > 1 + 1e-8) or np.any(np.linalg.norm(outputs, axis=1) > 1 + 1e-8):
        raise ValueError("Reconstructed teleportation map produced unphysical outputs.")
    values = np.clip(values, 0, 1)
    # Exact continuous Haar average is an independent mathematical cross-check.
    haar = 0.5 + float(np.trace(transfer)) / 6
    return {"average_fidelity": float(values.mean()), "haar_average_fidelity": float(np.clip(haar, 0, 1)),
            "minimum": float(values.min()), "maximum": float(values.max()),
            "population_std": float(values.std()), "sample_count": n, "sample_id": state_sample_id(n)}


def state_fidelity_from_map(transfer, translation, theta, phi):
    r = bloch_vector(np.outer(input_state(theta, phi), input_state(theta, phi).conj()))
    return float(np.clip((1 + r @ (transfer @ r + translation)) / 2, 0, 1))
