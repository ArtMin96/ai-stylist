"""FastAPI application factory (doc 04 §6: "FastAPI app factory; settings from env")."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, Request, Response

from ai_stylist_segmentation import SERVICE_NAME, __version__
from ai_stylist_segmentation.routes import router

log = structlog.get_logger(SERVICE_NAME)


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Stylist — segmentation worker",
        version=__version__,
        docs_url=None,
        redoc_url=None,
    )
    app.include_router(router)
    app.middleware("http")(_access_log)
    return app


async def _access_log(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Structured access line with *no* body, headers, or query string (brief §6)."""
    started = time.perf_counter()
    response = await call_next(request)
    log.info(
        "http.request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round((time.perf_counter() - started) * 1000, 2),
    )
    return response
