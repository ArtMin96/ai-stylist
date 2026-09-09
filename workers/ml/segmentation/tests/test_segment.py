from __future__ import annotations

import asyncio
from typing import get_args

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from hypothesis import given, settings
from hypothesis import strategies as st

from ai_stylist_segmentation.schemas import MaskLabel, SegmentRequest, SegmentResponse

_LABELS: tuple[MaskLabel, ...] = get_args(MaskLabel)

segment_requests = st.builds(
    SegmentRequest,
    request_id=st.text(min_size=1, max_size=128),
    image_ref=st.text(min_size=1, max_size=1024),
    hint=st.none() | st.sampled_from(_LABELS),
)


async def test_segment_echoes_request_with_stub_provenance(client: AsyncClient) -> None:
    payload = {"request_id": "req_01J", "image_ref": "media/u1/garment.jpg", "hint": "top"}

    response = await client.post("/v1/segment", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "request_id": "req_01J",
        "image_ref": "media/u1/garment.jpg",
        "masks": [],
        "provenance": {"generated": True, "model": "stub", "confidence": 0.0},
    }


async def test_segment_rejects_unknown_fields(client: AsyncClient) -> None:
    payload = {"request_id": "r", "image_ref": "k", "selfie": "data:..."}

    response = await client.post("/v1/segment", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "extra_forbidden"


async def test_segment_rejects_missing_image_ref(client: AsyncClient) -> None:
    response = await client.post("/v1/segment", json={"request_id": "r"})

    assert response.status_code == 422


async def _post_segment(app: FastAPI, request: SegmentRequest) -> Response:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.post("/v1/segment", json=request.model_dump(mode="json"))


@given(request=segment_requests)
@settings(max_examples=100, deadline=None)
def test_any_valid_request_round_trips(app: FastAPI, request: SegmentRequest) -> None:
    # Hypothesis cannot drive an `async def` test, so each example runs its own loop.
    response = asyncio.run(_post_segment(app, request))

    assert response.status_code == 200
    parsed = SegmentResponse.model_validate(response.json())
    assert parsed.request_id == request.request_id
    assert parsed.image_ref == request.image_ref
    assert parsed.provenance.generated is True
    assert parsed.provenance.model == "stub"
    assert parsed.masks == []
