"""Independent NumPy reference used ONLY by tests, not application plots.

No Qiskit imports: eight-dimensional operators, explicit Kraus channels, and
unnormalised projective branches form a separate correctness oracle.

Methodological constraint: The only supported noise location is 'bell_cx_q2'
(Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell measurement).
"""
import numpy as np

I = np.eye(2, dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.diag([1, -1]).astype(complex)
H = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)


def lift(matrix, q):
    # Little-endian Qiskit order: q0 + 2*q1 + 4*q2
    matrices = [matrix if i == q else I for i in [2, 1, 0]]
    return np.kron(np.kron(matrices[0], matrices[1]), matrices[2])


def cx(control, target):
    result = np.zeros((8, 8), dtype=complex)
    for index in range(8):
        out = index ^ (1 << target) if (index >> control) & 1 else index
        result[out, index] = 1
    return result


def kraus(channel, p):
    if channel == "amplitude_damping":
        return [np.diag([1, np.sqrt(1 - p)]), np.array([[0, np.sqrt(p)], [0, 0]], dtype=complex)]
    if channel == "phase_damping":
        # Qiskit Aer phase damping: populations unchanged, off-diagonals scaled by sqrt(1-p)
        return [np.diag([1, np.sqrt(1 - p)]), np.diag([0, np.sqrt(p)])]
    if channel == "depolarizing":
        # Aer depolarizing: (1-p)rho + p*I/2
        return [np.sqrt(1 - 3 * p / 4) * I] + [np.sqrt(p / 4) * a for a in [X, Y, Z]]
    if channel == "bit_flip":
        return [np.sqrt(1 - p) * I, np.sqrt(p) * X]
    raise ValueError(channel)


def reference_teleport(theta, phi, channel, p, locations, scale=1):
    psi = np.array([np.cos(theta / 2), np.exp(1j * phi) * np.sin(theta / 2)], dtype=complex)
    state = np.zeros(8, dtype=complex)
    state[:2] = psi
    rho = np.outer(state, state.conj())
    operators = kraus(channel, p)

    def noise(r, location, q):
        if location not in locations:
            return r
        for _ in range(scale):
            lifted = [lift(k, q) for k in operators]
            r = sum(k @ r @ k.conj().T for k in lifted)
        return r

    def gate(r, g):
        return g @ r @ g.conj().T

    # 1. Prepare input on q0 (already in state)
    # 2. Bell-pair creation: H(q1), then CX(1,2)
    rho = gate(rho, lift(H, 1))
    rho = gate(rho, cx(1, 2))

    # 3. Apply noise to q2 ONLY
    rho = noise(rho, "bell_cx_q2", 2)

    # 4. Alice Bell measurement gates: CX(0,1), then H(0)
    rho = gate(rho, cx(0, 1))
    rho = gate(rho, lift(H, 0))

    # 5. Measure q0 -> mZ, q1 -> mX & apply Bob's conditional corrections
    output = np.zeros((2, 2), dtype=complex)
    for mz in [0, 1]:
        for mx in [0, 1]:
            idx = [mz + 2 * mx, mz + 2 * mx + 4]
            bob = rho[np.ix_(idx, idx)]
            if mx == 1:
                bob = X @ bob @ X.conj().T
            if mz == 1:
                bob = Z @ bob @ Z.conj().T
            output += bob
    return output
