"""One source of truth for the executed circuit and its visualisation.

Methodological constraint: The ONLY supported noise insertion point is 'bell_cx_q2'
(Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell measurement).
No alternative or secondary noise locations are permitted.
"""
from functools import lru_cache
from html import escape
from io import StringIO
import math
import threading

import numpy as np
from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister
from qiskit.quantum_info import Kraus
from qiskit_aer.noise import amplitude_damping_error, phase_damping_error, depolarizing_error, pauli_error

from .models import Channel, LOCATION_INFO, NoiseConfig

SHORT = {"amplitude_damping": "AD", "phase_damping": "PD", "depolarizing": "DEP", "bit_flip": "BF"}
DRAW_LOCK = threading.Lock()


@lru_cache(maxsize=1024)
def kraus_instruction(channel: str, p: float):
    if channel == "amplitude_damping":
        error = amplitude_damping_error(p)
    elif channel == "phase_damping":
        # Qiskit Aer phase damping convention:
        # Populations unchanged; off-diagonal elements multiplied by sqrt(1-p).
        error = phase_damping_error(p)
    elif channel == "depolarizing":
        # Aer convention: E(rho) = (1-p) rho + p I/2.
        # Pauli weights are (1 - 3p/4) for I, and p/4 for each of X, Y, Z.
        error = depolarizing_error(p, 1)
    elif channel == "bit_flip":
        # E(rho) = (1-p) rho + p X rho X.
        error = pauli_error([("X", p), ("I", 1 - p)])
    else:
        raise ValueError(f"Unknown noise channel: {channel}")
    instruction = Kraus(error).to_instruction()
    # Explicit label displaying channel abbreviation and probability
    instruction.label = f"{SHORT[channel]}({p:.3f})"
    return instruction


def insert_noise(qc: QuantumCircuit, noise: NoiseConfig, location: str, scale: int = 1):
    if not noise.enabled or location not in noise.locations:
        return
    q = LOCATION_INFO[location]["qubit"]
    for _ in range(scale):
        qc.append(kraus_instruction(noise.channel.value, noise.p), [q])


def registers():
    q = QuantumRegister(3, "q")
    mz = ClassicalRegister(1, "mZ")
    mx = ClassicalRegister(1, "mX")
    return q, mz, mx


def prepare_prefix(theta: float, phi: float, noise: NoiseConfig, scale: int = 1):
    """Build the prefix of the teleportation circuit up to Alice's readout.

    Sequence:
    1. Prepare arbitrary input state on q0: U(theta, phi, 0)
    2. Bell pair creation: H(q1), then CX(q1, q2)
    3. Apply selected noise channel to q2 ONLY (resource-state noise)
    4. Alice's Bell measurement gates: CX(q0, q1), then H(q0)
    """
    q, mz, mx = registers()
    qc = QuantumCircuit(q, mz, mx, name="teleportation")
    # 1. Input state preparation on q0
    qc.u(theta, phi, 0, 0)
    qc.barrier(label="Bell pair")
    # 2. Bell pair creation on (q1, q2)
    qc.h(1)
    qc.cx(1, 2)
    # 3. Noise on q2 ONLY immediately after CX(1,2)
    insert_noise(qc, noise, "bell_cx_q2", scale)
    qc.barrier(label="Bell measurement")
    # 4. Alice Bell measurement gates
    qc.cx(0, 1)
    qc.h(0)
    return qc


def measure_and_correct(qc: QuantumCircuit):
    """Alice's projective measurement and Bob's conditional Pauli corrections.

    Sequence:
    5. Measure q0 -> mZ, q1 -> mX
    6. Bob conditional corrections on q2: X if mX=1, Z if mZ=1
    7. Save Bob's output density matrix on q2
    """
    mz, mx = qc.cregs
    qc.barrier(label="Readout")
    qc.measure(0, mz[0])
    qc.measure(1, mx[0])
    qc.barrier(label="Feed forward")
    with qc.if_test((mx, 1)):
        qc.x(2)
    with qc.if_test((mz, 1)):
        qc.z(2)
    qc.barrier(label="Bob output")
    qc.save_density_matrix(qubits=[2], label="bob")
    return qc


def build_circuit(theta: float, phi: float, noise: NoiseConfig, scale: int = 1):
    qc = prepare_prefix(theta, phi, noise, scale)
    measure_and_correct(qc)
    qc.metadata = {"noise": noise.model_dump(mode="json"), "noise_scale": scale}
    return qc


