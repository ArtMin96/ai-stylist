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
# Its word-split examples: `forbidden` keys every matcher must catch, `allowed` keys it must not.
# The API's logger test reads the same file (`FORBIDDEN_LOG_KEY_EXAMPLES`); read at collection
# time because the test ids are its keys.
EXAMPLES: dict[str, list[str]] = json.loads(
    REGISTRY.with_name("forbidden-log-keys.examples.json").read_text(encoding="utf-8")
)


class DriverError(Exception):
    """Shaped like a database driver error: its code names the failure, its message echoes a row."""

    def __init__(self, message: str, code: object = "23505") -> None:
        super().__init__(message)
        self.code = code


DRIVER_ERROR_SUMMARY = {"type": "DriverError", "code": "23505"}
# The observable contract of a logged exception, pinned as literals: the field the API logger
# writes it under (`err`) and the number of cause links followed (its MAX_ERR_CAUSE_DEPTH).
ERR_KEY = "err"
MAX_ERR_CAUSE_DEPTH = 5


def _driver_error() -> DriverError:
    return DriverError(f"Key (note)=({MARKER}) already exists.")


def _failed_query() -> RuntimeError:
    """A wrapper whose message lists the statement parameters, raised from the driver error."""
    try:
        raise _driver_error()
    except DriverError as driver_error:
        try:
            raise RuntimeError(f"Failed query: params: {MARKER}") from driver_error
        except RuntimeError as wrapper:
            return wrapper


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


@pytest.mark.parametrize("key", EXAMPLES["forbidden"])
def test_key_with_a_forbidden_word_is_forbidden(key: str) -> None:
    assert is_forbidden_log_key(key)


@pytest.mark.parametrize("key", EXAMPLES["allowed"])
def test_key_without_a_forbidden_word_stays_loggable(key: str) -> None:
    assert not is_forbidden_log_key(key)


def test_every_forbidden_example_is_dropped_and_every_allowed_one_kept(
    log_stream: io.StringIO,
) -> None:
    allowed = {key: f"visible-{key}" for key in EXAMPLES["allowed"]}

    structlog.get_logger("canary").info(
        "examples", **dict.fromkeys(EXAMPLES["forbidden"], MARKER), **allowed
    )

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert {key: record.get(key) for key in allowed} == allowed
    assert record[REDACTED_COUNT_KEY] == len(EXAMPLES["forbidden"])


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


# --- a logged exception is an allowlist: class, code-shaped code, cause chain (planning/11 §8) --
# Same rule as the API logger's `err` (apps/api/src/platform/logger.ts `serializeErr`, with
# queue/error-summary.ts for each link): never the message, the traceback or another attribute.


def test_logged_exception_keeps_its_class_and_code_only(log_stream: io.StringIO) -> None:
    try:
        raise _driver_error()
    except DriverError:
        structlog.get_logger("canary").exception("driver error canary")

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record[ERR_KEY] == DRIVER_ERROR_SUMMARY
    assert "exception" not in record
    assert "exc_info" not in record


def test_cause_chain_is_summarised_the_same_way_and_bounded(log_stream: io.StringIO) -> None:
    log = structlog.get_logger("canary")
    circular = ValueError(f"loop {MARKER}")
    circular.__cause__ = circular
    try:
        raise _driver_error()
    except DriverError:
        try:
            # No `from`: Python links the driver error as `__context__` (what a traceback prints).
            raise ValueError(f"implicit context {MARKER}")
        except ValueError as implicit:
            implicit_context = implicit
    try:
        raise _driver_error()
    except DriverError:
        try:
            raise ValueError(f"suppressed {MARKER}") from None
        except ValueError as suppressed:
            suppressed_context = suppressed

    log.error("wrapped", exc_info=_failed_query())
    log.error("implicit", exc_info=implicit_context)
    log.error("suppressed", exc_info=suppressed_context)
    log.error("circular", exc_info=circular)

    assert MARKER not in log_stream.getvalue()
    wrapped, implicit, suppressed, loop = (record[ERR_KEY] for record in _records(log_stream))
    assert wrapped == {"type": "RuntimeError", "cause": DRIVER_ERROR_SUMMARY}
    assert implicit == {"type": "ValueError", "cause": DRIVER_ERROR_SUMMARY}
    assert suppressed == {"type": "ValueError"}
    assert json.dumps(loop).count('"cause"') == MAX_ERR_CAUSE_DEPTH


def test_code_is_kept_only_when_code_shaped_and_a_free_text_class_name_is_not_logged(
    log_stream: io.StringIO,
) -> None:
    log = structlog.get_logger("canary")
    leaky_class = type(f"Leaky {MARKER}", (ValueError,), {})
    longest = "E" * 64

    log.error("free-text code", exc_info=DriverError("x", code=f"bad {MARKER}"))
    log.error("numeric code", exc_info=DriverError("x", code=404))
    log.error("system code", exc_info=DriverError("fetch failed", code="ECONNREFUSED"))
    log.error("free-text class", exc_info=leaky_class(MARKER))
    log.error("longest class", exc_info=type(longest, (Exception,), {})())
    log.error("too long class", exc_info=type(longest + "E", (Exception,), {})())

    assert MARKER not in log_stream.getvalue()
    assert [record[ERR_KEY] for record in _records(log_stream)] == [
        {"type": "DriverError"},
        {"type": "DriverError"},
        {"type": "DriverError", "code": "ECONNREFUSED"},
        {"type": "Error"},
        {"type": longest},
        {"type": "Error"},
    ]


def test_an_exception_under_any_other_key_is_summarised_the_same_way(
    log_stream: io.StringIO,
) -> None:
    job = {"last_error": _failed_query(), "attempts": [_driver_error()]}

    structlog.get_logger("canary").error("nested", failure=_driver_error(), job=job)

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record["failure"] == DRIVER_ERROR_SUMMARY
    assert record["job"] == {
        "last_error": {"type": "RuntimeError", "cause": DRIVER_ERROR_SUMMARY},
        "attempts": [DRIVER_ERROR_SUMMARY],
    }


def test_stdlib_exception_keeps_its_class_and_code_only(log_stream: io.StringIO) -> None:
    try:
        raise _failed_query()
    except RuntimeError:
        logging.getLogger("uvicorn.error").exception("Exception in ASGI application")

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record["event"] == "Exception in ASGI application"
    assert record[ERR_KEY] == {"type": "RuntimeError", "cause": DRIVER_ERROR_SUMMARY}
    assert "exception" not in record


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
