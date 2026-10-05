"""Request/response models for the segmentation service.

Every model comes from the generated package (`just generate` → `workers/ml/generated`), never a
hand-written twin: the HTTP contract from `packages/contracts/workers/segmentation/` and the event
envelope from `packages/contracts/events/` (single source of truth — root CLAUDE.md
"Architectural invariants"); `just generate --check` fails when they drift from the schema. The
API side (`apps/api/src/jobs/segmentation-client.ts`) uses the generated TS contract
`@ai-stylist/contracts/workers` from the same schema.

`MaskLabel` and `MaskRef` are re-exported as generated. The models this service builds or receives
whole are thin subclasses that only add `frozen=True` (the generated models are mutable): a
handler cannot mutate its request, and `routes.STUB_PROVENANCE`, one instance shared by every
response, cannot be changed by one of them. Fields, constraints and `extra="forbid"` are the
generated ones; a nested field keeps its generated type, so a reply parsed from JSON holds
generated (mutable) `Provenance` / `MaskRef` values.
"""

from __future__ import annotations

from pydantic import ConfigDict

from ai_stylist_generated.events.envelope import EventEnvelope
from ai_stylist_generated.segmentation import segmentation_v1 as contract
from ai_stylist_generated.segmentation.segmentation_v1 import MaskLabel, MaskRef

__all__ = [
    "EventEnvelope",
    "HealthResponse",
    "MaskLabel",
    "MaskRef",
    "Provenance",
    "SegmentRequest",
    "SegmentResponse",
]


class SegmentRequest(contract.SegmentRequest):
    """`POST /v1/segment` body: an R2 object reference, never image bytes or user data."""

    model_config = ConfigDict(frozen=True)


class Provenance(contract.Provenance):
    """Honesty marker: every generated view carries provenance + confidence."""

    model_config = ConfigDict(frozen=True)


class SegmentResponse(contract.SegmentResponse):
    """`POST /v1/segment` reply: mask references plus the provenance marker."""

    model_config = ConfigDict(frozen=True)


class HealthResponse(contract.HealthResponse):
    """`GET /health` reply."""

    model_config = ConfigDict(frozen=True)