def build_branch(projected_density: np.ndarray):
    q, mz, mx = registers()
    qc = QuantumCircuit(q, mz, mx)
    qc.set_density_matrix(projected_density)
    return measure_and_correct(qc)


def operations(qc: QuantumCircuit):
    """Flatten the real Qiskit instructions while retaining classical conditions."""
    output = []
    stage = "Input preparation"

    def walk(circuit, qubit_map, clbit_map, condition=None):
        nonlocal stage
        for inst in circuit.data:
            op = inst.operation
            qs = [qubit_map[circuit.find_bit(q).index] for q in inst.qubits]
            cs = [clbit_map[circuit.find_bit(c).index] for c in inst.clbits]
            if op.name == "if_else":
                reg, value = op.condition
                name = getattr(reg, "name", "classical")
                cond = {"bit": name, "value": int(value)}
                walk(op.blocks[0], qs, cs, cond)
                continue
            if op.name == "barrier":
                stage = op.label or stage
                continue
            is_noise = bool(op.label and any(op.label.startswith(s + "(") for s in SHORT.values()))
            output.append({
                "name": op.name,
                "label": op.label or op.name.upper(),
                "qubits": qs,
                "clbits": cs,
                "stage": stage,
                "condition": condition,
                "noise": is_noise,
                "params": [float(x) for x in op.params if isinstance(x, (int, float, np.floating))] if not is_noise else [],
            })

    walk(qc, list(range(qc.num_qubits)), list(range(qc.num_clbits)))
    return output


def injection_manifest(noise: NoiseConfig, scale: int = 1):
    return [dict(location=loc, **LOCATION_INFO[loc], channel=noise.channel.value,
                 probability=noise.p, repetitions=scale,
                 physically_nonzero=noise.enabled and noise.p > 0)
            for loc in noise.locations] if noise.enabled else []


