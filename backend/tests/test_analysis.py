import math

import numpy as np
import pytest

from app.engine import (sphere_samples, state_sample_id, process_map, average_from_map,
                        state_fidelity_from_map, simulate, input_state, fidelity, CLASSICAL_BENCHMARK)
from app.experiments import sweep
from app.models import Channel, NoiseConfig, SweepRequest


@pytest.mark.parametrize('n', [32, 96, 256])
def test_uniform_reproducible_bloch_samples(n):
    samples = sphere_samples(n)
    assert np.allclose(np.linalg.norm(samples, axis=1), 1, atol=1e-12)
    assert np.linalg.norm(samples.mean(axis=0)) < .015
    assert np.allclose(samples.T @ samples / n, np.eye(3) / 3, atol=.012)
    assert state_sample_id(n) == state_sample_id(n)
    assert np.array_equal(samples, sphere_samples(n))


@pytest.mark.parametrize('channel', [c.value for c in Channel])
def test_process_reconstruction_matches_direct_simulation(channel):
    locations = ('bell_cx_q2',)
    transfer, translation = process_map(channel, .37, locations)
    for theta, phi in [(1.13, .73), (.35, 4.17), (2.61, 5.92)]:
        noise = NoiseConfig(enabled=True, channel=channel, p=.37, locations=list(locations))
        actual = fidelity(input_state(theta, phi), simulate(theta, phi, noise).rho)
        assert state_fidelity_from_map(transfer, translation, theta, phi) == pytest.approx(actual, abs=1e-9)


@pytest.mark.parametrize('channel', [c.value for c in Channel])
def test_resource_noise_haar_average_matches_analytical_cross_check(channel):
    p = .4
    transfer, translation = process_map(channel, p, ('bell_cx_q2',))
    diagonals = {
        'amplitude_damping': [math.sqrt(1 - p), math.sqrt(1 - p), 1 - p],
        'phase_damping': [math.sqrt(1 - p), math.sqrt(1 - p), 1],
        'depolarizing': [1 - p] * 3,
        'bit_flip': [1, 1 - 2 * p, 1 - 2 * p],
    }[channel]
    expected_haar = 0.5 + sum(diagonals) / 6
    stats = average_from_map(transfer, translation, 96)
    assert stats['haar_average_fidelity'] == pytest.approx(expected_haar, abs=1e-9)
    # Monte Carlo / Fibonacci-sphere mean approaches continuous Haar integral
    assert stats['average_fidelity'] == pytest.approx(expected_haar, abs=0.03)


def test_classical_benchmark_and_complete_dephasing():
    assert CLASSICAL_BENCHMARK == pytest.approx(2 / 3)
    transfer, translation = process_map('phase_damping', 1, ('bell_cx_q2',))
    stats = average_from_map(transfer, translation, 96)
    assert stats['haar_average_fidelity'] == pytest.approx(CLASSICAL_BENCHMARK, abs=1e-9)
    # A particular pole state is perfect despite the average sitting at 2/3.
    assert state_fidelity_from_map(transfer, translation, 0, 0) == pytest.approx(1, abs=1e-9)


def test_noise_strength_sweep_is_actual_comparable_and_recorded():
    result = sweep(SweepRequest())
    assert [r['p'] for r in result['points']] == [i / 10 for i in range(11)]
    assert [r['p'] for r in result['table']] == [0, .2, .5, .8, 1]
    assert 'not a per-state threshold' in result['benchmark_explanation'].lower()
    for point in result['points']:
        for channel, stats in point['channels'].items():
            assert stats['sample_id'] == result['settings']['sample_id']
            assert stats['sample_count'] == 96
            assert stats['noise']['channel'] == channel
            assert stats['noise']['p'] == point['p']
            assert stats['noise']['locations'] == ['bell_cx_q2']
            assert 0 <= stats['average_fidelity'] <= 1
            if point['p'] == 0:
                assert stats['average_fidelity'] == pytest.approx(1, abs=1e-9)
    assert result['points'][5]['channels']['depolarizing']['average_fidelity'] == pytest.approx(.75, abs=1e-9)
    assert result['points'][5]['channels']['bit_flip']['average_fidelity'] < .99


def test_invalid_sweep_locations_rejected():
    with pytest.raises(Exception):
        sweep(SweepRequest(locations=['alice_h']))
