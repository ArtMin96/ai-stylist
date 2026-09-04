"""FastAPI glue for the G3 spike: upload image -> run pipeline CLI -> serve GLBs.

Never imports the pipeline; calls it as a subprocess (CONTRACT.md "Pipeline CLI").
Run: .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8787
"""
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

SPIKE = Path(__file__).resolve().parent.parent
PIPELINE_DIR = SPIKE / "pipeline"
PIPELINE_PY = os.environ.get("PIPELINE_PY", str(PIPELINE_DIR / ".venv/bin/python"))
HUMAN_GLB = Path(os.environ.get("HUMAN_GLB", SPIKE / "assets/human.glb"))
OUT_DIR = Path(os.environ.get("OUT_DIR", SPIKE / "out"))
GARMENTS_DIR = OUT_DIR / "garments"
DRESSED_DIR = OUT_DIR / "dressed"
CATEGORIES = {"tshirt", "pants"}
SLOT_ORDER = {"bottom": 0, "top": 1}

# StaticFiles checks the directory exists at mount time, so create it at import.
GARMENTS_DIR.mkdir(parents=True, exist_ok=True)
DRESSED_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    shutil.copyfile(HUMAN_GLB, OUT_DIR / "human.glb")
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/files", StaticFiles(directory=OUT_DIR), name="files")


def run_pipeline(*args: str) -> None:
    proc = subprocess.run(
        [PIPELINE_PY, "-m", "g3", *args],
        cwd=PIPELINE_DIR, capture_output=True, text=True,
    )
    if proc.returncode != 0:
        detail = proc.stderr.strip() or f"pipeline exited {proc.returncode}"
        raise HTTPException(status_code=500, detail=detail)


def garment_response(gdir: Path) -> dict:
    data = json.loads((gdir / "garment.json").read_text())
    data["id"] = gdir.name  # directory name is canonical; URLs and /api/dress key on it
    data["urls"] = {k: f"/files/garments/{gdir.name}/{v}" for k, v in data["files"].items()}
    return data


@app.get("/api/health")
def health():
    return {"ok": True, "pipeline": PIPELINE_PY, "human": str(HUMAN_GLB)}


@app.get("/api/human")
def human():
    return {"url": "/files/human.glb"}


def save_upload(upload: UploadFile, dest_dir: Path, stem: str) -> Path:
    # Keep the original suffix so the pipeline can sniff the format; rename the stem so the
    # front/back/side uploads never collide when they share a filename.
    suffix = Path(upload.filename or "").suffix or ".png"
    dest = dest_dir / f"{stem}{suffix}"
    with dest.open("wb") as f:
        shutil.copyfileobj(upload.file, f)
    return dest


@app.post("/api/garments", status_code=201)
def create_garment(image: UploadFile, category: str = Form(),
                   image_back: UploadFile | None = None, image_side: UploadFile | None = None):
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {sorted(CATEGORIES)}")
    gid = str(uuid.uuid4())
    gdir = GARMENTS_DIR / gid
    tmp = Path(tempfile.mkdtemp(prefix="g3-upload-"))
    try:
        args = ["build", "--human", str(HUMAN_GLB), "--image", str(save_upload(image, tmp, "front")),
                "--category", category, "--out", str(gdir)]
        # A browser submits an empty part (filename "") for an unselected file input.
        for flag, upload, stem in (("--image-back", image_back, "back"), ("--image-side", image_side, "side")):
            if upload is not None and upload.filename:
                args += [flag, str(save_upload(upload, tmp, stem))]
        try:
            run_pipeline(*args)
        except HTTPException:
            shutil.rmtree(gdir, ignore_errors=True)
            raise
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return garment_response(gdir)


@app.get("/api/garments")
def list_garments():
    dirs = sorted((d for d in GARMENTS_DIR.iterdir() if (d / "garment.json").is_file()),
                  key=lambda d: d.stat().st_mtime)
    return [garment_response(d) for d in dirs]


class DressBody(BaseModel):
    garmentIds: list[str]


@app.post("/api/dress")
def dress(body: DressBody):
    if not body.garmentIds:
        raise HTTPException(status_code=400, detail="garmentIds must not be empty")
    by_slot: dict[str, Path] = {}
    for gid in body.garmentIds:
        gdir = GARMENTS_DIR / gid
        if not (gdir / "garment.json").is_file():
            raise HTTPException(status_code=404, detail=f"unknown garment {gid}")
        slot = json.loads((gdir / "garment.json").read_text())["slot"]
        by_slot[slot] = gdir  # later id wins per slot
    ordered = [by_slot[s] for s in sorted(by_slot, key=lambda s: SLOT_ORDER.get(s, 99))]
    ids = sorted(d.name for d in ordered)
    h = hashlib.sha256(HUMAN_GLB.read_bytes() + "".join(ids).encode()).hexdigest()[:16]
    out = DRESSED_DIR / f"{h}.glb"
    if not out.exists():
        args = ["dress", "--human", str(HUMAN_GLB), "--out", str(out)]
        for d in ordered:
            args += ["--garment", str(d)]
        run_pipeline(*args)
    return {"url": f"/files/dressed/{out.name}", "garmentIds": ids}
