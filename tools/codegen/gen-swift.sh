#!/usr/bin/env bash
# Swift API client generator (native iOS app, apps/ios):
#
#   packages/contracts/gen/openapi.bundle.json
#     --swift-openapi-generator 1.13.1-->  packages/contracts/gen/swift-client/  (SwiftPM package, product AIStylistAPI)
#   packages/shared-kernel/registry/*.json
#     --tools/codegen/gen-kernel.mjs swift-->  Sources/AIStylistKernel/  (product AIStylistKernel, no dependencies:
#                                               reason codes, entitlement names, credit meters, units; OQ-15)
#
# The whole output directory is GENERATED (Package.swift, README.md, Sources/). Never edit it by hand.
# Deterministic: running it twice on an unchanged bundle produces byte-identical output.
# Called by `just generate`; run gen-ts.sh first (it writes the bundle this script reads).
#
# Usage:  tools/codegen/gen-swift.sh [--check]
#   --check   generate into a temp dir and fail (exit 1) if the committed output differs.
# Toolchain: `swift` on PATH (Xcode on macOS, mise swift on Linux); otherwise Docker image
# $SWIFT_DOCKER_IMAGE (default swift:6.4). The generator is built once into
# $SWIFT_CODEGEN_CACHE (default ${XDG_CACHE_HOME:-$HOME/.cache}/ai-stylist/swift-codegen).
# The kernel registry emitter needs node (`node` on PATH, else `mise exec -- node`).
set -euo pipefail

GENERATOR_VERSION="1.13.1"
RUNTIME_VERSION="1.12.1"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUNDLE="$ROOT/packages/contracts/gen/openapi.bundle.json"
OUTPUT_DIR="$ROOT/packages/contracts/gen/swift-client"
CACHE_BASE="${SWIFT_CODEGEN_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/ai-stylist/swift-codegen}"
TOOL_DIR="$CACHE_BASE/generator-$GENERATOR_VERSION"
DOCKER_IMAGE="${SWIFT_DOCKER_IMAGE:-swift:6.4}"
# Paths in the tree that are build caches, never generated or committed.
DIFF_EXCLUDES=(-x .build -x .swiftpm -x Package.resolved)

check_only=false
for arg in "$@"; do
  case "$arg" in
    --check) check_only=true ;;
    -h | --help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "gen-swift.sh: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$BUNDLE" ]]; then
  echo "gen-swift.sh: $BUNDLE is missing; run tools/codegen/gen-ts.sh (just generate) first" >&2
  exit 1
fi

mkdir -p "$TOOL_DIR"
TOOL_DIR="$(cd "$TOOL_DIR" && pwd)"

# Run a `swift` subcommand with the native toolchain, or inside Docker with the repo and the
# cache mounted at their host paths (so every path argument means the same thing inside).
# A `swift` on PATH that cannot run (e.g. a broken mise install on Arch) counts as absent.
swift_cmd() {
  if command -v swift >/dev/null 2>&1 && swift --version >/dev/null 2>&1; then
    swift "$@"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm \
      --user "$(id -u):$(id -g)" \
      -e HOME="$TOOL_DIR/home" \
      -v "$ROOT:$ROOT" \
      -v "$TOOL_DIR:$TOOL_DIR" \
      -w "$ROOT" \
      "$DOCKER_IMAGE" swift "$@"
  else
    echo "gen-swift.sh: no Swift toolchain: install Xcode (macOS) or mise swift / Docker (Linux)" >&2
    exit 1
  fi
}

# Tool manifest: the generator and every transitive dependency pinned exactly, so the
# generator build (and therefore its output) cannot drift with upstream releases.
write_if_changed() {
  local path="$1" content="$2"
  if [[ ! -f "$path" ]] || [[ "$(cat "$path")" != "$content" ]]; then
    printf '%s\n' "$content" >"$path"
  fi
}
write_if_changed "$TOOL_DIR/Package.swift" "// swift-tools-version: 6.4
// Tool manifest written by tools/codegen/gen-swift.sh (cache only, never shipped).
import PackageDescription

