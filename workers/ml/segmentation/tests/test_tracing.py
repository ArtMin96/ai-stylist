"""Tracing (planning/14 §3): the worker continues the caller's trace, spans carry ids and enums
only, logs link to spans, and nothing starts without an OTLP endpoint."""

from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import threading
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
import structlog
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import SpanKind, StatusCode

from ai_stylist_segmentation import __version__, main
from ai_stylist_segmentation.app import create_app
from ai_stylist_segmentation.main import build_tracer_provider, instrument_fastapi
from ai_stylist_segmentation.tracing import REDACTED, sanitize_attributes

MARKER = "CANARY-5d2e81"
PAYLOAD = {"request_id": "req_1", "image_ref": "media/u1/garment.jpg"}
CALLER_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
CALLER_SPAN_ID = "00f067aa0ba902b7"
TRACEPARENT = f"00-{CALLER_TRACE_ID}-{CALLER_SPAN_ID}-01"
# Never exported: free text, network identity, error detail (new and old HTTP semconv names).
FORBIDDEN_SPAN_ATTRIBUTES = {
    "url.query",
    "client.address",
    "network.peer.address",
    "user_agent.original",
    "http.user_agent",
    "net.peer.ip",
    "exception.message",
    "exception.stacktrace",
}


@dataclass
class Traced:
    app: FastAPI
    exporter: InMemorySpanExporter
    provider: TracerProvider

    def spans(self) -> tuple[ReadableSpan, ...]:
        self.provider.force_flush()
        return self.exporter.get_finished_spans()


@pytest.fixture
def traced(monkeypatch: pytest.MonkeyPatch) -> Iterator[Traced]:
    monkeypatch.setenv("OTEL_SEMCONV_STABILITY_OPT_IN", "http")
    monkeypatch.setenv("APP_ENV", "test")
    exporter = InMemorySpanExporter()
    provider = build_tracer_provider(span_exporter=exporter)
    assert provider is not None
    app = create_app()
    instrument_fastapi(app, provider)
    yield Traced(app=app, exporter=exporter, provider=provider)
    FastAPIInstrumentor.uninstrument_app(app)
    provider.shutdown()


@asynccontextmanager
async def _client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://worker") as client:
        yield client


def _values(span: ReadableSpan) -> str:
    events = [dict(event.attributes or {}) for event in span.events]
    return json.dumps([dict(span.attributes or {}), events, span.status.description], default=str)


# --- off by default --------------------------------------------------------------------------


@pytest.mark.parametrize("endpoint", [None, "", "   "], ids=["unset", "empty", "blank"])
def test_no_endpoint_builds_no_provider(
    monkeypatch: pytest.MonkeyPatch, endpoint: str | None
) -> None:
    if endpoint is None:
        monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    else:
        monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint)

    assert build_tracer_provider() is None


def test_importing_the_composition_root_starts_no_tracing() -> None:
    assert main.tracer_provider is None
    assert not isinstance(trace.get_tracer_provider(), TracerProvider)


# --- resource --------------------------------------------------------------------------------


def test_resource_names_the_service_version_and_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("APP_VERSION", "2026.09.1")
    provider = build_tracer_provider(span_exporter=InMemorySpanExporter())
    assert provider is not None

    attributes = provider.resource.attributes
    provider.shutdown()

    assert attributes["service.name"] == "segmentation"
    assert attributes["service.version"] == "2026.09.1"
    assert attributes["deployment.environment.name"] == "staging"
    assert not any(key.startswith(("host.", "process.")) for key in attributes)


def test_resource_without_app_env_or_version(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "")
    monkeypatch.delenv("APP_VERSION", raising=False)
    provider = build_tracer_provider(span_exporter=InMemorySpanExporter())
    assert provider is not None

    attributes = provider.resource.attributes
    provider.shutdown()

    assert attributes["service.version"] == __version__
    assert "deployment.environment.name" not in attributes


