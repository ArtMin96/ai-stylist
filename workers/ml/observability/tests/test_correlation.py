"""Correlation id (planning/14 §2), unit level: which caller ids are accepted and when one is
minted. Cases mirror apps/api/src/platform/tests/correlation.test.ts. The middleware on a running
app (echo, log binding) is covered by each service's `tests/test_correlation.py`."""

from __future__ import annotations

import re

import pytest

from ai_stylist_observability.correlation import (
    correlation_id_from_header,
    is_valid_correlation_id,
)

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


@pytest.mark.parametrize(
    "value", ["corr-client-1", "01J9ZQ4M8Y3V5K7T2N6P0R1S4X", "a.b_c:d-e", "x" * 128]
)
def test_accepts_uuid_ulid_and_prefixed_ids(value: str) -> None:
    assert is_valid_correlation_id(value)
    assert correlation_id_from_header([value]) == value


@pytest.mark.parametrize("values", [["corr-1", "corr-2"], ["corr-1\n"]])
def test_duplicate_headers_or_a_trailing_newline_are_replaced(values: list[str]) -> None:
    assert UUID.match(correlation_id_from_header(values))
