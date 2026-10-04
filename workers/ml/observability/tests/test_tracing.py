"""Span hygiene (planning/14 §3, planning/11 §8), unit level: the attribute rule, the exporter
wrapper on spans, events and links, and the `trace_id` / `span_id` log processor. The spans come
from a plain SDK provider with `SanitizingSpanExporter` in front of an in-memory exporter; each
service's `tests/test_tracing.py` covers its own provider, resource and request spans."""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass

import pytest
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Link, SpanContext, TraceFlags, format_span_id, format_trace_id
from opentelemetry.util.types import AttributeValue

from ai_stylist_generated.kernel import (
    CODE_SHAPE,
    ERROR_NAME_SHAPE,
    EXCEPTION_TYPE_KEPT,
    EXCEPTION_TYPE_REPLACED,
)
from ai_stylist_observability.tracing import (
    REDACTED,
    SPAN_ID_KEY,
    TRACE_ID_KEY,
    SanitizingSpanExporter,
    add_trace_context,
    sanitize_attributes,
)

MARKER = "CANARY-5d2e81"
LINKED_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
LINKED_SPAN_ID = "00f067aa0ba902b7"
# Span names the tests and dashboards find spans by: none has a query or a fragment to cut.
KEPT_SPAN_NAMES = ["POST /v1/segment", "GET", "job.process demo.outbox-flow"]


@dataclass
class Exported:
    provider: TracerProvider
    exporter: InMemorySpanExporter

    def spans(self) -> tuple[ReadableSpan, ...]:
        return self.exporter.get_finished_spans()


@pytest.fixture
def exported() -> Iterator[Exported]:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(SanitizingSpanExporter(exporter)))
    yield Exported(provider=provider, exporter=exporter)
    provider.shutdown()


def _values(span: ReadableSpan) -> str:
    events = [dict(event.attributes or {}) for event in span.events]
    return json.dumps([dict(span.attributes or {}), events, span.status.description], default=str)


# --- the attribute rule ------------------------------------------------------------------------


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


def test_sanitize_attributes_covers_old_and_new_http_names() -> None:
    attributes = {
        "http.url": f"http://worker:8000/v1/segment?token={MARKER}#part",
        "http.target": f"/v1/segment?token={MARKER}",
        "url.full": f"http://worker:8000/v1/segment#{MARKER}",
        "url.path": "/v1/segment",
        "url.query": f"token={MARKER}",
        "client.address": "10.0.0.7",
        "network.peer.address": "10.0.0.7",
        "net.peer.ip": "10.0.0.7",
        "http.client_ip": "10.0.0.7",
        "user_agent.original": MARKER,
        "http.user_agent": MARKER,
        "exception.message": MARKER,
        "exception.stacktrace": MARKER,
        "exception.type": "ValueError",
        "http.request.header.authorization": (f"Bearer {MARKER}",),
        "app.userEmail": MARKER,
        "http.request.body.size": 12,
        "correlation_id": "corr-1",
    }

    assert sanitize_attributes(attributes) == {
        "http.url": "http://worker:8000/v1/segment",
        "http.target": "/v1/segment",
        "url.full": "http://worker:8000/v1/segment",
        "url.path": "/v1/segment",
        "exception.type": "ValueError",
        "http.request.header.authorization": REDACTED,
        "app.userEmail": REDACTED,
        "http.request.body.size": 12,
        "correlation_id": "corr-1",
    }


@pytest.mark.parametrize(
    ("value", "kept"),
    [
        ("ValueError", "ValueError"),
        ("grpc.ServiceError", "grpc.ServiceError"),
        ("$Proxy_1", "$Proxy_1"),
        ("E" * 64, "E" * 64),
        ("23505", "23505"),
        ("ECONNREFUSED", "ECONNREFUSED"),
        (f"Leaky {MARKER}", "Error"),
        ("E" * 65, "Error"),
        ("1" * 33, "Error"),
        ("", "Error"),
        (42, "Error"),
        ((MARKER,), "Error"),
    ],
    ids=[
        "name",
        "dotted-name",
        "dollar-name",
        "longest-name",
        "sqlstate",
        "system-code",
        "free-text",
        "too-long-name",
        "too-long-code",
        "empty",
        "number",
        "sequence",
    ],
)
def test_exception_type_is_kept_only_when_name_or_code_shaped(
    value: AttributeValue, kept: str
) -> None:
    assert sanitize_attributes({"exception.type": value}) == {"exception.type": kept}