def test_otel_environment_variables_win(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("OTEL_SERVICE_NAME", "svc-override")
    monkeypatch.setenv("OTEL_RESOURCE_ATTRIBUTES", "deployment.environment.name=from-env")
    provider = build_tracer_provider(span_exporter=InMemorySpanExporter())
    assert provider is not None

    attributes = provider.resource.attributes
    provider.shutdown()

    assert attributes["service.name"] == "svc-override"
    assert attributes["deployment.environment.name"] == "from-env"


# --- spans -----------------------------------------------------------------------------------


async def test_request_span_continues_the_callers_trace(traced: Traced) -> None:
    async with _client(traced.app) as client:
        response = await client.post(
            f"/v1/segment?token={MARKER}",
            json=PAYLOAD,
            headers={
                "traceparent": TRACEPARENT,
                "x-correlation-id": "corr-trace-1",
                "user-agent": f"agent {MARKER}",
            },
        )

    assert response.status_code == 200
    (span,) = traced.spans()  # no per-message receive/send spans
    assert span.kind is SpanKind.SERVER
    assert span.name == "POST /v1/segment"
    assert span.context is not None
    assert span.parent is not None
    assert trace.format_trace_id(span.context.trace_id) == CALLER_TRACE_ID
    assert trace.format_span_id(span.parent.span_id) == CALLER_SPAN_ID
    attributes = dict(span.attributes or {})
    assert attributes["correlation_id"] == "corr-trace-1"
    assert attributes["http.route"] == "/v1/segment"
    assert attributes["http.request.method"] == "POST"
    assert attributes["http.response.status_code"] == 200
    assert attributes["url.path"] == "/v1/segment"
    assert FORBIDDEN_SPAN_ATTRIBUTES.isdisjoint(attributes)
    assert MARKER not in _values(span)
    assert span.resource.attributes["service.name"] == "segmentation"
    assert span.resource.attributes["deployment.environment.name"] == "test"


async def test_request_log_line_carries_the_span_ids(
    traced: Traced, log_stream: io.StringIO
) -> None:
    async with _client(traced.app) as client:
        await client.post("/v1/segment", json=PAYLOAD, headers={"traceparent": TRACEPARENT})

    (span,) = traced.spans()
    records = [json.loads(line) for line in log_stream.getvalue().splitlines()]
    # Only the access line: other DEBUG lines (asyncio's selector) are platform-dependent.
    (record,) = [record for record in records if record["event"] == "http.request"]
    assert span.context is not None
    assert record["event"] == "http.request"
    assert record["trace_id"] == CALLER_TRACE_ID
    assert record["span_id"] == trace.format_span_id(span.context.span_id)
    assert record["correlation_id"] == dict(span.attributes or {})["correlation_id"]


def test_log_lines_outside_a_span_carry_no_trace_ids(log_stream: io.StringIO) -> None:
    structlog.get_logger("test").info("outside")

    records = [json.loads(line) for line in log_stream.getvalue().splitlines()]
    (record,) = [record for record in records if record["event"] == "outside"]
    assert "trace_id" not in record
    assert "span_id" not in record


async def test_health_probe_is_not_traced(traced: Traced) -> None:
    async with _client(traced.app) as client:
        assert (await client.get("/health")).status_code == 200

    assert traced.spans() == ()


async def test_exception_keeps_only_its_type(traced: Traced) -> None:
    async def boom() -> None:
        raise ValueError(f"failed for {MARKER}")

    traced.app.add_api_route("/boom", boom, methods=["GET"])
    async with _client(traced.app) as client:
        assert (await client.get("/boom")).status_code == 500

    (span,) = traced.spans()
    assert span.status.status_code is StatusCode.ERROR
    assert span.status.description is None
    exception_events = [event for event in span.events if event.name == "exception"]
    assert exception_events
    for event in exception_events:
        assert dict(event.attributes or {}).get("exception.type") == "ValueError"
    assert MARKER not in _values(span)
    assert FORBIDDEN_SPAN_ATTRIBUTES.isdisjoint(
        key for event in span.events for key in (event.attributes or {})
    )


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


# --- the real process: composition root, env config, OTLP/HTTP, flush at exit ----------------


class _OtlpReceiver:
    """A stub OTLP/HTTP collector on 127.0.0.1: records each POST (path, headers, body)."""

    def __init__(self) -> None:
        self.requests: list[tuple[str, dict[str, str], bytes]] = []
        received = self.requests

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                body = self.rfile.read(int(self.headers.get("content-length", "0")))
                headers = {key.lower(): value for key, value in self.headers.items()}
                received.append((self.path, headers, body))
                self.send_response(200)
                self.send_header("content-type", "application/x-protobuf")
                self.send_header("content-length", "0")
                self.end_headers()

            def log_message(self, format: str, *args: object) -> None:
                del format, args  # keep the test output clean

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        self._thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self) -> _OtlpReceiver:
        self._thread.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self.server.shutdown()
        self.server.server_close()
        self._thread.join()


