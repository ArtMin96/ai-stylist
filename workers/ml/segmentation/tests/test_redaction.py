"""Log-redaction canary (brief §6): planted markers must never reach the log stream."""

from __future__ import annotations

import io
import json
import logging
from collections.abc import Iterator

import pytest
import structlog

from ai_stylist_segmentation.main import (
    FORBIDDEN_LOG_KEYS,
    REDACTED_COUNT_KEY,
    configure_logging,
    redact_forbidden_keys,
)

MARKER = "CANARY-7f3a9c"


@pytest.fixture
def log_stream() -> Iterator[io.StringIO]:
    stream = io.StringIO()
    configure_logging(stream=stream, level="DEBUG")
    yield stream
    configure_logging()  # restore process defaults for later tests


def _records(stream: io.StringIO) -> list[dict[str, object]]:
    return [json.loads(line) for line in stream.getvalue().splitlines() if line]


@pytest.mark.parametrize("key", sorted(FORBIDDEN_LOG_KEYS))
def test_processor_drops_every_forbidden_key(key: str) -> None:
    event = {"event": "x", key: MARKER, "safe": "kept"}

    result = redact_forbidden_keys(None, "info", event)

    assert key not in result
    assert result["safe"] == "kept"
    assert result[REDACTED_COUNT_KEY] == 1


def test_processor_is_case_insensitive_and_recursive() -> None:
    event = {
        "event": "x",
        "Authorization": f"Bearer {MARKER}",
        "user": {"Email": MARKER, "id": "u1", "profile": {"measurements": {"chest": 1}}},
        "items": [{"photo": MARKER}, {"ok": True}],
    }

    result = redact_forbidden_keys(None, "info", event)

    assert MARKER not in json.dumps(result)
    assert result["user"] == {"id": "u1", "profile": {}}
    assert result["items"] == [{}, {"ok": True}]
    assert result[REDACTED_COUNT_KEY] == 4


def test_structlog_canary_never_reaches_stream(log_stream: io.StringIO) -> None:
    structlog.get_logger("canary").info(
        "user.updated", email=MARKER, token=MARKER, user_id="u1", face={"landmarks": MARKER}
    )

    records = _records(log_stream)
    assert MARKER not in log_stream.getvalue()
    assert len(records) == 1
    assert records[0]["event"] == "user.updated"
    assert records[0]["user_id"] == "u1"
    assert records[0]["level"] == "info"
    assert records[0][REDACTED_COUNT_KEY] == 3


def test_stdlib_canary_never_reaches_stream(log_stream: io.StringIO) -> None:
    logging.getLogger("uvicorn.error").warning("boot", extra={"password": MARKER, "port": 8000})

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record["event"] == "boot"
    assert record["port"] == 8000
    assert record["logger"] == "uvicorn.error"


def test_uvicorn_access_logger_is_silenced(log_stream: io.StringIO) -> None:
    logging.getLogger("uvicorn.access").info("GET /v1/segment?token=%s", MARKER)

    assert log_stream.getvalue() == ""
