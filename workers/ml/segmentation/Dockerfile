# syntax=docker/dockerfile:1.7
# AI Stylist — segmentation worker. Build from the workspace root so the shared lockfile
# and the generated-models member are in context:
#   docker build -f workers/ml/segmentation/Dockerfile workers
ARG PYTHON_VERSION=3.12
ARG UV_VERSION=0.12.10

# ---------- builder: resolve + install into /app/.venv (no dev tooling) -------------------
FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv
FROM python:${PYTHON_VERSION}-slim AS builder
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_NO_DEV=1
WORKDIR /app

# Layer 1: third-party deps only (cache survives source edits).
COPY pyproject.toml uv.lock ./
COPY ml/generated/pyproject.toml ml/generated/
COPY ml/segmentation/pyproject.toml ml/segmentation/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-workspace --package ai-stylist-segmentation

# Layer 2: workspace sources, installed non-editable so the venv is self-contained.
COPY ml/generated ml/generated
COPY ml/segmentation ml/segmentation
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-editable --package ai-stylist-segmentation

# ---------- runtime: slim image, non-root, venv only ---------------------------------------
FROM python:${PYTHON_VERSION}-slim AS runtime
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home --shell /usr/sbin/nologin app
COPY --from=builder --chown=app:app /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LOG_LEVEL=INFO
USER app
WORKDIR /app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"]
CMD ["uvicorn", "ai_stylist_segmentation.main:app", "--host", "0.0.0.0", "--port", "8000"]
