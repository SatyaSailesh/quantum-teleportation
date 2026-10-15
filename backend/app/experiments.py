"""Actual circuit-derived sweeps and digital noise-injection ZNE.

Methodological constraint: Noise is applied exclusively to Bob's Bell-pair qubit
(q2) immediately after CX(1,2) and before Alice's Bell-state measurement.
"""
from functools import lru_cache
import math
import threading

import numpy as np

from .engine import (process_map, average_from_map, state_fidelity_from_map, state_sample_id,
                     CLASSICAL_BENCHMARK)
from .models import SweepRequest, MitigationRequest, LOCATION_INFO

SWEEP_LOCK = threading.RLock()
BENCHMARK_EXPLANATION = (
    "2/3 is the optimal classical measure-and-prepare average fidelity for an unknown "
    "pure single-qubit state uniformly distributed on the Bloch sphere. It is an ensemble "
    "average across all uniformly distributed pure states, NOT a per-state threshold. "
    "Individual states may have fidelity higher or lower than 2/3 under noise."
)


def sweep(request: SweepRequest):
    key = (tuple(sorted(request.locations)), request.sample_count,
           tuple(c.value for c in request.channels), request.theta, request.phi)
    # Avoid redundant first-time sweeps when two frontend pages request the same run.
    with SWEEP_LOCK:
        return _sweep(*key)


@lru_cache(maxsize=96)
def _sweep(locations, n, channels, theta, phi):
    points = []
    for i in range(11):
        p = i / 10
        results = {}
        for channel in channels:
            transfer, translation = process_map(channel, p, locations)
            stats = average_from_map(transfer, translation, n)
            results[channel] = {**stats,
                                "state_fidelity": state_fidelity_from_map(transfer, translation, theta, phi),
                                "noise": {"enabled": True, "channel": channel, "p": p, "locations": list(locations)},
                                "difference_from_ideal": 1 - stats["average_fidelity"]}
        points.append({"p": p, "channels": results})
    return {"points": points, "table": [point for point in points if point["p"] in (0, 0.2, 0.5, 0.8, 1)],
            "settings": {"locations": list(locations), "location_details": [dict(id=l, **LOCATION_INFO[l]) for l in locations],
                         "sample_count": n, "sample_id": state_sample_id(n), "channels": list(channels),
                         "theta": theta, "phi": phi, "probabilities": [i / 10 for i in range(11)]},
            "method": "Four exact Aer circuit probes per (channel,p), linear CPTP process reconstruction, equal-area Fibonacci sphere sample.",
            "probe_states": ["|0>", "|1>", "|+>", "|+i>"],
            "benchmark": CLASSICAL_BENCHMARK, "benchmark_explanation": BENCHMARK_EXPLANATION,
            "ideal_reference": 1.0}


def extrapolate(scales, values, degree=1):
    """Least-squares polynomial intercept with the actual estimator weights.

    No clipping. Values outside [0,1] are explicitly reported as unphysical.
    """
    x = np.asarray(scales, dtype=float)
    y = np.asarray(values, dtype=float)
    if len(x) != len(y) or len(x) <= degree or not np.isfinite(y).all():
        raise ValueError("Invalid extrapolation samples.")
    design = np.vander(x, N=degree + 1, increasing=True)
    weights = np.linalg.pinv(design)[0]
    coefficients = np.linalg.lstsq(design, y, rcond=None)[0]
    intercept = float(coefficients[0])
    residuals = y - design @ coefficients
    return {"estimate": intercept, "weights": weights.tolist(), "coefficients": coefficients.tolist(),
            "fit_rmse": float(np.sqrt(np.mean(residuals**2))),
            "physical": bool(0 <= intercept <= 1)}


def mitigate(request: MitigationRequest):
    rows = []
    locations = tuple(sorted(request.locations))
    for scale in request.scales:
        transfer, translation = process_map(request.channel, request.p, locations, scale)
        stats = average_from_map(transfer, translation, request.sample_count)
        state_f = state_fidelity_from_map(transfer, translation, request.theta, request.phi)
        target_value = stats["average_fidelity"] if request.target == "average" else state_f
        rows.append({"scale": scale, "fidelity": target_value, "average_fidelity": stats["average_fidelity"],
                     "state_fidelity": state_f, "effective_p_per_site": 1 - (1 - request.p) ** scale,
                     "channel_instructions": scale * len(locations),
                     "noise": {"enabled": True, "channel": request.channel, "p": request.p, "locations": list(locations)}})
    fit = extrapolate(request.scales, [r["fidelity"] for r in rows], request.degree)
    baseline = rows[0]["fidelity"]
    before_error = abs(1 - baseline)
    after_error = abs(1 - fit["estimate"])
    # 'Improved' requires a physical estimator as well as smaller error; an
    # unphysical intercept is never presented as an improved quantum state.
    improved = fit["physical"] and after_error < before_error - 1e-10
    warnings = [
        "This is an extrapolated fidelity estimate, not a recovered density matrix or a corrected physical state.",
        "Noise is amplified by repeating the selected Kraus channel on Bob's Bell qubit q2 (digital channel repetition; not pulse stretching or gate folding).",
        "The model assumes the same independent, stationary channel at each repetition. No hardware noise calibration is inferred.",
        "Extrapolation has model bias; shot-based hardware would also amplify statistical uncertainty."
    ]
    if request.p >= 0.3:
        warnings.append("High noise strength is far from the zero-noise regime; polynomial extrapolation may be inaccurate or fail to improve.")
    if not fit["physical"]:
        warnings.append("The raw extrapolated estimate is outside [0,1]. It has NOT been clipped; do not interpret it as a physical fidelity.")
    if not improved:
        warnings.append("This selected case did not produce a physical estimate closer to the ideal fidelity.")
    return {"method": "Digital channel-repetition zero-noise extrapolation", "settings": request.model_dump(mode="json"),
            "points": rows, "baseline_fidelity": baseline, "ideal_fidelity": 1.0,
            "extrapolated_fidelity": fit["estimate"], "fit": fit, "improved": improved,
            "improvement": before_error - after_error, "before_error": before_error, "after_error": after_error,
            "sample_id": state_sample_id(request.sample_count), "warnings": warnings}
