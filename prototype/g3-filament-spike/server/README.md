# G3 spike — glue server (Agent C)

FastAPI glue between the viewer and the pipeline CLI. Never imports the pipeline; runs
`pipeline/.venv/bin/python -m g3 ...` as a subprocess. Endpoints per `../CONTRACT.md`.

```sh
cd server
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python fastapi uvicorn python-multipart
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8787
```

Env overrides (all optional): `PIPELINE_PY`, `HUMAN_GLB`, `OUT_DIR`.

Notes beyond the contract: garment `id` is the `out/garments/<uuid>/` directory name (the server
overrides the `id` field from `garment.json`); `POST /api/dress` returns 400 on an empty id list and
404 on an unknown id, and reports the effective (per-slot, sorted) ids in `garmentIds`.
