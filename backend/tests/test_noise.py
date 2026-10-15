import math

import numpy as np
import pytest
from qiskit.quantum_info import Kraus
from qiskit_aer import AerSimulator

from app.circuit import build_circuit, kraus_instruction, operations, prepare_prefix
from app.engine import simulate, input_state, fidelity, validate_density
from app.models import Channel, LOCATION_INFO, NoiseConfig
from reference_numpy import reference_teleport

CHANNELS = [c.value for c in Channel]


@pytest.mark.parametrize('channel', CHANNELS)
@pytest.mark.parametrize('p', [0, .31, 1])
def test_kraus_completeness(channel, p):
    operators = Kraus(kraus_instruction(channel, p)).data
    assert np.allclose(sum(k.conj().T @ k for k in operators), np.eye(2), atol=1e-10)


@pytest.mark.parametrize('channel', CHANNELS)
@pytest.mark.parametrize('theta,phi', [(0, 0), (math.pi / 2, .47), (2.17, 4.2)])
def test_enabled_zero_noise_is_ideal(channel, theta, phi):
    noise = NoiseConfig(enabled=True, channel=channel, p=0, locations=['bell_cx_q2'])
    assert fidelity(input_state(theta, phi), simulate(theta, phi, noise).rho) == pytest.approx(1, abs=1e-10)
    noise_ops = [o for o in operations(build_circuit(theta, phi, noise)) if o['noise']]
    assert len(noise_ops) == 1
    assert noise_ops[0]['qubits'] == [2]


@pytest.mark.parametrize('channel', CHANNELS)
def test_disabled_noise_does_not_act_even_with_nonzero_p(channel):
    noise = NoiseConfig(enabled=False, channel=channel, p=.9, locations=['bell_cx_q2'])
    assert fidelity(input_state(1.13, .73), simulate(1.13, .73, noise).rho) == pytest.approx(1, abs=1e-10)
    assert not any(o['noise'] for o in operations(build_circuit(1.13, .73, noise)))


@pytest.mark.parametrize('channel', CHANNELS)
def test_resource_noise_against_independent_numpy_reference(channel):
    noise = NoiseConfig(enabled=True, channel=channel, p=.31, locations=['bell_cx_q2'])
    actual = simulate(1.13, .73, noise).rho
    reference = reference_teleport(1.13, .73, channel, .31, ['bell_cx_q2'])
    assert np.allclose(actual, reference, atol=1e-9)
    noise_ops = [o for o in operations(build_circuit(1.13, .73, noise)) if o['noise']]
    assert len(noise_ops) == 1
    assert noise_ops[0]['qubits'] == [2]


def test_circuit_gate_sequence_and_noise_isolation():
    """Verify exact 9-step teleportation sequence:
    1. U(theta, phi, 0) on q0
    2. H on q1
    3. CX on (q1, q2)
    4. Kraus noise on q2 ONLY
    5. CX on (q0, q1)
    6. H on q0
    7. Measure q0, q1
    8. Conditional X(q2), Z(q2)
    9. Bob output rho
    """
    noise = NoiseConfig(enabled=True, channel='depolarizing', p=.25, locations=['bell_cx_q2'])
    qc = build_circuit(1.0, 0.5, noise)
    ops = operations(qc)
    
    # Check gate names and target qubits
    names_and_qubits = [(o['name'], o['qubits'], o['noise']) for o in ops]
    
    # Find key gate indices
    u_idx = next(i for i, (n, q, _) in enumerate(names_and_qubits) if n == 'u' and q == [0])
    h1_idx = next(i for i, (n, q, _) in enumerate(names_and_qubits) if n == 'h' and q == [1])
    bell_cx_idx = next(i for i, (n, q, _) in enumerate(names_and_qubits) if n == 'cx' and q == [1, 2])
    kraus_idx = next(i for i, (n, q, is_n) in enumerate(names_and_qubits) if is_n)
    alice_cx_idx = next(i for i, (n, q, _) in enumerate(names_and_qubits) if n == 'cx' and q == [0, 1])
    h0_idx = next(i for i, (n, q, _) in enumerate(names_and_qubits) if n == 'h' and q == [0])
    
    # Assert exact ordering
    assert u_idx < h1_idx < bell_cx_idx < kraus_idx < alice_cx_idx < h0_idx
    # Assert noise is on q2 only
    assert names_and_qubits[kraus_idx][1] == [2]
    # Assert no other noise operations exist in the circuit
    assert sum(1 for _, _, is_n in names_and_qubits if is_n) == 1


def test_unsupported_noise_locations_are_rejected():
    with pytest.raises(Exception):
        NoiseConfig(enabled=True, channel='depolarizing', p=.2, locations=['alice_h'])
    with pytest.raises(Exception):
        NoiseConfig(enabled=True, channel='depolarizing', p=.2, locations=['bob_x'])
    with pytest.raises(Exception):
        NoiseConfig(enabled=True, channel='depolarizing', p=.2, locations=['bell_cx_q2', 'bell_h'])


@pytest.mark.parametrize('channel', CHANNELS)
@pytest.mark.parametrize('p', [0, .2, .5, .8, 1])
def test_density_matrix_validity_under_all_channels(channel, p):
    noise = NoiseConfig(enabled=True, channel=channel, p=p, locations=['bell_cx_q2'])
    result = simulate(math.pi / 3, math.pi / 4, noise)
    val = validate_density(result.rho)
    assert val['valid']
    assert val['hermitian']
    assert val['positive_semidefinite']
    assert val['trace'] == pytest.approx(1.0, abs=1e-9)
    assert 0 <= fidelity(input_state(math.pi / 3, math.pi / 4), result.rho) <= 1.0 + 1e-9
