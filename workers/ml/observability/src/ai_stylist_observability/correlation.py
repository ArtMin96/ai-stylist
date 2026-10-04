"""Correlation id (planning/14 §2): one id per logical operation, carried API → outbox envelope
(`correlationId`) → pg-boss job → this worker as the `x-correlation-id` request header. It is our
own metadata, never user data. Mirrors `apps/api/src/platform/telemetry/correlation.ts`.

`correlation_id_middleware` (registered by each service's app factory) accepts the caller's id
when valid, else mints one; binds it as `correlation_id` in structlog's context variables for the
request (so every log line of the request carries it), sets it on the active span, and echoes the
header.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import Request, Response
from opentelemetry import trace

# Request and response header.
CORRELATION_ID_HEADER = "x-correlation-id"
# Log key and span attribute name.
CORRELATION_ID_KEY = "correlation_id"
# An accepted caller id: 1-128 characters of `[A-Za-z0-9._:-]` (a UUID, ULID or `corr-...`).
# Same pattern as `CORRELATION_ID_PATTERN` in apps/api/src/platform/telemetry/correlation.ts;
# change both together. `fullmatch` keeps JavaScript's `$` semantics (no trailing newline).
CORRELATION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def is_valid_correlation_id(value: str | None) -> bool:
    return value is not None and CORRELATION_ID_PATTERN.fullmatch(value) is not None


def mint_correlation_id() -> str:
    """A fresh id for a request that arrived without a valid one (a UUID, as the API mints)."""
    return str(uuid.uuid4())


def correlation_id_from_header(values: list[str]) -> str:
    """The caller's id when exactly one valid header was sent, else a minted one. Never raises."""
    if len(values) == 1 and is_valid_correlation_id(values[0]):
        return values[0]
    return mint_correlation_id()


async def correlation_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Read or mint the id; log, trace and echo it for this request."""
    correlation_id = correlation_id_from_header(request.headers.getlist(CORRELATION_ID_HEADER))
    # The FastAPI instrumentation's server span when tracing runs; a no-op span otherwise.
    trace.get_current_span().set_attribute(CORRELATION_ID_KEY, correlation_id)
    with structlog.contextvars.bound_contextvars(**{CORRELATION_ID_KEY: correlation_id}):
        response = await call_next(request)
    response.headers[CORRELATION_ID_HEADER] = correlation_id
    return response
