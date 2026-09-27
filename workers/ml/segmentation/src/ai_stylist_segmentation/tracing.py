"""Span hygiene and log/trace correlation (planning/14 §3; planning/11 §8). Pure code: `main.py`
builds the tracer provider and wraps its OTLP exporter in `SanitizingSpanExporter`.

Span attributes carry ids and enums only. The FastAPI/ASGI instrumentation records things our
rules forbid: the query string (`url.query`, or inside `http.url` under the old HTTP semantic
conventions; signed URLs carry credentials), the client IP and the user agent, and exception
messages and stack traces (in `exception` events and the span status). The instrumentation has no
option that removes them, so `SanitizingSpanExporter` hands the real exporter copies without them.
It mirrors `SanitizingSpanExporter` in apps/api/src/platform/telemetry/span-sanitizer.ts: no span
is dropped, no id or enum is changed.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from opentelemetry import trace
from opentelemetry.sdk.trace import Event, ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.semconv.attributes.client_attributes import CLIENT_ADDRESS
from opentelemetry.semconv.attributes.exception_attributes import (
    EXCEPTION_MESSAGE,
    EXCEPTION_STACKTRACE,
)
from opentelemetry.semconv.attributes.network_attributes import NETWORK_PEER_ADDRESS
from opentelemetry.semconv.attributes.url_attributes import URL_FULL, URL_PATH, URL_QUERY
from opentelemetry.semconv.attributes.user_agent_attributes import USER_AGENT_ORIGINAL
from opentelemetry.trace import Status, format_span_id, format_trace_id
from opentelemetry.util.types import AttributeValue

from ai_stylist_segmentation.redaction import is_forbidden_log_key

REDACTED = "[REDACTED]"

# Log keys added to every line inside an active span.
TRACE_ID_KEY = "trace_id"
SPAN_ID_KEY = "span_id"

# Dropped from every span and event: free text, network identity or error detail. The last four
# are the old HTTP semantic-convention names, emitted unless OTEL_SEMCONV_STABILITY_OPT_IN=http.
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


def _strip_query(value: AttributeValue) -> AttributeValue:
    if not isinstance(value, str):
        return value
    match = _QUERY_OR_FRAGMENT.search(value)
    return value if match is None else value[: match.start()]


def sanitize_attributes(
    attributes: Mapping[str, AttributeValue] | None,
) -> dict[str, AttributeValue]:
    """The attributes a span may carry. The log denylist applies to the last dot-segment of the key
    (`http.request.header.authorization` is redacted, `http.request.body.size` is kept)."""
    out: dict[str, AttributeValue] = {}
    for key, value in (attributes or {}).items():
        if key in DROPPED_ATTRIBUTES:
            continue
        if is_forbidden_log_key(key.rsplit(".", 1)[-1]):
            out[key] = REDACTED
        else:
            out[key] = _strip_query(value) if key in URL_ATTRIBUTES else value
    return out


def _sanitize_event(event: Event) -> Event:
    return Event(event.name, sanitize_attributes(event.attributes), event.timestamp)


def sanitize_span(span: ReadableSpan) -> ReadableSpan:
    """A copy of `span` that satisfies the redaction rules; ids, times, kind and links unchanged.
    The status keeps its code; its description is free text (`ExceptionType: message`)."""
    return ReadableSpan(
        name=span.name,
        context=span.context,
        parent=span.parent,
        resource=span.resource,
        attributes=sanitize_attributes(span.attributes),
        events=tuple(_sanitize_event(event) for event in span.events),
        links=span.links,
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
