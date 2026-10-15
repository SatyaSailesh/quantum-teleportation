"""Validated, bounded REST contracts. Angles are always in radians.

Methodological constraint: The ONLY supported noise insertion point is 'bell_cx_q2'
(Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell measurement).
"""
from enum import Enum
from math import pi
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Channel(str, Enum):
    amplitude_damping = "amplitude_damping"
    phase_damping = "phase_damping"
    depolarizing = "depolarizing"
    bit_flip = "bit_flip"


LOCATION_INFO = {
    "bell_cx_q2": {
        "stage": "entanglement",
        "qubit": 2,
        "gate": "CX",
        "label": "Bob's Bell qubit (q2)",
        "description": "Resource-state noise on Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell-state measurement.",
    }
}
Location = Literal["bell_cx_q2"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class NoiseConfig(StrictModel):
    enabled: bool = False
    channel: Channel = Channel.amplitude_damping
    p: float = Field(default=0.2, ge=0, le=1)
    locations: list[Location] = Field(default_factory=lambda: ["bell_cx_q2"], max_length=1)

    @model_validator(mode="after")
    def check_locations(self):
        if not self.locations or self.locations != ["bell_cx_q2"]:
            raise ValueError(
                "The only supported noise insertion point is 'bell_cx_q2' "
                "(Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell measurement)."
            )
        return self


class SimulationRequest(StrictModel):
    theta: float = Field(default=pi / 2, ge=0, le=pi)
    phi: float = Field(default=pi / 4, ge=0, le=2 * pi)
    noise: NoiseConfig = Field(default_factory=NoiseConfig)


class SweepRequest(StrictModel):
    locations: list[Location] = Field(default_factory=lambda: ["bell_cx_q2"], max_length=1)
    sample_count: int = Field(default=96, ge=24, le=512)
    channels: list[Channel] = Field(default_factory=lambda: list(Channel), min_length=1, max_length=4)
    theta: float = Field(default=pi / 2, ge=0, le=pi)
    phi: float = Field(default=pi / 4, ge=0, le=2 * pi)

    @model_validator(mode="after")
    def unique(self):
        if not self.locations or self.locations != ["bell_cx_q2"]:
            raise ValueError(
                "The only supported noise insertion point is 'bell_cx_q2' "
                "(Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell measurement)."
            )
        if len(set(self.channels)) != len(self.channels):
            raise ValueError("Channels must be unique.")
        return self


class MitigationRequest(StrictModel):
    channel: Literal["amplitude_damping", "phase_damping", "depolarizing"] = "depolarizing"
    p: float = Field(default=0.1, gt=0, le=1)
    locations: list[Location] = Field(default_factory=lambda: ["bell_cx_q2"], max_length=1)
    scales: list[int] = Field(default_factory=lambda: [1, 2, 3], min_length=3, max_length=5)
    degree: Literal[1, 2] = 1
    target: Literal["average", "state"] = "average"
    sample_count: int = Field(default=96, ge=24, le=512)
    theta: float = Field(default=pi / 2, ge=0, le=pi)
    phi: float = Field(default=pi / 4, ge=0, le=2 * pi)

    @model_validator(mode="after")
    def valid_scales(self):
        if self.scales != sorted(set(self.scales)) or self.scales[0] != 1 or any(s < 1 or s > 7 for s in self.scales):
            raise ValueError("Use sorted, distinct integer noise scales in [1,7], starting at 1.")
        if not self.locations or self.locations != ["bell_cx_q2"]:
            raise ValueError(
                "The only supported noise insertion point is 'bell_cx_q2' "
                "(Bob's Bell-pair qubit immediately after CX(q1,q2) and before Alice's Bell measurement)."
            )
        return self
