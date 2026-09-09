from __future__ import annotations

from httpx import AsyncClient

from ai_stylist_segmentation import __version__


async def test_health_reports_service_and_version(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "segmentation", "version": __version__}
    assert __version__ != "0.0.0+unknown", "package metadata must be installed (uv sync)"


async def test_docs_are_disabled(client: AsyncClient) -> None:
    assert (await client.get("/docs")).status_code == 404
    assert (await client.get("/openapi.json")).status_code == 200
