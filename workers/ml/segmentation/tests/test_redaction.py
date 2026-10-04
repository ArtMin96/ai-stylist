"""Log-redaction canary (brief §6): planted markers must never reach the log stream."""

from __future__ import annotations

import io
import json
import logging
from types import MappingProxyType

import pytest
import structlog
from httpx import AsyncClient

from ai_stylist_generated.kernel import (
    CODE_SHAPE,
    ERROR_NAME_SHAPE,
    EXCEPTION_TYPE_KEPT,
    EXCEPTION_TYPE_REPLACED,
    FORBIDDEN_LOG_KEY_EXAMPLES_ALLOWED,
    FORBIDDEN_LOG_KEY_EXAMPLES_FORBIDDEN,
    FORBIDDEN_LOG_KEYS,
    MAX_CAUSE_DEPTH,
)
from ai_stylist_segmentation.redaction import (
    REDACTED_COUNT_KEY,
    is_forbidden_log_key,
    redact_forbidden_keys,
    summarize_error,
)
from ai_stylist_segmentation.tracing import sanitize_attributes

MARKER = "CANARY-7f3a9c"

# The forbidden words, their word-split examples (`forbidden` keys every matcher must catch,
# `allowed` keys it must not), the error shapes, the cause depth and the `exception.type` vectors
# all come from `ai_stylist_generated.kernel`, generated from `packages/shared-kernel/registry/`
# by `just generate`. `packages/contracts/tests/kernel-python.test.ts` checks that module against
# the registry JSON, so these tests consume it and read no file by repo path.


class DriverError(Exception):
    """Shaped like a database driver error: its code names the failure, its message echoes a row."""

    def __init__(self, message: str, code: object = "23505") -> None:
        super().__init__(message)
        self.code = code


DRIVER_ERROR_SUMMARY = {"type": "DriverError", "code": "23505"}
# The field the API logger writes a logged exception under, pinned as a literal. The number of cause
# links followed is the generated `MAX_CAUSE_DEPTH`.
ERR_KEY = "err"


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


def _registry_shaped(value: str) -> bool:
    """The registry's own `exception.type` rule: name-shaped or code-shaped, by `fullmatch`."""
    return any(shape.fullmatch(value) for shape in (ERROR_NAME_SHAPE, CODE_SHAPE))


@pytest.mark.parametrize("value", EXCEPTION_TYPE_KEPT)
def test_registry_exception_type_kept_vector_is_kept(value: str) -> None:
    assert _registry_shaped(value)
    assert sanitize_attributes({"exception.type": value}) == {"exception.type": value}


@pytest.mark.parametrize("value", EXCEPTION_TYPE_REPLACED)
def test_registry_exception_type_replaced_vector_is_written_as_error(value: str) -> None:
    assert not _registry_shaped(value)
    assert sanitize_attributes({"exception.type": value}) == {"exception.type": "Error"}


@pytest.mark.parametrize("value", EXCEPTION_TYPE_REPLACED)
def test_a_logged_exception_whose_class_name_is_a_replaced_vector_is_written_as_error(
    value: str,
) -> None:
    # The log side of the same rule: a dynamically created class can carry any text as its name.
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


def test_every_forbidden_example_is_dropped_and_every_allowed_one_kept(
    log_stream: io.StringIO,
) -> None:
    allowed = {key: f"visible-{key}" for key in FORBIDDEN_LOG_KEY_EXAMPLES_ALLOWED}

    structlog.get_logger("canary").info(
        "examples", **dict.fromkeys(FORBIDDEN_LOG_KEY_EXAMPLES_FORBIDDEN, MARKER), **allowed
    )

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert {key: record.get(key) for key in allowed} == allowed
    assert record[REDACTED_COUNT_KEY] == len(FORBIDDEN_LOG_KEY_EXAMPLES_FORBIDDEN)


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
# errors/error-shape.ts for each link): never the message, the traceback or another attribute.


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
    assert json.dumps(loop).count('"cause"') == MAX_CAUSE_DEPTH


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


# --- the line carries only what the caller wrote, and a bad value never breaks it ---------------


class RaisingCodeError(Exception):
    """An exception whose `code` property raises with free text."""

    @property
    def code(self) -> str:
        raise RuntimeError(f"code lookup {MARKER}")


class Opaque:
    """A value JSON cannot encode, whose repr is free text."""

    def __repr__(self) -> str:
        return f"Opaque({MARKER})"


class Unprintable:
    """A stdlib log message whose `str()` raises with free text."""

    def __str__(self) -> str:
        raise ValueError(f"str {MARKER}")


def _worker_handler(stream: io.StringIO) -> logging.Handler:
    """The JSON handler `configure_logging` installed on `stream` (not pytest's capture handler)."""
    return next(
        handler
        for handler in logging.getLogger().handlers
        if isinstance(handler, logging.StreamHandler) and handler.stream is stream
    )


def _stdlib_record(
    msg: object, *args: object, exc_info: BaseException | None = None
) -> logging.LogRecord:
    """A stdlib record handed straight to the worker handler: pytest's own capture handler on the
    root logger would otherwise format it too, and it fails the test on a formatting error."""
    info = None if exc_info is None else (type(exc_info), exc_info, exc_info.__traceback__)
    return logging.LogRecord("uvicorn.error", logging.ERROR, __file__, 1, msg, args, info)