def circuit_svg(qc: QuantumCircuit):
    """Horizontal SVG generated directly from the ACTUAL Qiskit instruction stream.

    Every measurement wire and conditional gate follows Qiskit's clbit mapping.
    No external assets: the SVG renders cleanly in all environments.
    """
    ops = operations(qc)
    xs = []
    cursor = 202
    for op in ops:
        xs.append(cursor)
        cursor += 78 if op["noise"] else (74 if op["name"] == "u" else 66)
    width = max(850, cursor + 64)
    ys = [107, 174, 241]
    cys = [311, 349]
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" class="teleportation-circuit" role="img" aria-label="Executed Qiskit teleportation circuit" viewBox="0 0 {width} 394" width="{width}" height="394">',
         '<style>.teleportation-circuit text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace} .teleportation-circuit .small{font-size:10px} .teleportation-circuit .wire{stroke:#4b607a;stroke-width:1.3} .teleportation-circuit .cw{stroke:#6e829e;stroke-width:1} .teleportation-circuit .gate{fill:#1e354b;stroke:#6c9ebb;stroke-width:1.2}</style>',
         '<defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#8ba1bd"/></marker></defs>',
         f'<rect width="{width}" height="394" rx="8" fill="#111c2d"/>']
    # Stage headers derived from the same instruction stream.
    groups = []
    for i, op in enumerate(ops):
        if not groups or groups[-1][0] != op["stage"]:
            groups.append([op["stage"], xs[i] - 30, xs[i] + 30])
        else:
            groups[-1][2] = xs[i] + 30
    for title, left, right in groups:
        tint = "#182f3c" if title == "Bell pair" else "#1c213b" if title in ("Bell measurement", "Readout") else "#152a29" if title == "Feed forward" else "#172334"
        display_title = "Input" if title == "Input preparation" else title
        s.append(f'<rect x="{left}" y="25" width="{max(58, right-left)}" height="30" rx="7" fill="{tint}"/><text x="{(left+right)/2}" y="44" text-anchor="middle" font-size="10" fill="#b8cbe3">{escape(display_title)}</text>')
    names = [("q0", "Alice · input |ψ⟩"), ("q1", "Alice · Bell pair"), ("q2", "Bob · Bell pair & output ρ")]
    for i, (name, desc) in enumerate(names):
        y = ys[i]
        s += [f'<text x="16" y="{y-6}" fill="#d6e5f4" font-size="12" font-weight="600">{name}</text>',
              f'<text x="16" y="{y+10}" fill="#8194ad" font-size="9">{escape(desc)}</text>',
              f'<line x1="160" y1="{y}" x2="{width-20}" y2="{y}" class="wire"/>']
    for i, name in enumerate(["mZ ← q0", "mX ← q1"]):
        y = cys[i]
        s += [f'<text x="16" y="{y+4}" fill="#90a4bf" font-size="11">{escape(name)}</text>',
              f'<line x1="160" y1="{y-2}" x2="{width-20}" y2="{y-2}" class="cw"/>',
              f'<line x1="160" y1="{y+2}" x2="{width-20}" y2="{y+2}" class="cw"/>']
    for op, x in zip(ops, xs):
        name = op["name"]
        qs = op["qubits"]
        y = ys[qs[0]] if qs else ys[2]
        condition = op["condition"]
        s.append(f'<g data-operation="{escape(name)}" data-noise="{str(op["noise"]).lower()}" data-condition="{escape(str(condition or ""))}"><title>{escape(op["label"])} · {escape(op["stage"])}</title>')
        if name == "cx":
            y2 = ys[qs[1]]
            s += [f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y2}" stroke="#b1c3df" stroke-width="1.6"/>',
                  f'<circle cx="{x}" cy="{y}" r="4.5" fill="#b1c3df"/>',
                  f'<circle cx="{x}" cy="{y2}" r="13" fill="#132235" stroke="#b1c3df" stroke-width="1.5"/>',
                  f'<path d="M{x-8},{y2}h16 M{x},{y2-8}v16" stroke="#b1c3df" stroke-width="1.5"/>']
        elif name == "measure":
            cy = cys[op["clbits"][0]]
            s += [f'<path d="M{x-2},{y+18} V{cy-7} M{x+2},{y+18} V{cy-7}" class="cw"/>',
                  f'<path d="M{x},{cy-15}V{cy-4}" stroke="#8ba1bd" marker-end="url(#arrow)"/>',
                  f'<rect x="{x-17}" y="{y-18}" width="34" height="36" rx="5" class="gate"/>',
                  f'<path d="M{x-10},{y+5} A11,11 0 0,1 {x+10},{y+5} M{x},{y+5}l8,-12" stroke="#d4e5f9" fill="none" stroke-width="1.5"/>']
        else:
            if condition and not op["noise"]:
                cy = cys[0 if condition["bit"] == "mZ" else 1]
                s += [f'<path d="M{x-2},{y+18}V{cy} M{x+2},{y+18}V{cy}" class="cw"/>',
                      f'<circle cx="{x}" cy="{cy}" r="4.5" fill="#67d8b9"/>',
                      f'<text x="{x}" y="{cy+20}" class="small" fill="#8edcc8" text-anchor="middle">{condition["bit"]}=1</text>']
            if op["noise"]:
                label = op["label"]
                short = label.split("(")[0]
                prob = label.split("(")[-1].rstrip(")")
                s += [f'<rect x="{x-29}" y="{y-22}" width="58" height="44" rx="7" fill="#342332" stroke="#e9a177" stroke-dasharray="3 2"/>',
                      f'<text x="{x}" y="{y-2}" text-anchor="middle" font-size="12" fill="#ffbf99">{short}</text>',
                      f'<text x="{x}" y="{y+13}" text-anchor="middle" font-size="9" fill="#e2a989">p={prob}</text>']
            else:
                label = "ψ(θ,φ)" if name == "u" else "ρB" if name == "save_density_matrix" else name.upper()
                wide = 52 if name == "u" else 34
                fill = "#173b46" if name == "u" else "#123b32" if name == "save_density_matrix" else "#1e354b"
                s += [f'<rect x="{x-wide/2}" y="{y-18}" width="{wide}" height="36" rx="6" fill="{fill}" stroke="#6c9ebb"/>',
                      f'<text x="{x}" y="{y+5}" text-anchor="middle" font-size="13" fill="#daf0fc">{label}</text>']
        s.append('</g>')
    s.append('</svg>')
    return "".join(s)


def native_svg(qc: QuantumCircuit):
    """Native Qiskit/Matplotlib circuit drawer; render is protected against threads."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    with DRAW_LOCK:
        fig = qc.draw(output="mpl", fold=-1, idle_wires=True, style={
            "backgroundcolor": "#101b2c", "linecolor": "#9badc4", "textcolor": "#e4edf9",
            "gatetextcolor": "#e4edf9", "gatefacecolor": "#24394f", "barrierfacecolor": "#54647a",
            "creglinecolor": "#97aac2", "fontsize": 11, "subfontsize": 8,
        })
        out = StringIO()
        fig.savefig(out, format="svg", bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
    return out.getvalue()