# Runs in the child: the uvicorn target module, two requests, then a normal exit (atexit flush).
CHILD = f"""
import asyncio, httpx, logging
from ai_stylist_segmentation.main import app

logging.getLogger("httpx").setLevel(logging.WARNING)  # the caller's request lines, not the worker's

async def run():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://worker") as client:
        await client.get("/health")
        await client.post(
            "/v1/segment?token={MARKER}",
            json={json.dumps(PAYLOAD)},
            headers={{"traceparent": "{TRACEPARENT}", "x-correlation-id": "corr-child-1",
                     "authorization": "Bearer {MARKER}"}},
        )

asyncio.run(run())
"""


def test_the_process_exports_sanitized_spans_over_otlp_and_flushes_at_exit() -> None:
    with _OtlpReceiver() as receiver:
        env = {
            **os.environ,
            "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
            "OTEL_EXPORTER_OTLP_HEADERS": "x-otlp-test=stub",
            "APP_ENV": "test",
            "LOG_LEVEL": "INFO",
        }
        child = subprocess.run(  # noqa: S603 (fixed argv: this interpreter + a constant script)
            [sys.executable, "-c", CHILD],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )

    assert child.returncode == 0, child.stderr
    assert MARKER not in child.stdout + child.stderr
    (path, headers, _body), *_ = receiver.requests
    assert path == "/v1/traces"
    assert headers["content-type"] == "application/x-protobuf"
    assert headers["x-otlp-test"] == "stub"
    assert all(MARKER.encode() not in request[2] for request in receiver.requests)

    exported = ExportTraceServiceRequest()
    for request in receiver.requests:
        exported.MergeFromString(request[2])
    (resource_spans,) = exported.resource_spans
    resource = {kv.key: kv.value.string_value for kv in resource_spans.resource.attributes}
    assert resource["service.name"] == "segmentation"
    assert resource["deployment.environment.name"] == "test"
    spans = [span for scope in resource_spans.scope_spans for span in scope.spans]
    assert [span.name for span in spans] == ["POST /v1/segment"]  # /health is not traced
    (span,) = spans
    assert span.trace_id.hex() == CALLER_TRACE_ID
    assert span.parent_span_id.hex() == CALLER_SPAN_ID
    span_attributes = {kv.key: kv.value for kv in span.attributes}
    assert span_attributes["correlation_id"].string_value == "corr-child-1"
    assert FORBIDDEN_SPAN_ATTRIBUTES.isdisjoint(span_attributes)

    access_lines = [
        json.loads(line) for line in child.stdout.splitlines() if '"http.request"' in line
    ]
    assert [line["path"] for line in access_lines] == ["/health", "/v1/segment"]
    segment_line = access_lines[1]
    assert segment_line["correlation_id"] == "corr-child-1"
    assert segment_line["trace_id"] == CALLER_TRACE_ID
    assert segment_line["span_id"] == span.span_id.hex()
    assert "trace_id" not in access_lines[0]  # the untraced health probe