def test_every_string_of_a_sequence_valued_url_attribute_is_cut() -> None:
    attributes: dict[str, AttributeValue] = {
        "url.full": (f"https://a.example/x?sig={MARKER}", f"https://b.example/y#{MARKER}"),
        "http.target": [f"/v1/items?token={MARKER}", "/v1/plain"],
        "http.url": ("https://worker:8000/v1/segment",),
    }

    assert sanitize_attributes(attributes) == {
        "url.full": ("https://a.example/x", "https://b.example/y"),
        "http.target": ("/v1/items", "/v1/plain"),
        "http.url": ("https://worker:8000/v1/segment",),
    }


# --- the exporter wrapper ----------------------------------------------------------------------


def test_a_free_text_exception_class_is_exported_as_error(exported: Exported) -> None:
    leaky_class = type(f"Leaky {MARKER}", (ValueError,), {})
    span = exported.provider.get_tracer("test").start_span("failing")
    span.record_exception(leaky_class("x"))
    span.end()

    (out,) = exported.spans()
    assert [dict(event.attributes or {}).get("exception.type") for event in out.events] == ["Error"]
    assert MARKER not in _values(out)


def test_sequence_valued_url_attributes_are_cut_through_the_pipeline(exported: Exported) -> None:
    span = exported.provider.get_tracer("test").start_span(
        "urls",
        attributes={
            "url.full": [f"https://a.example/x?sig={MARKER}", f"https://b.example/y#{MARKER}"],
            "http.target": [f"/v1/items?token={MARKER}"],
        },
    )
    span.end()

    (out,) = exported.spans()
    assert dict(out.attributes or {}) == {
        "url.full": ("https://a.example/x", "https://b.example/y"),
        "http.target": ("/v1/items",),
    }


def test_span_name_loses_its_query_and_fragment(exported: Exported) -> None:
    tracer = exported.provider.get_tracer("test")
    tracer.start_span(f"GET /v1/segment?token={MARKER}#{MARKER}").end()
    for name in KEPT_SPAN_NAMES:
        tracer.start_span(name).end()

    assert [span.name for span in exported.spans()] == ["GET /v1/segment", *KEPT_SPAN_NAMES]


def test_event_name_and_attributes_are_sanitized(exported: Exported) -> None:
    span = exported.provider.get_tracer("test").start_span("evented")
    span.add_event(
        f"redirect /v1/items?token={MARKER}#{MARKER}",
        {
            "url.full": f"https://storage.example/object?X-Amz-Signature={MARKER}",
            "url.query": f"token={MARKER}",
            "http.request.header.cookie": (MARKER,),
            "messaging.message.id": "job-1",
        },
    )
    span.add_event("job.retried", {"job.attempt": 2})
    span.end()

    (out,) = exported.spans()
    assert [(event.name, dict(event.attributes or {})) for event in out.events] == [
        (
            "redirect /v1/items",
            {
                "url.full": "https://storage.example/object",
                "http.request.header.cookie": REDACTED,
                "messaging.message.id": "job-1",
            },
        ),
        ("job.retried", {"job.attempt": 2}),
    ]


def test_link_attributes_are_sanitized_and_the_linked_ids_kept(exported: Exported) -> None:
    linked = SpanContext(
        trace_id=int(LINKED_TRACE_ID, 16),
        span_id=int(LINKED_SPAN_ID, 16),
        is_remote=True,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
    )
    span = exported.provider.get_tracer("test").start_span(
        "linked",
        links=[
            Link(
                linked,
                {
                    "url.full": f"https://storage.example/object?X-Amz-Signature={MARKER}",
                    "url.query": f"token={MARKER}",
                    "http.request.header.cookie": (MARKER,),
                    "messaging.message.id": "job-1",
                },
            ),
            Link(linked),
        ],
    )
    span.end()

    (out,) = exported.spans()
    assert [(link.context, dict(link.attributes or {})) for link in out.links] == [
        (
            linked,
            {
                "url.full": "https://storage.example/object",
                "http.request.header.cookie": REDACTED,
                "messaging.message.id": "job-1",
            },
        ),
        (linked, {}),
    ]


# --- the log processor -------------------------------------------------------------------------


def test_add_trace_context_writes_the_ids_of_the_current_span(exported: Exported) -> None:
    with exported.provider.get_tracer("test").start_as_current_span("current") as span:
        event = add_trace_context(None, "info", {"event": "inside"})

    context = span.get_span_context()
    assert event == {
        "event": "inside",
        TRACE_ID_KEY: format_trace_id(context.trace_id),
        SPAN_ID_KEY: format_span_id(context.span_id),
    }


def test_add_trace_context_adds_nothing_outside_a_span() -> None:
    assert add_trace_context(None, "info", {"event": "outside"}) == {"event": "outside"}
