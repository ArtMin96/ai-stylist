from __future__ import annotations

import io
import logging
import os
from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# Hermetic telemetry: a developer shell (direnv, `.env`) may carry a real OTLP endpoint, headers or
# service name. Drop every OTEL_* key before `ai_stylist_segmentation.main` is imported, so no test
# exports to a real backend and the resource tests see the defaults. Tests set what they need.
for _key in [key for key in os.environ if key.startswith("OTEL_")]:
    del os.environ[_key]

from ai_stylist_segmentation.app import create_app  # noqa: E402
from ai_stylist_segmentation.main import configure_logging  # noqa: E402

# The test client's own request lines (httpx logs each URL at INFO) are caller output, not the
# worker's; keep them out of the captured worker log stream. httpx is a dev-only dependency.
logging.getLogger("httpx").setLevel(logging.WARNING)


@pytest.fixture(scope="module")
def app() -> FastAPI:
    return create_app()


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
def log_stream() -> Iterator[io.StringIO]:
    """Every JSON log line of the test (DEBUG and up); process defaults restored afterwards."""
    stream = io.StringIO()
    configure_logging(stream=stream, level="DEBUG")
    yield stream
    configure_logging()
