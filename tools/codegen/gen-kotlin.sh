#!/usr/bin/env bash
# Generate the Kotlin (Android) API client from the bundled OpenAPI contract.
#
#   packages/contracts/gen/openapi.bundle.json
#     ──openapi-generator 7.25.0 (kotlin, jvm-retrofit2, kotlinx_serialization, coroutines)──▶
#   packages/contracts/gen/kotlin-client/src/main/kotlin/app/aistylist/contracts/client/**
#   packages/contracts/events/analytics/events.json  ──node──▶
#   packages/contracts/gen/kotlin-client/analytics/src/main/kotlin/.../AnalyticsTaxonomy.kt
#
# Called by `just generate` (and `just generate --check`). Deterministic: running it twice on an
# unchanged bundle produces byte-identical output. Only Kotlin sources are kept (no generated
# Gradle build, docs or tests); apps/android `:core:api-client` compiles them as-is.
# Never edit the output by hand.
#
# Usage:  tools/codegen/gen-kotlin.sh [--check]
#   --check   generate into a temp dir and fail (exit 1) if the committed output differs.
# Env:
#   OPENAPI_BUNDLE          input bundle (default: <repo>/packages/contracts/gen/openapi.bundle.json)
#   AISTYLIST_CACHE_DIR     jar cache (default: ${XDG_CACHE_HOME:-~/.cache}/ai-stylist)
#   JAVA                    java binary, JDK >= 11 (default: `java` on PATH, else `mise exec -- java`)
#   NODE                    node binary (default: `node` on PATH, else `mise exec -- node`)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT="${OPENAPI_BUNDLE:-$REPO_ROOT/packages/contracts/gen/openapi.bundle.json}"
EVENTS="$REPO_ROOT/packages/contracts/events/analytics/events.json"
OUTPUT_DIR="$REPO_ROOT/packages/contracts/gen/kotlin-client"
PACKAGE_NAME="app.aistylist.contracts.client"

# Pinned generator. Maven Central publishes only sha1 (56a9bb79e3bb565f477eddca2c6daa288a9c6f35);
# this sha256 was computed from that verified download and is the integrity gate here.
GENERATOR_VERSION="7.25.0"
GENERATOR_SHA256="41ce4f6b07f196676439d710759fa1ced7a08066d06ff1bf314681470289efae"
GENERATOR_URL="https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${GENERATOR_VERSION}/openapi-generator-cli-${GENERATOR_VERSION}.jar"
CACHE_DIR="${AISTYLIST_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/ai-stylist}"
JAR="$CACHE_DIR/openapi-generator-cli-${GENERATOR_VERSION}.jar"

# shellcheck disable=SC2016  # literal backticks in the generated-file banner
BANNER='// GENERATED — run `just generate` (tools/codegen/gen-kotlin.sh). DO NOT EDIT BY HAND.'

check_only=false
for arg in "$@"; do
  case "$arg" in
    --check) check_only=true ;;
    -h | --help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "gen-kotlin.sh: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$INPUT" ]]; then
  echo "gen-kotlin.sh: $INPUT not found (run tools/codegen/gen-ts.sh first: it writes the bundle)" >&2
  exit 1
fi

if [[ -n "${JAVA:-}" ]]; then
  java_cmd=("$JAVA")
elif command -v java >/dev/null 2>&1; then
  java_cmd=(java)
elif command -v mise >/dev/null 2>&1; then
  java_cmd=(mise exec -- java)
else
  echo "gen-kotlin.sh: java not found (install via mise: mise.toml pins it)" >&2
  exit 1
fi

if [[ -n "${NODE:-}" ]]; then
  node_cmd=("$NODE")
elif command -v node >/dev/null 2>&1; then
  node_cmd=(node)
elif command -v mise >/dev/null 2>&1; then
  node_cmd=(mise exec -- node)
else
  echo "gen-kotlin.sh: node not found (install via mise: mise.toml pins it)" >&2
  exit 1
fi

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# Download once into the cache; verify the checksum on every run (a cached jar is not trusted).
if [[ ! -f "$JAR" ]]; then
  mkdir -p "$CACHE_DIR"
  echo "gen-kotlin.sh: downloading openapi-generator-cli ${GENERATOR_VERSION}"
  curl -fsSL --retry 3 -o "$JAR.part" "$GENERATOR_URL"
  mv "$JAR.part" "$JAR"
fi
actual_sha="$(sha256_of "$JAR")"
if [[ "$actual_sha" != "$GENERATOR_SHA256" ]]; then
  echo "gen-kotlin.sh: checksum mismatch for $JAR" >&2
  echo "  expected $GENERATOR_SHA256" >&2
  echo "  actual   $actual_sha" >&2
  rm -f "$JAR"
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
staged="$tmp/kotlin-client"

