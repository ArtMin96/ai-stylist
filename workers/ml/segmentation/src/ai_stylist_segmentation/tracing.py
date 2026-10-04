"""Span hygiene and log/trace correlation (planning/14 §3; planning/11 §8). Pure code: `main.py`
builds the tracer provider and its resource, and wraps its OTLP exporter in
`SanitizingSpanExporter`.

Span attributes carry ids and enums only. The FastAPI/ASGI instrumentation records things our
rules forbid: the query string (`url.query`, or inside `http.url` under the old HTTP semantic
conventions; signed URLs carry credentials), the client IP and the user agent, and exception
messages and stack traces (in `exception` events and the span status). The instrumentation has no
option that removes them, so `SanitizingSpanExporter` hands the real exporter copies without them.

It mirrors apps/api/src/platform/telemetry/span-sanitizer.ts (`sanitizeAttributes`,
`sanitizeSpan`) and the resource step of telemetry.ts (`processResource`):

- one attribute rule, `sanitize_attributes`, for the attributes of the span, of every event and of
  every link, and for the process resource: drop `url.query`, network identity, the user agent and
  exception message and stack trace (plus their old HTTP semantic-convention names, which the
  Python instrumentation emits without OTEL_SEMCONV_STABILITY_OPT_IN=http); redact an attribute
  whose last dot-segment is a forbidden log word; keep `exception.type` only when it is name-shaped
  (`redaction.ERROR_NAME_SHAPE`) or code-shaped (`redaction.CODE_SHAPE`), else write `Error` (the
  shapes the API's error summary uses for a logged class name and code);
  cut every string of `url.full`, `url.path`, `http.url` and `http.target` (a string or a sequence
  of strings) at the first `?` or `#`;
- the span name is cut at the first `?` or `#` (`_strip_query`, the API's `stripQuery`);
- the status keeps its code and loses its description; the linked span context (trace id, span id,
  flags) of each link is kept;
- the resource is sanitized once, where `main.build_tracer_provider` builds it, not per span: the
  provider hands that one resource to every span, so the exporter passes it on unchanged.

Every event name is cut the same way as the span name (an event named from a raw URL carries its
query as a span name can). No span is dropped, no id or enum is changed. Not covered, as in the
API: the value under a key that is neither dropped, forbidden, `exception.type` nor a URL attribute
is not inspected. The Python instrumentation writes `exception.type` as the class's module and name
(`ValueError` for a builtin, `pkg.module.FooError` otherwise), so a class whose qualified name is
longer than 64 characters or contains `<locals>` is exported as `Error` too.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any, cast

from opentelemetry import trace
from opentelemetry.sdk.trace import Event, ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.semconv.attributes.client_attributes import CLIENT_ADDRESS
from opentelemetry.semconv.attributes.exception_attributes import (
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
    EXCEPTION_TYPE,
)
from opentelemetry.semconv.attributes.network_attributes import NETWORK_PEER_ADDRESS
from opentelemetry.semconv.attributes.url_attributes import URL_FULL, URL_PATH, URL_QUERY
from opentelemetry.semconv.attributes.user_agent_attributes import USER_AGENT_ORIGINAL
from opentelemetry.trace import Link, Status, format_span_id, format_trace_id
from opentelemetry.util.types import AttributeValue

from ai_stylist_segmentation.redaction import CODE_SHAPE, ERROR_NAME_SHAPE, is_forbidden_log_key

REDACTED = "[REDACTED]"

# Log keys added to every line inside an active span.
TRACE_ID_KEY = "trace_id"
SPAN_ID_KEY = "span_id"

# Dropped wherever `sanitize_attributes` applies: free text, network identity or error detail. The
# last four are the old HTTP semantic-convention names, emitted unless
# OTEL_SEMCONV_STABILITY_OPT_IN=http.
DROPPED_ATTRIBUTES: frozenset[str] = frozenset(
    {
        URL_QUERY,
        CLIENT_ADDRESS,
        NETWORK_PEER_ADDRESS,
        USER_AGENT_ORIGINAL,
        EXCEPTION_MESSAGE,
        EXCEPTION_STACKTRACE,
        "http.user_agent",
        "http.client_ip",
        "net.peer.ip",
        "net.sock.peer.addr",
    }
)

# URL-valued attributes kept without their query and fragment (old names included).
URL_ATTRIBUTES: frozenset[str] = frozenset({URL_FULL, URL_PATH, "http.url", "http.target"})


_QUERY_OR_FRAGMENT = re.compile(r"[?#]")


def _strip_query(url: str) -> str:
    """`url` without everything from its first `?` or `#`: a query string or a fragment can carry
    a signed-URL credential, a token or user input (`stripQuery` in the API's platform/logger.ts).
    """
    match = _QUERY_OR_FRAGMENT.search(url)
    return url if match is None else url[: match.start()]


def _cut_url_value(value: AttributeValue) -> AttributeValue:
    """A URL attribute's value without query and fragment, whatever its shape: `_strip_query` on
    the string, or on each string of a sequence. The value is cut, not dropped, so the path stays
    searchable; numbers and booleans carry no query and pass."""
    if isinstance(value, str):
        return _strip_query(value)
    if isinstance(value, list | tuple):
        cut = tuple(_strip_query(item) if isinstance(item, str) else item for item in value)
        # Each element keeps its type, so the tuple is still one of AttributeValue's sequences.
        return cast("AttributeValue", cut)
    return value


def _exception_type(value: AttributeValue) -> str:
    """`exception.type` kept only when it is a name-shaped or code-shaped string, else `Error`: the
    instrumentation writes the class's module and name, and a dynamically created class can carry
    any text as its name (the log rule of `redaction.type_name`)."""
    if not isinstance(value, str):
        return "Error"
    return value if ERROR_NAME_SHAPE.fullmatch(value) or CODE_SHAPE.fullmatch(value) else "Error"


def sanitize_attributes(
    attributes: Mapping[str, AttributeValue] | None,
) -> dict[str, AttributeValue]:
    """The attribute set a span, an event, a link or the process resource may carry. The log
    denylist applies to the last dot-segment of the key (`http.request.header.authorization` is
    redacted, `http.request.body.size` is kept)."""
    out: dict[str, AttributeValue] = {}
    for key, value in (attributes or {}).items():
        if key in DROPPED_ATTRIBUTES:
            continue
        if is_forbidden_log_key(key.rsplit(".", 1)[-1]):
            out[key] = REDACTED
        elif key == EXCEPTION_TYPE:
            out[key] = _exception_type(value)
        else:
            out[key] = _cut_url_value(value) if key in URL_ATTRIBUTES else value
    return out


def _sanitize_event(event: Event) -> Event:
    """An event named from a raw URL carries its query and fragment, as a span name can."""
    return Event(_strip_query(event.name), sanitize_attributes(event.attributes), event.timestamp)


def _sanitize_link(link: Link) -> Link:
    """The linked span's context (trace id, span id, flags) is kept; only the attributes change."""
    return Link(link.context, sanitize_attributes(link.attributes))


def sanitize_span(span: ReadableSpan) -> ReadableSpan:
    """A copy of `span` that satisfies the redaction rules; ids, times and kind unchanged. The
    status keeps its code; its description is free text (`ExceptionType: message`). The resource is
    passed on as it is: `main.build_tracer_provider` sanitized it when it built it."""
    return ReadableSpan(
        # A span named from a raw request target or URL carries its query and fragment.
        name=_strip_query(span.name),
        context=span.context,
        parent=span.parent,
        resource=span.resource,
        attributes=sanitize_attributes(span.attributes),
        events=tuple(_sanitize_event(event) for event in span.events),
        links=tuple(_sanitize_link(link) for link in span.links),
        kind=span.kind,
        status=Status(span.status.status_code),
        start_time=span.start_time,
        end_time=span.end_time,
        instrumentation_scope=span.instrumentation_scope,
    )


class SanitizingSpanExporter(SpanExporter):
    """Exports `sanitize_span` copies through `inner` (the OTLP exporter, or a test exporter)."""

    def __init__(self, inner: SpanExporter) -> None:
        self._inner = inner

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        return self._inner.export([sanitize_span(span) for span in spans])

    def shutdown(self) -> None:
        self._inner.shutdown()

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        return self._inner.force_flush(timeout_millis)


def add_trace_context(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """structlog processor: `trace_id` / `span_id` (W3C hex) on every line inside a recorded span,
    so a log line in Loki links to its trace in Tempo. Nothing outside a span or without tracing."""
    span_context = trace.get_current_span().get_span_context()
    if span_context.is_valid:
        event_dict.setdefault(TRACE_ID_KEY, format_trace_id(span_context.trace_id))
        event_dict.setdefault(SPAN_ID_KEY, format_span_id(span_context.span_id))
    return event_dict
