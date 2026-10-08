"""Log redaction rules (planning/11 §8), unit level: which keys are forbidden, what the processor
drops, and what a logged exception is reduced to. The words, examples, shapes, depth and vectors
come from `ai_stylist_generated.kernel` (generated from `packages/shared-kernel/registry/`;
`packages/contracts/tests/kernel-python.test.ts` checks it against the registry JSON), so no test
reads a file by repo path. The end-to-end canary through a configured logger is each service's
own `tests/test_redaction.py`."""

from __future__ import annotations

import json

import pytest

from ai_stylist_generated.kernel import (
    EXCEPTION_TYPE_REPLACED,
    FORBIDDEN_LOG_KEY_EXAMPLES_ALLOWED,
    FORBIDDEN_LOG_KEY_EXAMPLES_FORBIDDEN,
    FORBIDDEN_LOG_KEYS,
)
from ai_stylist_observability.redaction import (
    REDACTED_COUNT_KEY,
    is_forbidden_log_key,
    redact_forbidden_keys,
    summarize_error,
)

MARKER = "CANARY-1b8e40"


@pytest.mark.parametrize("value", EXCEPTION_TYPE_REPLACED)
def test_a_logged_exception_whose_class_name_is_a_replaced_vector_is_written_as_error(
    value: str,
) -> None:
    # The log side of the `exception.type` rule: a dynamically created class can carry any text as
    # its name.
    error = type(value, (Exception,), {})(MARKER)

    assert summarize_error(error) == {"type": "Error"}


@pytest.mark.parametrize("key", sorted(FORBIDDEN_LOG_KEYS))
def test_processor_drops_every_forbidden_key(key: str) -> None:
    event = {"event": "x", key: MARKER, "safe": "kept"}

    result = redact_forbidden_keys(None, "info", event)

    assert key not in result
    assert result["safe"] == "kept"
    assert result[REDACTED_COUNT_KEY] == 1


@pytest.mark.parametrize("key", FORBIDDEN_LOG_KEY_EXAMPLES_FORBIDDEN)
def test_key_with_a_forbidden_word_is_forbidden(key: str) -> None:
    assert is_forbidden_log_key(key)


@pytest.mark.parametrize("key", FORBIDDEN_LOG_KEY_EXAMPLES_ALLOWED)
def test_key_without_a_forbidden_word_stays_loggable(key: str) -> None:
    assert not is_forbidden_log_key(key)


def test_processor_is_case_insensitive_and_recursive() -> None:
    event = {
        "event": "x",
        "Authorization": f"Bearer {MARKER}",
        "user": {"Email": MARKER, "id": "u1", "profile": {"measurements": {"chest": 1}}},
        "items": [{"photo": MARKER}, {"ok": True}],
        "request": {"imageRef": MARKER, "sessionCookie": MARKER, "geo": {"lng": 1.0}},
    }

    result = redact_forbidden_keys(None, "info", event)

    assert MARKER not in json.dumps(result)
    assert result["user"] == {"id": "u1", "profile": {}}
    assert result["items"] == [{}, {"ok": True}]
    assert result["request"] == {"geo": {}}
    assert result[REDACTED_COUNT_KEY] == 7
