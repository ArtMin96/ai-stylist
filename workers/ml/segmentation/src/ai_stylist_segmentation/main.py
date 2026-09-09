"""Composition root (brief §5 `composition-root-only`): the only module that builds the
app and configures process-wide concerns. Everything else is importable pure code.

Run: `uvicorn ai_stylist_segmentation.main:app --port 8001` (see workers/README.md).
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import MutableMapping
from typing import IO, Any

import structlog

from ai_stylist_segmentation.app import create_app

# Denylist from planning/11 §8. Any log key matching one of these (case-insensitive,
# at any nesting depth) is dropped before rendering. Request bodies are never logged
# at all — see `app._access_log`.
FORBIDDEN_LOG_KEYS: frozenset[str] = frozenset(
    {
        "measurements",
        "selfie",
        "face",
        "photo",
        "location",
        "token",
        "authorization",
        "password",
        "email",
    }
)

REDACTED_COUNT_KEY = "redacted_keys"


def _scrub(value: Any) -> tuple[Any, int]:
    """Return a copy of `value` with forbidden keys removed at every depth + a drop count."""
    if isinstance(value, MutableMapping):
        dropped = 0
        cleaned: dict[str, Any] = {}
        for key, inner in value.items():
            if str(key).lower() in FORBIDDEN_LOG_KEYS:
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


def _drop_uvicorn_noise(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """uvicorn attaches an ANSI-coloured duplicate of the message; keep the plain one."""
    event_dict.pop("color_message", None)
    return event_dict


def configure_logging(stream: IO[str] = sys.stdout, level: str | None = None) -> None:
    """JSON logs on `stream`, redaction applied to structlog *and* stdlib records."""
    log_level = logging.getLevelNamesMapping()[
        (level or os.environ.get("LOG_LEVEL", "INFO")).upper()
    ]
    shared_processors: list[structlog.typing.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        redact_forbidden_keys,
    ]
    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )
    formatter = structlog.stdlib.ProcessorFormatter(
        # stdlib records (uvicorn, third parties): merge `extra=` first so it is redacted too.
        foreign_pre_chain=[structlog.stdlib.ExtraAdder(), _drop_uvicorn_noise, *shared_processors],
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            redact_forbidden_keys,
            structlog.processors.JSONRenderer(sort_keys=True),
        ],
    )
    handler = logging.StreamHandler(stream)
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(log_level)
    # uvicorn installs its own plain-text handlers before importing this module; route its
    # loggers through the JSON+redaction formatter above instead.
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True
    # uvicorn's access line would echo the raw request line (incl. query string);
    # the structlog middleware in app.py emits a body-free, query-free equivalent instead.
    logging.getLogger("uvicorn.access").disabled = True


configure_logging()
app = create_app()