let package = Package(
  name: \"ai-stylist-swift-codegen\",
  dependencies: [
    .package(url: \"https://github.com/apple/swift-openapi-generator\", exact: \"$GENERATOR_VERSION\"),
    .package(url: \"https://github.com/mattpolzin/OpenAPIKit\", exact: \"6.4.0\"),
    .package(url: \"https://github.com/apple/swift-algorithms\", exact: \"1.2.1\"),
    .package(url: \"https://github.com/apple/swift-argument-parser\", exact: \"1.8.2\"),
    .package(url: \"https://github.com/apple/swift-numerics.git\", exact: \"1.1.1\"),
    .package(url: \"https://github.com/jpsim/Yams\", exact: \"6.2.2\"),
  ]
)"
write_if_changed "$TOOL_DIR/openapi-generator-config.yaml" "generate:
  - types
  - client
accessModifier: public
namingStrategy: idiomatic"
mkdir -p "$TOOL_DIR/home"

tmp="$(mktemp -d "$TOOL_DIR/stage.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
staged="$tmp/swift-client"
mkdir -p "$staged/Sources/AIStylistAPI"

echo "==> swift-openapi-generator $GENERATOR_VERSION -> packages/contracts/gen/swift-client/"
swift_cmd run --quiet -c release --package-path "$TOOL_DIR" swift-openapi-generator generate \
  --config "$TOOL_DIR/openapi-generator-config.yaml" \
  --output-directory "$staged/Sources/AIStylistAPI" \
  "$BUNDLE" >"$tmp/generator.log" 2>&1 || {
  cat "$tmp/generator.log" >&2
  echo "gen-swift.sh: swift-openapi-generator failed" >&2
  exit 1
}

# Banner on every generated Swift file (the generator's own header stays below it).
# shellcheck disable=SC2016  # literal backticks in the banner
BANNER='// GENERATED by tools/codegen/gen-swift.sh from packages/contracts/gen/openapi.bundle.json. DO NOT EDIT: run `just generate`.'
for f in "$staged"/Sources/AIStylistAPI/*.swift; do
  { printf '%s\n' "$BANNER"; cat "$f"; } >"$f.tmp"
  mv "$f.tmp" "$f"
done

# shared-kernel registries (reason codes, entitlements, units) as a dependency-free target, so the
# iOS app never hand-copies them (CLAUDE.md single source of truth; OQ-15). Banner is per file.
if command -v node >/dev/null 2>&1; then
  node_cmd=(node)
elif command -v mise >/dev/null 2>&1; then
  node_cmd=(mise exec -- node)
else
  echo "gen-swift.sh: node not found (install via mise: mise.toml pins it)" >&2
  exit 1
fi
"${node_cmd[@]}" "$ROOT/tools/codegen/gen-kernel.mjs" swift "$staged/Sources/AIStylistKernel" >/dev/null

cat >"$staged/Package.swift" <<EOF
// swift-tools-version: 6.4
$BANNER
import PackageDescription

let package = Package(
  name: "AIStylistAPI",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: [
    .library(name: "AIStylistAPI", targets: ["AIStylistAPI"]),
    .library(name: "AIStylistKernel", targets: ["AIStylistKernel"]),
  ],
  dependencies: [
    .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "$RUNTIME_VERSION")
  ],
  targets: [
    .target(
      name: "AIStylistAPI",
      dependencies: [.product(name: "OpenAPIRuntime", package: "swift-openapi-runtime")],
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
    .target(
      name: "AIStylistKernel",
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
  ]
)
EOF

cat >"$staged/README.md" <<EOF
# AIStylistAPI (generated Swift client)

GENERATED by \`tools/codegen/gen-swift.sh\` (swift-openapi-generator $GENERATOR_VERSION) from
\`packages/contracts/gen/openapi.bundle.json\`. **Do not edit anything in this directory.** Change the
OpenAPI source in \`packages/contracts/openapi/\` and run \`just generate\`.

- SwiftPM package, product \`AIStylistAPI\`, depends on swift-openapi-runtime $RUNTIME_VERSION (exact).
- Consumed by \`apps/ios/Packages/Core\` (target \`APIData\` only) by local path.
- Product \`AIStylistKernel\` (no dependencies): shared-kernel constants generated by
  \`tools/codegen/gen-kernel.mjs\` from \`packages/shared-kernel/registry/*.json\` (\`ReasonCode\`,
  \`ReasonCodeNamespace\`, \`ReasonCodeStage\`, \`EntitlementName\`, \`EntitlementValueKind\`,
  \`CreditMeter\`, \`LengthUnit\`, \`MassUnit\`, \`TemperatureUnit\`, \`MeasurementDimension\`,
  \`CanonicalUnits\`, \`UnitSystem\`, \`MeasurementSource\`, \`ConversionFactors\`). Change the registry
  JSON, never these files.
- Build the client from the configured **host-only** base URL (for example \`http://localhost:3000\`):
  the operation paths already start with \`/v1\`. Do not use the generated \`Servers\` URLs, which
  also end in \`/v1\` and would produce \`/v1/v1/...\`.
EOF

cat >"$staged/.gitignore" <<'EOF'
.build/
.swiftpm/
Package.resolved
EOF

if [[ -d "$OUTPUT_DIR" ]] && diff -r -q "${DIFF_EXCLUDES[@]}" "$OUTPUT_DIR" "$staged" >/dev/null 2>&1; then
  echo "gen-swift.sh: up to date (${OUTPUT_DIR#"$ROOT"/})"
  exit 0
fi
if $check_only; then
  echo "gen-swift.sh: committed output is stale; run \`just generate\`:" >&2
  diff -r -u "${DIFF_EXCLUDES[@]}" "$OUTPUT_DIR" "$staged" >&2 || true
  exit 1
fi
rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
cp -R "$staged" "$OUTPUT_DIR"
echo "gen-swift.sh: wrote ${OUTPUT_DIR#"$ROOT"/}"
