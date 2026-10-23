#!/usr/bin/env bash
# Build the guided capture camera's test frames: `just capture-frames` (capture brief
# .claude/plans/2026-10-22-capture-camera-brief.md §11; tools/capture-frames/README.md). Writes frame
# sets with Vision masks, stored boxes, ground-truth keypoints and expected results to
# artifacts/capture-camera/frames/ (gitignored), and caches the dataset images it fetches in
# artifacts/capture-camera/source/.
# macOS only: the generator is Swift on Core Image and Vision, compiled with the Xcode pinned in
# apps/ios/.xcode-version (no system Swift assumed). Idempotent: when the generator sources, this
# script, capture-rules.json and the Xcode pin are unchanged, the last output is kept as it is.
# Exit codes: 0 frames built or already up to date; 1 a step failed, or not macOS; 2 misuse.
set -euo pipefail
# shellcheck source=../../scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../../scripts/lib.sh"

TOOL_DIR="$REPO_ROOT/tools/capture-frames"
OUT_DIR="$REPO_ROOT/artifacts/capture-camera"
FRAMES_DIR="$OUT_DIR/frames"
GENERATOR_BIN="$OUT_DIR/bin/capture-frames"
RULES_FILE="$REPO_ROOT/packages/shared-kernel/registry/capture-rules.json"
# VNGenerateForegroundInstanceMaskRequest needs macOS 14.
MIN_MACOS="14.0"

# Points xcrun at the pinned Xcode; dies with the fix when it is not installed.
select_pinned_xcode() {
  local pinned="$1" state
  state="$(darwin_xcode_state "$pinned")"
  case "$state" in
    ok) ;;
    unselected\ *) export DEVELOPER_DIR="${state#unselected }/Contents/Developer" ;;
    *) die "capture-frames: Xcode $pinned (apps/ios/.xcode-version) is not available ($state). Fix: ./scripts/bootstrap.sh --system, or set DEVELOPER_DIR." ;;
  esac
}

# Everything the output depends on, as one hash.
input_fingerprint() {
  local pinned="$1"
  {
    printf 'xcode %s\n' "$pinned"
    cat "$TOOL_DIR"/Sources/*.swift "$TOOL_DIR/capture-frames.sh" "$RULES_FILE"
  } | shasum -a 256 | cut -d ' ' -f 1
}

build_generator() {
  mkdir -p "$(dirname "$GENERATOR_BIN")"
  log "Building the frame generator with Xcode $1"
  # Swift 5 language mode: a single-threaded script with no concurrency to check.
  xcrun swiftc -O -swift-version 5 -target "$(uname -m)-apple-macos$MIN_MACOS" -module-name CaptureFrames \
    -o "$GENERATOR_BIN" "$TOOL_DIR"/Sources/*.swift
}

main() {
  if [[ $# -gt 0 ]]; then
    printf 'usage: just capture-frames   (takes no arguments)\n' >&2
    exit 2
  fi
  os_is_darwin || die "capture-frames: macOS only; the generator needs Core Image and the Vision foreground instance mask ($OS_NAME here)."
  local pinned fingerprint stamp partial
  pinned="$(tr -d '[:space:]' <"$REPO_ROOT/apps/ios/.xcode-version")"
  select_pinned_xcode "$pinned"
  fingerprint="$(input_fingerprint "$pinned")"
  stamp="$FRAMES_DIR/.fingerprint"
  if [[ -f "$FRAMES_DIR/index.json" && -f "$stamp" && "$(<"$stamp")" == "$fingerprint" ]]; then
    log "Frames are up to date: $FRAMES_DIR (delete it to rebuild)"
    cat "$FRAMES_DIR/summary.txt"
    return 0
  fi
  build_generator "$pinned"
  # Build into a sibling folder and swap it in, so a failed run never leaves half a frame set.
  partial="$OUT_DIR/frames.partial"
  rm -rf "$partial"
  mkdir -p "$partial"
  log "Generating frames (dataset images download once into $OUT_DIR/source/)"
  "$GENERATOR_BIN" "$REPO_ROOT" "$OUT_DIR" "$partial"
  printf '%s\n' "$fingerprint" >"$partial/.fingerprint"
  rm -rf "$FRAMES_DIR"
  mv "$partial" "$FRAMES_DIR"
  log "Frame index: $FRAMES_DIR/index.json · contact sheets: $FRAMES_DIR/contact/"
}

main "$@"
