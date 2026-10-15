import math

import numpy as np
import pytest
from qiskit_aer import AerSimulator

from app.circuit import build_circuit, operations
from app.engine import simulate, input_state, fidelity, validate_density
from app.models import NoiseConfig

STATES = [(0, 0), (math.pi, 0), (math.pi / 2, 0), (math.pi / 2, math.pi / 2),
          (math.pi / 2, math.pi), (math.pi / 2, 3 * math.pi / 2),
          (.13, .29), (1.13, .73), (2.78, 4.27), (math.pi / 3, 2 * math.pi)]


@pytest.mark.parametrize("theta,phi", STATES)
def test_ideal_teleportation(theta, phi):
    psi = input_state(theta, phi)
    result = simulate(theta, phi, NoiseConfig())
    assert fidelity(psi, result.rho) == pytest.approx(1, abs=1e-10)
    assert np.allclose(result.rho, np.outer(psi, psi.conj()), atol=1e-10)
    assert validate_density(result.rho)["valid"]
    assert np.trace(result.rho @ result.rho).real == pytest.approx(1, abs=1e-10)
    assert len(result.branches) == 4
    for branch in result.branches:
        assert branch.probability == pytest.approx(.25, abs=1e-10)
        assert fidelity(psi, branch.rho) == pytest.approx(1, abs=1e-10)


def test_bit_mapping_and_pre_correction_states():
    theta, phi = 1.13, .73
    psi = input_state(theta, phi)
    result = simulate(theta, phi, NoiseConfig())
    x = np.array([[0, 1], [1, 0]], complex); z = np.diag([1, -1])
    for branch in result.branches:
        indices = [branch.mZ + 2 * branch.mX, branch.mZ + 2 * branch.mX + 4]
        conditional = result.pre_measurement[np.ix_(indices, indices)] / branch.probability
        uncorrected = np.linalg.matrix_power(x, branch.mX) @ np.linalg.matrix_power(z, branch.mZ) @ psi
        assert np.allclose(conditional, np.outer(uncorrected, uncorrected.conj()), atol=1e-10)
        correction = np.linalg.matrix_power(z, branch.mZ) @ np.linalg.matrix_power(x, branch.mX)
        assert np.allclose(correction @ conditional @ correction.conj().T, np.outer(psi, psi.conj()), atol=1e-10)
    ops = operations(build_circuit(theta, phi, NoiseConfig()))
    measures = [o for o in ops if o['name'] == 'measure']
    assert [(o['qubits'], o['clbits']) for o in measures] == [([0], [0]), ([1], [1])]
    assert [(o['name'], o['condition']) for o in ops if o['condition']] == [
        ('x', {'bit': 'mX', 'value': 1}), ('z', {'bit': 'mZ', 'value': 1})]


def test_full_dynamic_circuit_ideal():
    qc = build_circuit(1.13, .73, NoiseConfig())
    result = AerSimulator(method="density_matrix", max_parallel_threads=1).run(qc, shots=1024, seed_simulator=47).result()
    assert result.success
    # Qiskit displays mX then mZ (the second register is more significant).
    assert set(result.get_counts()) == {'0 0', '0 1', '1 0', '1 1'}
    assert fidelity(input_state(1.13, .73), np.array(result.data(0)['bob'])) == pytest.approx(1, abs=1e-10)


@pytest.mark.parametrize("rho", [np.eye(2), np.array([[1, .3], [0, 0]], complex), np.diag([1.2, -.2]), np.eye(3) / 3])
def test_density_validation_rejects_invalid_matrices(rho):
    with pytest.raises(ValueError): validate_density(rho)
