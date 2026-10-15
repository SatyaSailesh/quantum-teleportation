import numpy as np
import pytest

from app.circuit import build_circuit, operations
from app.engine import simulate, process_map, average_from_map
from app.experiments import mitigate, extrapolate
from app.models import MitigationRequest, NoiseConfig


@pytest.mark.parametrize('channel', ['amplitude_damping', 'phase_damping', 'depolarizing'])
@pytest.mark.parametrize('scale', [1, 2, 3])
def test_amplification_executes_repeated_channels(channel, scale):
    locations = ['bell_cx_q2']
    base = NoiseConfig(enabled=True, channel=channel, p=.12, locations=locations)
    effective = NoiseConfig(enabled=True, channel=channel, p=1 - (1 - .12)**scale, locations=locations)
    assert np.allclose(simulate(1.13, .73, base, scale).rho, simulate(1.13, .73, effective).rho, atol=1e-9)
    assert len([o for o in operations(build_circuit(1.13, .73, base, scale)) if o['noise']]) == scale


def test_actual_zne_calculation_and_before_after():
    result = mitigate(MitigationRequest())
    assert result['baseline_fidelity'] == pytest.approx(.95, abs=1e-9)
    assert [p['fidelity'] for p in result['points']] == pytest.approx([.95, .905, .8645], abs=1e-9)
    assert result['extrapolated_fidelity'] == pytest.approx(.992, abs=1e-9)
    assert result['fit']['weights'] == pytest.approx([4 / 3, 1 / 3, -2 / 3], abs=1e-9)
    assert result['improved'] is True
    assert result['improvement'] == pytest.approx(.042, abs=1e-9)
    assert 'not a recovered density matrix' in result['warnings'][0]
    for row in result['points']:
        transfer, translation = process_map('depolarizing', .1, ('bell_cx_q2',), row['scale'])
        assert row['fidelity'] == pytest.approx(average_from_map(transfer, translation)['average_fidelity'], abs=1e-9)


def test_quadratic_intercept_weights():
    result = extrapolate([1, 2, 3], [.95, .905, .8645], 2)
    assert result['weights'] == pytest.approx([3, -3, 1], abs=1e-9)
    assert result['estimate'] == pytest.approx(.9995, abs=1e-9)


def test_unphysical_estimate_is_not_clipped():
    result = extrapolate([1, 2, 3], [.95, .65, .1], 1)
    assert result['estimate'] > 1
    assert result['physical'] is False


def test_high_noise_case_need_not_improve():
    result = mitigate(MitigationRequest(p=1))
    assert result['baseline_fidelity'] == pytest.approx(.5, abs=1e-9)
    assert result['extrapolated_fidelity'] == pytest.approx(.5, abs=1e-9)
    assert result['improved'] is False
    assert any('did not produce' in w for w in result['warnings'])


def test_mitigation_rejects_unsupported_locations():
    with pytest.raises(Exception):
        mitigate(MitigationRequest(locations=['bob_x']))