# --skip-validate-spec: the generator's own validator rejects `info.license` without
# `identifier`, which OpenAPI 3.1 does not require. The contract is linted by spectral instead.
# --global-property: write only models, APIs and supporting (infrastructure) files; no docs/tests.
if ! "${java_cmd[@]}" -jar "$JAR" generate \
  --skip-validate-spec \
  --input-spec "$INPUT" \
  --generator-name kotlin \
  --library jvm-retrofit2 \
  --output "$tmp/raw" \
  --global-property models,apis,supportingFiles,modelDocs=false,apiDocs=false,modelTests=false,apiTests=false \
  --additional-properties "packageName=${PACKAGE_NAME},serializationLibrary=kotlinx_serialization,useCoroutines=true,dateLibrary=java8,enumPropertyNaming=UPPERCASE,omitGradleWrapper=true,hideGenerationTimestamp=true" \
  >"$tmp/generator.log" 2>&1; then
  cat "$tmp/generator.log" >&2
  echo "gen-kotlin.sh: openapi-generator failed" >&2
  exit 1
fi

# Keep only the Kotlin sources; prepend the banner to each file.
mkdir -p "$staged/src/main"
cp -R "$tmp/raw/src/main/kotlin" "$staged/src/main/kotlin"
while IFS= read -r -d '' kt; do
  { printf '%s\n' "$BANNER"; cat "$kt"; } >"$kt.tmp"
  mv "$kt.tmp" "$kt"
done < <(find "$staged" -name '*.kt' -print0 | sort -z)

# Analytics taxonomy constants (event + property names) so Kotlin never hand-copies them
# (CLAUDE.md single-source-of-truth). Compiled by apps/android `:core:analytics`.
taxonomy_out="$staged/analytics/src/main/kotlin/app/aistylist/contracts/analytics/AnalyticsTaxonomy.kt"
mkdir -p "$(dirname "$taxonomy_out")"
"${node_cmd[@]}" - "$EVENTS" "$BANNER" >"$taxonomy_out" <<'JS'
const fs = require('fs');
const [eventsPath, banner] = process.argv.slice(2);
const taxonomy = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
const pascal = (s) => s.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const upperSnake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const kdoc = (s) => s.replace(/\*\//g, '* /').replace(/\.?$/, '.');
const out = [
  banner,
  '// Source: packages/contracts/events/analytics/events.json',
  'package app.aistylist.contracts.analytics',
  '',
  `/** Product-analytics event taxonomy, version ${taxonomy.version}. Names only; payload types in KDoc. */`,
  'object AnalyticsTaxonomy {',
];
taxonomy.events.forEach((event, i) => {
  if (i > 0) out.push('');
  out.push(`    /** ${kdoc(event.description || event.name)} Owner: ${event.owner}. */`);
  out.push(`    object ${pascal(event.name)} {`);
  out.push(`        const val NAME: String = "${event.name}"`);
  out.push(`        const val CONSENT_REQUIRED: Boolean = ${event.consentRequired ? 'true' : 'false'}`);
  for (const [prop, type] of Object.entries(event.properties)) {
    out.push('');
    out.push(`        /** Property \`${prop}\`: ${type}. */`);
    out.push(`        const val ${upperSnake(prop)}: String = "${prop}"`);
  }
  out.push('    }');
});
out.push('}');
process.stdout.write(out.join('\n') + '\n');
JS

cat >"$staged/README.md" <<EOF
# kotlin-client (GENERATED — DO NOT EDIT BY HAND)

Kotlin API client for the AI Stylist API, generated from \`packages/contracts/gen/openapi.bundle.json\`
by \`tools/codegen/gen-kotlin.sh\` (openapi-generator ${GENERATOR_VERSION}, \`kotlin\` generator,
\`jvm-retrofit2\` + \`kotlinx_serialization\` + coroutines). Regenerate with \`just generate\`;
\`just generate --check\` fails when this directory is stale.

- Package: \`${PACKAGE_NAME}\` (\`apis/\`, \`models/\`, \`infrastructure/\`).
- Consumers: \`apps/android\` module \`:core:api-client\` compiles \`src/main/kotlin\` directly;
  \`:core:analytics\` compiles \`analytics/src/main/kotlin\` (\`AnalyticsTaxonomy\`: event and property
  names from \`packages/contracts/events/analytics/events.json\`).
- Base URL: always construct \`ApiClient(baseUrl = <host-only API_BASE_URL>)\`. The generated paths
  already start with \`v1/\`, and the default base path (from the spec's \`servers\`) also ends in
  \`/v1\`, so relying on the default would request \`/v1/v1/...\`.
EOF

if [[ -d "$OUTPUT_DIR" ]] && diff -r -q "$OUTPUT_DIR" "$staged" >/dev/null 2>&1; then
  echo "gen-kotlin.sh: up to date (${OUTPUT_DIR#"$REPO_ROOT"/})"
  exit 0
fi
if $check_only; then
  echo "gen-kotlin.sh: committed output is stale — run \`just generate\`:" >&2
  diff -r -u "$OUTPUT_DIR" "$staged" >&2 || true
  exit 1
fi
rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
cp -R "$staged" "$OUTPUT_DIR"
echo "gen-kotlin.sh: wrote ${OUTPUT_DIR#"$REPO_ROOT"/}"
