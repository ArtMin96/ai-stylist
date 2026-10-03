"""Log redaction (planning/11 §8): the forbidden key words and the structlog processor that drops
them. Pure code; `main.py` wires the processor into logging and `tracing.py` applies the same
words to span attributes.

The words mirror the single source `packages/shared-kernel/registry/forbidden-log-keys.json`.
The Docker image does not contain `packages/`, so they are a constant here, pinned to that file
by `tests/test_redaction.py::test_forbidden_words_match_the_shared_kernel_registry`. The matching
mirrors `isForbiddenLogKey` in `apps/api/src/platform/logger.ts`: a key is forbidden when the whole
key, or any of its camelCase / snake_case / kebab-case words, is a forbidden word
(`userEmail`, `refresh_token` and `x-auth-token` are forbidden; `latency` and `userId` are not).
"""

from __future__ import annotations

import re
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


def _scrub(value: Any) -> tuple[Any, int]:
    """Return a copy of `value` with forbidden keys removed at every depth + a drop count."""
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
