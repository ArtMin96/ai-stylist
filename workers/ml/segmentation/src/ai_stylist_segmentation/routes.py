"""HTTP routes. Thin adapters only: no domain logic lives here (root CLAUDE.md)."""

from __future__ import annotations

from fastapi import APIRouter

from ai_stylist_segmentation import SERVICE_NAME, __version__
from ai_stylist_segmentation.schemas import (
    HealthResponse,
    Provenance,
    SegmentRequest,
    SegmentResponse,
)

router = APIRouter()

STUB_PROVENANCE = Provenance(generated=True, model="stub", confidence=0.0)


@router.get("/health", response_model=HealthResponse, tags=["ops"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service=SERVICE_NAME, version=__version__)


@router.post("/v1/segment", response_model=SegmentResponse, tags=["segmentation"])
async def segment(request: SegmentRequest) -> SegmentResponse:
    """P02 echo stub: validates the request and returns an empty, clearly-marked result.

    TODO(P02 T08): wire the real model behind this route; keep the provenance marker.
    """
    return SegmentResponse(
        request_id=request.request_id,
        image_ref=request.image_ref,
        masks=[],
        provenance=STUB_PROVENANCE,
    )