def test_positional_arguments_never_reach_the_line(log_stream: io.StringIO) -> None:
    log = structlog.get_logger("canary")

    log.error("failed %s", _driver_error())
    log.info("user %s from %s", MARKER, MARKER)
    logging.getLogger("uvicorn.error").error("stdlib failed %s", MARKER)

    assert MARKER not in log_stream.getvalue()
    records = _records(log_stream)
    assert [record["event"] for record in records] == [
        "failed %s",
        "user %s from %s",
        "stdlib failed %s",
    ]
    assert all("positional_args" not in record for record in records)


def test_a_stdlib_message_that_is_not_a_string_is_logged_by_type(log_stream: io.StringIO) -> None:
    logging.getLogger("uvicorn.error").error(_driver_error())

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record["event"] == "DriverError"


def test_a_value_under_err_that_is_not_the_logged_exception_is_reduced_to_its_type(
    log_stream: io.StringIO,
) -> None:
    log = structlog.get_logger("canary")

    log.error("as text", err=str(_driver_error()))
    log.error("as dict", err={"message": MARKER, "detail": [MARKER]})
    log.error("as exception", err=_failed_query())
    logging.getLogger("uvicorn.error").error("stdlib extra", extra={"err": MARKER})

    assert MARKER not in log_stream.getvalue()
    assert [record[ERR_KEY] for record in _records(log_stream)] == [
        {"type": "str"},
        {"type": "dict"},
        {"type": "RuntimeError", "cause": DRIVER_ERROR_SUMMARY},
        {"type": "str"},
    ]


def test_a_raising_code_property_is_skipped_on_both_paths(
    log_stream: io.StringIO, capsys: pytest.CaptureFixture[str]
) -> None:
    structlog.get_logger("canary").error("structlog", exc_info=RaisingCodeError(MARKER))
    stdlib_record = _stdlib_record("stdlib", exc_info=RaisingCodeError(MARKER))
    _worker_handler(log_stream).handle(stdlib_record)

    captured = capsys.readouterr()
    assert MARKER not in log_stream.getvalue() + captured.out + captured.err
    assert [record[ERR_KEY] for record in _records(log_stream)] == [
        {"type": "RaisingCodeError"},
        {"type": "RaisingCodeError"},
    ]


def test_a_cycle_is_written_as_circular(log_stream: io.StringIO) -> None:
    cyclic: dict[str, object] = {"id": "c1"}
    cyclic["self"] = cyclic
    looped: list[object] = ["l1"]
    looped.append(looped)
    shared = {"id": "s1"}

    structlog.get_logger("canary").info("cycles", job=cyclic, items=looped, a=shared, b=shared)

    (record,) = _records(log_stream)
    assert record["job"] == {"id": "c1", "self": "[Circular]"}
    assert record["items"] == ["l1", "[Circular]"]
    # A repeated reference that is not a cycle is written in full both times.
    assert record["a"] == record["b"] == {"id": "s1"}


def test_a_failing_handler_writes_nothing_to_stderr(
    log_stream: io.StringIO, capsys: pytest.CaptureFixture[str]
) -> None:
    _worker_handler(log_stream).handle(_stdlib_record(Unprintable(), MARKER))

    captured = capsys.readouterr()
    assert MARKER not in log_stream.getvalue() + captured.out + captured.err
    assert logging.raiseExceptions is False


def test_read_only_mappings_and_sets_are_walked(log_stream: io.StringIO) -> None:
    structlog.get_logger("canary").info(
        "containers",
        meta=MappingProxyType({"email": MARKER, "id": "m1"}),
        failures={_driver_error()},
        frozen=frozenset({_driver_error()}),
        nested=[MappingProxyType({"inner": {_driver_error()}})],
    )

    assert MARKER not in log_stream.getvalue()
    (record,) = _records(log_stream)
    assert record["meta"] == {"id": "m1"}
    assert record["failures"] == [DRIVER_ERROR_SUMMARY]
    assert record["frozen"] == [DRIVER_ERROR_SUMMARY]
    assert record["nested"] == [{"inner": [DRIVER_ERROR_SUMMARY]}]
    assert record[REDACTED_COUNT_KEY] == 1


def test_a_mapping_with_mixed_key_types_is_still_written(log_stream: io.StringIO) -> None:
    # `JSONRenderer(sort_keys=True)` cannot order int and str keys together; with
    # `logging.raiseExceptions = False` the whole line would vanish without a trace.
    log = structlog.get_logger("canary")

    log.info("mixed", m={1: "a", "b": 2})
    log.info("mixed nested", job={"attempts": {0: "first", "last": 1, 2.5: "x", None: "n"}})
    log.info("mixed forbidden", m={1: "a", "email": MARKER, 2: {"userToken": MARKER, 3: "c"}})

    assert MARKER not in log_stream.getvalue()
    mixed, nested, forbidden = _records(log_stream)
    assert mixed["m"] == {"1": "a", "b": 2}
    assert nested["job"] == {"attempts": {"0": "first", "last": 1, "2.5": "x", "None": "n"}}
    assert forbidden["m"] == {"1": "a", "2": {"3": "c"}}
    assert forbidden[REDACTED_COUNT_KEY] == 2


def test_a_value_json_cannot_encode_is_written_as_its_type_name(log_stream: io.StringIO) -> None:
    structlog.get_logger("canary").info("opaque", value=Opaque())
    logging.getLogger("uvicorn.error").warning("opaque", extra={"value": Opaque()})

    assert MARKER not in log_stream.getvalue()
    assert [record["value"] for record in _records(log_stream)] == ["Opaque", "Opaque"]


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
