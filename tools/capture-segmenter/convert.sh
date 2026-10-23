#!/usr/bin/env bash
# Rebuild the Android capture camera's garment segmenter from its published source
# (docs/adr/0013-on-device-garment-outline-android.md):
#   bash tools/capture-segmenter/convert.sh          rebuild and copy it into the app
#   bash tools/capture-segmenter/convert.sh --check  rebuild and compare with the committed model
#
# 1. Downloads rembg's U²-Netp ONNX export (MIT; weights U²-Net, Apache-2.0) from its GitHub
#    release once into artifacts/capture-segmenter/ (gitignored) and checks its pinned sha256.
#    The official U²-Net weights are a PyTorch pickle; nothing downloaded is ever unpickled, so
#    the ONNX export is the only source this script accepts.
# 2. Fixes the input to 224 × 224 and converts it to TFLite with float16 weights (convert.py), with
#    every Python package pinned (uv, Python 3.12).
# 3. Prints the model's sha256. Default: copies the model into the capture module's assets and
#    writes the hash file the unit test reads. --check: exit 1 when the rebuild differs from it.
# Network: the ONNX file and the pinned Python wheels only. Exit: 0 done, 1 failed, 2 misuse.
# bash 3.2-compatible (macOS /bin/bash).
set -euo pipefail
# shellcheck source=../../scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../../scripts/lib.sh"

SOURCE_URL="https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx"
SOURCE_SHA256="309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8"
SIZE=224
TOOL_DIR="$REPO_ROOT/tools/capture-segmenter"
WORK_DIR="$REPO_ROOT/artifacts/capture-segmenter"
ASSET_DIR="$REPO_ROOT/apps/android/feature/capture/src/main/assets/capture-segmenter"
MODEL_NAME="u2netp-$SIZE-fp16.tflite"
# The conversion stack the committed model was built with (2026-10-22).
PACKAGES=(
  numpy==2.0.2 onnx==1.22.0 onnxruntime==1.31.0 onnxsim==0.8.1 onnx2tf==1.28.8
  onnx-graphsurgeon==0.6.1 sng4onnx==2.0.1 tensorflow==2.19.1 tf-keras==2.19.0
  ai-edge-litert==2.3.0 psutil==7.2.2 protobuf==5.29.6 h5py==3.16.0
)

sha256_of() { shasum -a 256 "$1" | cut -d ' ' -f 1; }

check=0
case "${1:-}" in
  "") ;;
  --check) check=1 ;;
  *) printf 'usage: %s [--check]\n' "$0" >&2; exit 2 ;;
esac
have uv || die "capture-segmenter: uv not found (mise install)"

source_file="$WORK_DIR/source/u2netp.onnx"
if [[ ! -f "$source_file" || "$(sha256_of "$source_file")" != "$SOURCE_SHA256" ]]; then
  log "Downloading $SOURCE_URL"
  mkdir -p "$WORK_DIR/source"
  curl -fsSL -o "$source_file.partial" "$SOURCE_URL"
  mv "$source_file.partial" "$source_file"
fi
actual="$(sha256_of "$source_file")"
[[ "$actual" == "$SOURCE_SHA256" ]] || die "capture-segmenter: u2netp.onnx sha256 is $actual, expected $SOURCE_SHA256"
info "source sha256 $actual"

build="$WORK_DIR/build-$SIZE"
rm -rf "$build"
with_args=()
for package in "${PACKAGES[@]}"; do with_args+=(--with "$package"); done
log "Converting to TFLite ($SIZE × $SIZE, float16 weights)"
uv run --quiet --no-project --python 3.12 "${with_args[@]}" \
  python -I "$TOOL_DIR/convert.py" "$source_file" "$build" "$SIZE"
built="$build/tflite/u2netp_${SIZE}_float16.tflite"
[[ -f "$built" ]] || die "capture-segmenter: the converter wrote no $built"
built_sha="$(sha256_of "$built")"
info "model sha256 $built_sha ($(wc -c <"$built" | tr -d ' ') bytes)"

hash_file="$ASSET_DIR/$MODEL_NAME.sha256"
if [[ "$check" -eq 1 ]]; then
  committed="$(cut -d ' ' -f 1 "$hash_file")"
  [[ "$built_sha" == "$committed" ]] || die "capture-segmenter: rebuild $built_sha differs from the committed $committed"
  log "The rebuild matches the committed model"
else
  mkdir -p "$ASSET_DIR"
  cp "$built" "$ASSET_DIR/$MODEL_NAME"
  printf '%s  %s\n' "$built_sha" "$MODEL_NAME" >"$hash_file"
  log "Wrote $ASSET_DIR/$MODEL_NAME and its .sha256"
fi
