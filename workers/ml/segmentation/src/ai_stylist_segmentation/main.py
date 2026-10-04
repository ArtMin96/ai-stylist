"""Composition root (brief §5 `composition-root-only`): the only module that builds the
app and configures process-wide concerns (logging, tracing). Everything else is importable pure
code.

Run: `uvicorn ai_stylist_segmentation.main:app --port 8001` (see workers/README.md).
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import MutableMapping
from typing import IO, Any

import structlog
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.sdk.resources import OTELResourceDetector, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter
from opentelemetry.semconv.attributes.deployment_attributes import DEPLOYMENT_ENVIRONMENT_NAME
from opentelemetry.semconv.attributes.service_attributes import (
    SERVICE_NAME as ATTR_SERVICE_NAME,
)
from opentelemetry.semconv.attributes.service_attributes import SERVICE_VERSION
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.util.types import AttributeValue

from ai_stylist_segmentation import SERVICE_NAME, __version__
from ai_stylist_segmentation.app import create_app
from ai_stylist_segmentation.redaction import redact_forbidden_keys, summarize_exc_info
from ai_stylist_segmentation.tracing import (
    SanitizingSpanExporter,
    add_trace_context,
    sanitize_attributes,
)

# Empty or unset: tracing is off (no provider, no exporter, no network). Standard OTel semantics.
OTLP_ENDPOINT_ENV = "OTEL_EXPORTER_OTLP_ENDPOINT"
# The container health probe (every 30 s) is not traced.
TRACE_EXCLUDED_URLS = "/health$"


def _drop_uvicorn_noise(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """uvicorn attaches an ANSI-coloured duplicate of the message; keep the plain one."""
    event_dict.pop("color_message", None)
    return event_dict


def configure_logging(stream: IO[str] = sys.stdout, level: str | None = None) -> None:
    """JSON logs on `stream`, redaction applied to structlog *and* stdlib records.

    Lines carry `correlation_id` inside a request (`correlation.py`, via contextvars) and
    `trace_id` / `span_id` inside a recorded span (`tracing.add_trace_context`). A logged
    exception is its class, code and cause chain under `err` (`redaction.summarize_exc_info`),
    never its message or traceback. Logs stay on stdout only: the OpenTelemetry Python logs SDK is
    still in Development status.
    """
    # `LOG_LEVEL=` (set but empty, the `.env.example` default) means "unset": INFO.
    log_level = logging.getLevelNamesMapping()[
        (level or os.environ.get("LOG_LEVEL") or "INFO").upper()
    ]
    shared_processors: list[structlog.typing.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        add_trace_context,
        structlog.processors.StackInfoRenderer(),
        # Not `format_exc_info`: it writes the exception message and traceback into the line.
        summarize_exc_info,
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


def _env(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def build_tracer_provider(span_exporter: SpanExporter | None = None) -> TracerProvider | None:
    """The worker's tracer provider, or `None` when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty or
    unset: then nothing is built, so tests, CI and local runs without Grafana are unaffected.

    Spans pass through `SanitizingSpanExporter` to the OTLP/HTTP protobuf exporter, which reads
    `OTEL_EXPORTER_OTLP_ENDPOINT` (or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) and
    `OTEL_EXPORTER_OTLP_HEADERS` itself; the batch processor follows `OTEL_BSP_*`. The provider
    registers an `atexit` hook (`shutdown_on_exit`), so a graceful stop flushes pending spans.
    `span_exporter` replaces the OTLP exporter and starts without an endpoint (tests only).

    The resource is sanitized here, once, as the API's `processResource` does: an operator-set
    `OTEL_RESOURCE_ATTRIBUTES` can carry a credential or a URL with a query, and the exporter
    passes the provider's resource on unchanged.
    """
    if span_exporter is None and _env(OTLP_ENDPOINT_ENV) is None:
        return None
    attributes: dict[str, AttributeValue] = {
        ATTR_SERVICE_NAME: SERVICE_NAME,
        # The release (`APP_VERSION`, as the API reports) when set, else the package version.
        SERVICE_VERSION: _env("APP_VERSION") or __version__,
    }
    environment = _env("APP_ENV")
    if environment is not None:
        attributes[DEPLOYMENT_ENVIRONMENT_NAME] = environment
    # `Resource.create` lets explicit attributes override the environment; merging the env
    # detector last restores the standard precedence: OTEL_SERVICE_NAME and
    # OTEL_RESOURCE_ATTRIBUTES win. No host or process detector runs.
    merged = Resource.create(attributes).merge(OTELResourceDetector().detect())
    # The span attribute rule on the merged attributes. The plain constructor runs no detector
    # (unlike `Resource.create`), so nothing merges an unsanitized value back in; none of the
    # sources sets a schema URL, so none is carried over.
    resource = Resource(sanitize_attributes(merged.attributes))
    exporter = OTLPSpanExporter() if span_exporter is None else span_exporter
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(SanitizingSpanExporter(exporter)))
    return provider


def instrument_fastapi(app: FastAPI, tracer_provider: TracerProvider) -> None:
    """One SERVER span per request (except `/health`), continuing the caller's W3C `traceparent`
    (the jobs process's fetch span); no per-message `receive` / `send` spans (volume)."""
    # Stable HTTP semantic conventions (`http.request.method`, `url.path`,
    # `http.response.status_code`), the names the API's spans carry. An operator value wins.
    os.environ.setdefault("OTEL_SEMCONV_STABILITY_OPT_IN", "http")
    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=tracer_provider,
        excluded_urls=TRACE_EXCLUDED_URLS,
        exclude_spans=["receive", "send"],
    )


def configure_tracing(app: FastAPI) -> TracerProvider | None:
    """Start tracing for `app` when an OTLP endpoint is configured; `None` (nothing) otherwise."""
    provider = build_tracer_provider()
    if provider is None:
        return None
    # W3C `traceparent` only, as the API: a caller's `baggage` is not propagated.
    set_global_textmap(TraceContextTextMapPropagator())
    trace.set_tracer_provider(provider)
    instrument_fastapi(app, provider)
    return provider


configure_logging()
app = create_app()
tracer_provider = configure_tracing(app)
