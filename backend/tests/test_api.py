from xml.etree import ElementTree

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import NoiseConfig, SimulationRequest

client = TestClient(app)


def test_health_and_noise_metadata():
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['engine'] == 'Qiskit Aer'
    assert response.json()['exact_branch_ensemble'] is True
    config = client.get('/api/config').json()
    assert len(config['locations']) == 1
    assert config['locations'][0]['id'] == 'bell_cx_q2'
    assert len(config['channels']) == 4
    assert config['classical_benchmark'] == pytest.approx(2 / 3)
    assert 'sqrt(1-p)' in config['noise_conventions']['phase_damping']
    assert config['noise_insertion_location']['id'] == 'bell_cx_q2'


def test_default_api_is_ideal_and_density_is_correct():
    response = client.post('/api/simulate', json={})
    assert response.status_code == 200
    data = response.json()
    assert data['settings']['noise']['enabled'] is False
    assert data['fidelity'] == pytest.approx(1, abs=1e-10)
    rho = np.array([[complex(c['re'], c['im']) for c in row] for row in data['output_density']])
    psi = np.array([complex(c['re'], c['im']) for c in data['input_state']])
    assert np.allclose(rho, np.outer(psi, psi.conj()), atol=1e-10)
    assert data['validation']['valid']
    assert data['engine']['sampling'] is False
    assert len(data['branches']) == 4
    assert not data['circuit']['noise_insertions']
    assert len(ElementTree.fromstring(data['circuit']['svg']).findall('.//{http://www.w3.org/2000/svg}g')) == 10


def test_noisy_api_circuit_agrees_with_result_settings():
    body = {
        'theta': 1.13,
        'phi': .73,
        'noise': {
            'enabled': True,
            'channel': 'depolarizing',
            'p': .4,
            'locations': ['bell_cx_q2']
        }
    }
    response = client.post('/api/simulate', json=body)
    assert response.status_code == 200
    data = response.json()
    assert data['settings'] == body
    assert data['fidelity'] < .99
    assert len(data['circuit']['noise_insertions']) == 1
    assert data['circuit']['noise_insertions'][0]['qubit'] == 2
    ops = [o for o in data['circuit']['operations'] if o['noise']]
    assert len(ops) == 1 and ops[0]['qubits'] == [2]
    assert 'data-noise="true"' in data['circuit']['svg']


def test_api_rejects_unsupported_noise_locations():
    # Attempting to insert noise at any site other than bell_cx_q2 must be rejected with 422
    bad_bodies = [
        {'noise': {'enabled': True, 'channel': 'depolarizing', 'p': .2, 'locations': ['alice_h']}},
        {'noise': {'enabled': True, 'channel': 'depolarizing', 'p': .2, 'locations': ['bob_x']}},
        {'noise': {'enabled': True, 'channel': 'depolarizing', 'p': .2, 'locations': ['bell_h', 'bell_cx_q2']}},
        {'noise': {'enabled': True, 'channel': 'depolarizing', 'p': .2, 'locations': []}},
    ]
    for body in bad_bodies:
        res = client.post('/api/simulate', json=body)
        assert res.status_code == 422, f"Expected 422 for {body}, got {res.status_code}"


def test_mitigation_api_and_native_qiskit_svg():
    response = client.post('/api/mitigate', json={})
    assert response.status_code == 200 and response.json()['improved']
    response = client.post('/api/circuit/native', json={
        'noise': {'enabled': True, 'channel': 'bit_flip', 'p': .2, 'locations': ['bell_cx_q2']}
    })
    assert response.status_code == 200
    assert response.headers['content-type'] == 'image/svg+xml'
    assert '<svg' in response.text
