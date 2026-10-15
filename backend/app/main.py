"""FastAPI endpoints; never return synthetic fallback values on engine failure."""
import logging
import math
from pathlib import Path
import time

import numpy as np
import qiskit
import qiskit_aer
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .circuit import build_circuit, circuit_svg, operations, injection_manifest, native_svg
from .engine import simulate, input_state, fidelity, bloch_vector, encode_complex, validate_density, CLASSICAL_BENCHMARK
from .experiments import sweep, mitigate, BENCHMARK_EXPLANATION
from .models import SimulationRequest, SweepRequest, MitigationRequest, Channel, LOCATION_INFO

logger = logging.getLogger("qubitlab")
app = FastAPI(title="QubitLab · Teleportation under circuit noise", version="1.0.0",
              description="Three-qubit Qiskit Aer density-matrix simulation with exact measurement-branch averaging.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    def safe(value):
        if isinstance(value, float) and not math.isfinite(value):
            return str(value)
        if isinstance(value, BaseException):
            return str(value)
        if isinstance(value, dict):
            return {k: safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [safe(v) for v in value]
        return value
    return JSONResponse(status_code=422, content={"detail": safe(exc.errors())})


@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "Qiskit Aer", "method": "density_matrix", "qiskit": qiskit.__version__,
            "qiskit_aer": qiskit_aer.__version__, "version": "1.0.0", "exact_branch_ensemble": True}


@app.get("/api/config")
def config():
    return {
        "locations": [dict(id=key, **value) for key, value in LOCATION_INFO.items()],
        "channels": [c.value for c in Channel],
        "classical_benchmark": CLASSICAL_BENCHMARK,
        "benchmark_explanation": BENCHMARK_EXPLANATION,
        "noise_conventions": {
            "amplitude_damping": "Energy relaxation: K0=diag(1,sqrt(1-p)); K1=sqrt(p)|0><1|.",
            "phase_damping": "Aer phase damping: populations unchanged; off-diagonal elements multiplied by sqrt(1-p).",
            "depolarizing": "Aer convention: E(rho)=(1-p)rho+p I/2. Nonidentity Pauli probabilities are p/4 each.",
            "bit_flip": "E(rho)=(1-p)rho+p X rho X; p=1 is deterministic X, not complete depolarization."
        },
        "noise_insertion_location": {
            "id": "bell_cx_q2",
            "stage": "entanglement",
            "qubit": 2,
            "gate": "CX",
            "label": "Bob's Bell qubit (q2)",
            "description": "Resource-state noise on Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell-state measurement."
        }
    }


@app.post("/api/simulate")
def simulate_endpoint(request: SimulationRequest):
    start = time.perf_counter()
    try:
        result = simulate(request.theta, request.phi, request.noise)
        psi = input_state(request.theta, request.phi)
        input_rho = np.outer(psi, psi.conj())
        f = fidelity(psi, result.rho)
        qc = build_circuit(request.theta, request.phi, request.noise)
        return {"settings": request.model_dump(mode="json"), "input_state": encode_complex(psi),
                "input_density": encode_complex(input_rho), "output_density": encode_complex(result.rho),
                "input_bloch": bloch_vector(input_rho).tolist(), "output_bloch": bloch_vector(result.rho).tolist(),
                "fidelity": f, "ideal_fidelity": 1.0, "difference_from_ideal": 1 - f,
                "purity": float(np.trace(result.rho @ result.rho).real), "validation": validate_density(result.rho),
                "branches": [{"mZ": b.mZ, "mX": b.mX, "probability": b.probability,
                              "correction": ("X " if b.mX else "") + ("Z" if b.mZ else "") or "I",
                              "fidelity": fidelity(psi, b.rho), "output_density": encode_complex(b.rho)} for b in result.branches],
                "circuit": {"svg": circuit_svg(qc), "text": str(qc.draw(output="text", fold=-1)),
                            "operations": operations(qc), "noise_insertions": injection_manifest(request.noise),
                            "classical_mapping": {"mZ": "q0 → conditional Z(q2)", "mX": "q1 → conditional X(q2)"}},
                "engine": {"name": "Qiskit Aer", "method": "density_matrix", "sampling": False,
                           "ensemble": "Exact projection probabilities; deterministic measurement and if_test execution per branch.",
                           "measurement_branches": len(result.branches), "elapsed_ms": round((time.perf_counter() - start) * 1000, 2)}}
    except Exception as exc:
        logger.exception("Simulation failed")
        raise HTTPException(status_code=500, detail=f"Qiskit simulation failed: {exc}") from exc


@app.post("/api/sweep")
def sweep_endpoint(request: SweepRequest):
    try:
        return sweep(request)
    except Exception as exc:
        logger.exception("Sweep failed")
        raise HTTPException(status_code=500, detail=f"Fidelity sweep failed: {exc}") from exc


@app.post("/api/mitigate")
def mitigation_endpoint(request: MitigationRequest):
    try:
        return mitigate(request)
    except Exception as exc:
        logger.exception("Mitigation failed")
        raise HTTPException(status_code=500, detail=f"Mitigation experiment failed: {exc}") from exc


@app.post("/api/circuit/native")
def circuit_native(request: SimulationRequest):
    try:
        svg = native_svg(build_circuit(request.theta, request.phi, request.noise))
        return Response(content=svg, media_type="image/svg+xml")
    except Exception as exc:
        logger.exception("Circuit drawing failed")
        raise HTTPException(status_code=500, detail=f"Qiskit native circuit drawing failed: {exc}") from exc


# Optional single-origin production mode. Build the frontend BEFORE starting
# this process. Development still uses Vite's /api reverse proxy.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (FRONTEND_DIST / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Unknown API endpoint.")
        return FileResponse(FRONTEND_DIST / "index.html")
