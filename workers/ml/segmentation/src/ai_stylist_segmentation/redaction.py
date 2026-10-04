"""Log redaction (planning/11 §8): the forbidden key words and the structlog processor that drops
them, and the allowlist a logged exception is reduced to. Pure code; `main.py` wires the
processors into logging and `tracing.py` applies the same words to span attributes.

The words mirror the single source `packages/shared-kernel/registry/forbidden-log-keys.json`.
The Docker image does not contain `packages/`, so they are a constant here, pinned to that file
by `tests/test_redaction.py::test_forbidden_words_match_the_shared_kernel_registry`. The matching
mirrors `isForbiddenLogKey` in `apps/api/src/platform/logger.ts`: a key is forbidden when the whole
key, or any of its camelCase / snake_case / kebab-case words, is a forbidden word
(`userEmail`, `refresh_token` and `x-auth-token` are forbidden; `latency` and `userId` are not).

A logged exception mirrors the API logger's `err` serializer (`serializeErr`, with
`apps/api/src/platform/queue/error-summary.ts` for each link): `{type, code?, cause?}` only, under
`err` for the exception being logged (`exc_info`) and in place of an exception under any other key.
Never the message, the traceback or another attribute: a driver error's message echoes row values,
and a wrapper's message can list statement parameters. Not covered, as in the API: free text the
caller builds into the event itself (`log.error(f"failed: {error}")`).
"""

from __future__ import annotations

import re
import sys
from collections.abc import MutableMapping
from typing import Any

FORBIDDEN_LOG_KEYS: frozenset[str] = frozenset(
    {
        "measurements",
        "measurement",
        "selfie",
        "face",
        "photo",
        "image",
        "location",
        "lat",
        "lng",
        "latitude",
        "longitude",
        "coordinates",
        "token",
        "authorization",
        "cookie",
        "password",
        "secret",
        "email",
        "phone",
        "body",
        "prompt",
        "calendar",
    }
)

REDACTED_COUNT_KEY = "redacted_keys"

# `WORD_SPLIT` in apps/api/src/platform/logger.ts: runs of non-alphanumerics, and the boundary
# between a lowercase letter or digit and an uppercase letter.
_WORD_SPLIT = re.compile(r"[^a-zA-Z0-9]+|(?<=[a-z0-9])(?=[A-Z])")


def is_forbidden_log_key(key: str) -> bool:
    """True when `key`, or one of its camel/snake/kebab words, is a forbidden word."""
    if key.lower() in FORBIDDEN_LOG_KEYS:
        return True
    return any(word.lower() in FORBIDDEN_LOG_KEYS for word in _WORD_SPLIT.split(key) if word)


# The log field of the exception being logged, as the API logger's `err`.
ERR_KEY = "err"
# `cause` links of a logged exception that are followed; the bound also ends a circular chain.
MAX_ERR_CAUSE_DEPTH = 5
# What a class name may look like to be logged (else `Error`): a dynamically created class can
# carry any text as its name. ASCII `\w`, as the API's JavaScript pattern.
_ERROR_NAME_SHAPE = re.compile(r"[A-Za-z_$][\w$.]{0,63}", re.ASCII)
# A code worth keeping (a SQLSTATE such as `23505`, a system code such as `ECONNREFUSED`): short and
# code-shaped, never free text. `CODE_SHAPE` of the API's queue/error-summary.ts.
_CODE_SHAPE = re.compile(r"[A-Z0-9_]{1,32}", re.ASCII)


def _cause_of(error: BaseException) -> BaseException | None:
    """The next link of the chain Python's own traceback prints: the explicit cause (`raise ... from
    cause`), else the exception being handled when it was raised, unless `from None` hid it."""
    if error.__cause__ is not None:
        return error.__cause__
    return None if error.__suppress_context__ else error.__context__


def summarize_error(error: BaseException, depth: int = 0) -> dict[str, Any]:
    """Everything of an exception that may reach a log line: its class name, a code-shaped `code`
    attribute, and the same for at most `MAX_ERR_CAUSE_DEPTH` links of its cause chain."""
    name = type(error).__name__
    summary: dict[str, Any] = {"type": name if _ERROR_NAME_SHAPE.fullmatch(name) else "Error"}
    code = getattr(error, "code", None)
    if isinstance(code, str) and _CODE_SHAPE.fullmatch(code):
        summary["code"] = code
    cause = _cause_of(error) if depth < MAX_ERR_CAUSE_DEPTH else None
    if cause is not None:
        summary["cause"] = summarize_error(cause, depth + 1)
    return summary


def _logged_exception(exc_info: Any) -> BaseException | None:
    """The exception an `exc_info` value names: an exception, an `exc_info` tuple, or a truthy
    value meaning the exception being handled (`log.exception(...)`)."""
    if isinstance(exc_info, BaseException):
        return exc_info
    if isinstance(exc_info, tuple) and len(exc_info) == 3:  # (type, value, traceback)
        _type, value, _traceback = exc_info
        return value if isinstance(value, BaseException) else None
    return sys.exception() if exc_info else None


def summarize_exc_info(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """structlog processor in place of `format_exc_info`: replaces `exc_info` with the
    `summarize_error` allowlist under `err`, so no message or traceback is rendered."""
    exc_info = event_dict.pop("exc_info", None)
    error = _logged_exception(exc_info)
    if error is not None:
        event_dict[ERR_KEY] = summarize_error(error)
    return event_dict


def _scrub(value: Any) -> tuple[Any, int]:
    """Return a copy of `value` with forbidden keys removed at every depth + a drop count. An
    exception, under any key and at any depth, becomes its `summarize_error` allowlist."""
    if isinstance(value, BaseException):
        return summarize_error(value), 0
    if isinstance(value, MutableMapping):
        dropped = 0
        cleaned: dict[str, Any] = {}
        for key, inner in value.items():
            if is_forbidden_log_key(str(key)):
                dropped += 1
                continue
            cleaned[key], inner_dropped = _scrub(inner)
            dropped += inner_dropped
        return cleaned, dropped
    if isinstance(value, list | tuple):
        items = [_scrub(item) for item in value]
        return [item for item, _ in items], sum(count for _, count in items)
    return value, 0


def redact_forbidden_keys(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """structlog processor: drop every forbidden key; record how many were dropped."""
    cleaned, dropped = _scrub(event_dict)
    if dropped:
        cleaned[REDACTED_COUNT_KEY] = dropped
    return cleaned
