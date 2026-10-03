"""Log-redaction canary (brief §6): planted markers must never reach the log stream."""

from __future__ import annotations

import io
import json
import logging
from pathlib import Path

import pytest
import structlog
from httpx import AsyncClient

from ai_stylist_segmentation.redaction import (
    FORBIDDEN_LOG_KEYS,
    REDACTED_COUNT_KEY,
    is_forbidden_log_key,
    redact_forbidden_keys,
)

MARKER = "CANARY-7f3a9c"

# The single source of the forbidden words (repo checkout; the Docker image has no `packages/`).
REGISTRY = (
    Path(__file__).resolve().parents[4]
    / "packages"
    / "shared-kernel"
    / "registry"
    / "forbidden-log-keys.json"
)


def _records(stream: io.StringIO) -> list[dict[str, object]]:
    return [json.loads(line) for line in stream.getvalue().splitlines() if line]


def test_forbidden_words_match_the_shared_kernel_registry() -> None:
    registry_words: list[str] = json.loads(REGISTRY.read_text(encoding="utf-8"))["keys"]

    assert len(registry_words) == len(set(registry_words))
    assert set(registry_words) == FORBIDDEN_LOG_KEYS, (
        "FORBIDDEN_LOG_KEYS (ai_stylist_segmentation/redaction.py) drifted from "
        "packages/shared-kernel/registry/forbidden-log-keys.json; copy the registry's words"
    )


@pytest.mark.parametrize("key", sorted(FORBIDDEN_LOG_KEYS))
def test_processor_drops_every_forbidden_key(key: str) -> None:
    event = {"event": "x", key: MARKER, "safe": "kept"}

    result = redact_forbidden_keys(None, "info", event)

    assert key not in result
    assert result["safe"] == "kept"
    assert result[REDACTED_COUNT_KEY] == 1


# Same cases as apps/api/src/platform/tests/logger.redaction.test.ts (`isForbiddenLogKey`).
@pytest.mark.parametrize(
    "key", ["token", "accessToken", "refresh_token", "body", "imageUrl", "lat", "user-email"]
)
def test_key_with_a_forbidden_word_is_forbidden(key: str) -> None:
    assert is_forbidden_log_key(key)


@pytest.mark.parametrize(
    "key", ["userId", "status", "latency", "template", "count", "imagination", "correlation_id"]
)
def test_key_without_a_forbidden_word_stays_loggable(key: str) -> None:
    assert not is_forbidden_log_key(key)


@pytest.mark.parametrize("word", sorted(FORBIDDEN_LOG_KEYS))
def test_every_word_is_matched_in_camel_snake_and_kebab_keys(
    word: str, log_stream: io.StringIO
) -> None:
    keys = {f"user{word.capitalize()}", f"user_{word}", f"user-{word}", word.upper()}

    structlog.get_logger("canary").info("user.updated", user_id="u1", **dict.fromkeys(keys, MARKER))

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record["user_id"] == "u1"
    assert record[REDACTED_COUNT_KEY] == len(keys)


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


def test_structlog_canary_never_reaches_stream(log_stream: io.StringIO) -> None:
    structlog.get_logger("canary").info(
        "user.updated",
        email=MARKER,
        token=MARKER,
        user_id="u1",
        face={"landmarks": MARKER},
        phone_number=MARKER,
        client_secret=MARKER,
        prompt_text=MARKER,
        calendarEvents=[MARKER],
    )

    records = _records(log_stream)
    assert MARKER not in log_stream.getvalue()
    assert len(records) == 1
    assert records[0]["event"] == "user.updated"
    assert records[0]["user_id"] == "u1"
    assert records[0]["level"] == "info"
    assert records[0][REDACTED_COUNT_KEY] == 7


def test_stdlib_canary_never_reaches_stream(log_stream: io.StringIO) -> None:
    logging.getLogger("uvicorn.error").warning(
        "boot", extra={"password": MARKER, "db_password": MARKER, "port": 8000}
    )

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record["event"] == "boot"
    assert record["port"] == 8000
    assert record["logger"] == "uvicorn.error"


def test_uvicorn_access_logger_is_silenced(log_stream: io.StringIO) -> None:
    logging.getLogger("uvicorn.access").info("GET /v1/segment?token=%s", MARKER)

    assert log_stream.getvalue() == ""


async def test_request_log_carries_correlation_id_and_no_header_or_query(
    client: AsyncClient, log_stream: io.StringIO
) -> None:
    response = await client.post(
        f"/v1/segment?token={MARKER}",
        json={"request_id": "req_1", "image_ref": "media/u1/garment.jpg"},
        headers={
            "x-correlation-id": "corr-canary-1",
            "authorization": f"Bearer {MARKER}",
            "cookie": f"session={MARKER}",
        },
    )

    assert response.status_code == 200
    assert MARKER not in log_stream.getvalue()
    (record,) = [record for record in _records(log_stream) if record["event"] == "http.request"]
    assert record["correlation_id"] == "corr-canary-1"
    assert record["path"] == "/v1/segment"
