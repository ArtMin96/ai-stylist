"""Correlation id (planning/14 §2), unit level: which caller ids are accepted and when one is
minted. The ids are the shared-kernel vectors (packages/shared-kernel/registry/correlation.json,
generated), which the envelope schema and the API header check are tested on too. The middleware
on a running app (echo, log binding) is covered by each service's `tests/test_correlation.py`."""

from __future__ import annotations

import re

import pytest

from ai_stylist_generated.kernel import CORRELATION_ID_ACCEPTED, CORRELATION_ID_REJECTED
from ai_stylist_observability.correlation import (
    correlation_id_from_header,
    is_valid_correlation_id,
)

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


@pytest.mark.parametrize("value", CORRELATION_ID_ACCEPTED)
def test_accepts_envelope_valid_ids(value: str) -> None:
    assert is_valid_correlation_id(value)
    assert correlation_id_from_header([value]) == value


@pytest.mark.parametrize("value", CORRELATION_ID_REJECTED)
def test_rejects_envelope_invalid_ids_and_mints_one(value: str) -> None:
    assert not is_valid_correlation_id(value)
    assert UUID.match(correlation_id_from_header([value]))


def test_rejects_a_missing_id() -> None:
    assert not is_valid_correlation_id(None)


@pytest.mark.parametrize("values", [[], ["corr-1", "corr-2"], ["corr-1", "corr-1"]])
def test_no_header_or_duplicate_headers_are_replaced(values: list[str]) -> None:
    assert UUID.match(correlation_id_from_header(values))
