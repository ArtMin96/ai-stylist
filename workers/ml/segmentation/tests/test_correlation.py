"""Correlation id (planning/14 §2): accepted when valid, minted otherwise, echoed, and on every log
line of the request. Cases mirror apps/api/src/platform/tests/correlation.test.ts; the id rules'
unit tests live in `workers/ml/observability/tests/test_correlation.py`."""

from __future__ import annotations

import io
import json
import re

import pytest
import structlog
from httpx import AsyncClient

from ai_stylist_observability.correlation import CORRELATION_ID_HEADER

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
PAYLOAD = {"request_id": "req_1", "image_ref": "media/u1/garment.jpg"}


def _correlation_ids(stream: io.StringIO, event: str = "http.request") -> list[object]:
    """`correlation_id` of each `event` line (other DEBUG lines, e.g. asyncio's, vary by OS)."""
    records = [json.loads(line) for line in stream.getvalue().splitlines()]
    return [record.get("correlation_id") for record in records if record["event"] == event]


async def test_echoes_a_valid_caller_id_and_logs_it(
    client: AsyncClient, log_stream: io.StringIO
) -> None:
    response = await client.post(
        "/v1/segment", json=PAYLOAD, headers={CORRELATION_ID_HEADER: "corr-client-1"}
    )

    assert response.status_code == 200
    assert response.headers[CORRELATION_ID_HEADER] == "corr-client-1"
    assert _correlation_ids(log_stream) == ["corr-client-1"]


@pytest.mark.parametrize(
    "sent",
    [None, "", "x" * 129, "corr 1", "corr;1"],
    ids=["absent", "empty", "129 characters", "with a space", "with a semicolon"],
)
async def test_mints_a_new_id_when_the_caller_id_is_missing_or_invalid(
    client: AsyncClient, log_stream: io.StringIO, sent: str | None
) -> None:
    headers = {} if sent is None else {CORRELATION_ID_HEADER: sent}

    response = await client.post("/v1/segment", json=PAYLOAD, headers=headers)

    minted = response.headers[CORRELATION_ID_HEADER]
    assert UUID.match(minted)
    assert _correlation_ids(log_stream) == [minted]


async def test_each_request_gets_its_own_minted_id(client: AsyncClient) -> None:
    first = (await client.get("/health")).headers[CORRELATION_ID_HEADER]
    second = (await client.get("/health")).headers[CORRELATION_ID_HEADER]

    assert first != second


def test_no_correlation_id_outside_a_request(log_stream: io.StringIO) -> None:
    structlog.get_logger("outside").info("startup")

    assert _correlation_ids(log_stream, event="startup") == [None]
