#!/usr/bin/env bash
# Clone-check fixture (tools/jscpd/README.md): the body of describe_parcel is copied into
# parcel-label-copy.sh on purpose, so `just clone-check --fixtures` must report a bash clone.
# Usage: parcel-label.sh <id> <weight g> <length mm> <width mm> <height mm> <fragile: 0|1>
set -euo pipefail

describe_parcel() {
  local id="$1" weight_grams="$2" length_mm="$3" width_mm="$4" height_mm="$5" fragile="$6"
  local volume_cm3 size handling label
  volume_cm3=$((length_mm * width_mm * height_mm / 1000))
  size=standard
  if [[ $volume_cm3 -gt 60000 ]]; then
    size=oversize
  elif [[ $volume_cm3 -gt 20000 ]]; then
    size=large
  fi
  handling=normal
  if [[ $fragile -eq 1 ]]; then
    handling=fragile
  elif [[ $((weight_grams / (volume_cm3 + 1))) -gt 2 ]]; then
    handling=heavy
  fi
  label="parcel $id | $weight_grams g | $volume_cm3 cm3 | size $size | handling $handling"
  if [[ $weight_grams -gt 30000 ]]; then
    label="$label | check declared weight"
  fi
  printf '%s\n' "$label"
}

describe_parcel "$@"
