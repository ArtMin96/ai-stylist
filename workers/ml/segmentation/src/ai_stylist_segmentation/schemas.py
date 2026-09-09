"""Request/response models for the segmentation service.

The event envelope is the generated one (`just generate` → `workers/ml/generated`); it is
re-exported here so the service consumes the contract and `just typecheck` catches drift.

TODO(P02 T08): the HTTP request/response models below are local until
`packages/contracts` publishes the worker schemas; then replace them with imports from
`ai_stylist_generated` (single source of truth — root CLAUDE.md "Architectural invariants").
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ai_stylist_generated.events.envelope import EventEnvelope

__all__ = [
    "EventEnvelope",
    "HealthResponse",
    "MaskLabel",
    "MaskRef",
    "Provenance",
    "SegmentRequest",
    "SegmentResponse",
]

MaskLabel = Literal["top", "bottom", "dress", "outerwear", "shoes", "accessory", "background"]


class SegmentRequest(BaseModel):
    """Segment one garment photo already stored in R2.

    The worker never receives image bytes or user data — only an object reference
    (doc 04 §2: media lives in R2; workers are stateless glue).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    request_id: str = Field(min_length=1, max_length=128, description="Caller correlation ID")
    image_ref: str = Field(
        min_length=1, max_length=1024, description="R2 object key of the source image"
    )
    hint: MaskLabel | None = Field(
        default=None, description="Optional garment class hint from the closet taxonomy"
    )


class Provenance(BaseModel):
    """Honesty marker: every generated view carries provenance + confidence."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    generated: bool = True
    model: str = Field(min_length=1, description="Model identifier that produced the result")
    confidence: float = Field(ge=0.0, le=1.0)


class MaskRef(BaseModel):
    """A derived mask stored back to R2 (never inline pixels)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    label: MaskLabel
    mask_ref: str = Field(min_length=1, max_length=1024)
    score: float = Field(ge=0.0, le=1.0)


class SegmentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    request_id: str
    image_ref: str
    masks: list[MaskRef] = Field(default_factory=list)
    provenance: Provenance


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: Literal["ok"]
    service: str
    version: str
