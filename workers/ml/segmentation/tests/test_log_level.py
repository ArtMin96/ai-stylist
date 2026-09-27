"""Regression (AI-17): `LOG_LEVEL` set but empty (`LOG_LEVEL=` is the `.env.example` default) falls
back to INFO. It used to raise `KeyError: ''` inside `configure_logging()`, which `main.py` runs
at import time, so the service could not start and test collection crashed."""

from __future__ import annotations

import io
import json
import logging
from collections.abc import Iterator

import pytest
import structlog

from ai_stylist_segmentation.main import configure_logging


@pytest.fixture
def log_stream(monkeypatch: pytest.MonkeyPatch) -> Iterator[io.StringIO]:
    monkeypatch.setenv("LOG_LEVEL", "")
    stream = io.StringIO()
    configure_logging(stream=stream)
    yield stream
    configure_logging(level="INFO")  # restore process defaults for later tests


def test_empty_log_level_falls_back_to_info(log_stream: io.StringIO) -> None:
    structlog.get_logger("level").debug("hidden")
    structlog.get_logger("level").info("shown")

    assert logging.getLogger().level == logging.INFO
    records = [json.loads(line) for line in log_stream.getvalue().splitlines()]
    assert [record["event"] for record in records] == ["shown"]
