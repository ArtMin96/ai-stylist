"""Observability shared by every AI Stylist worker service (planning/11 §8, planning/14 §2-3).

- `redaction`: the structlog processors that drop forbidden log keys and reduce a logged exception
  to `{type, code?, cause?}`.
- `tracing`: the span attribute rule, `SanitizingSpanExporter` and the `trace_id` / `span_id` log
  processor.
- `correlation`: the `x-correlation-id` middleware.

Pure code. A service's `main.py` (its composition root) wires the processors into logging and the
exporter into tracing; its app factory registers the middleware.
"""
