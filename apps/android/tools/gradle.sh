#!/usr/bin/env bash
# Run the apps/android Gradle wrapper with the environment every `just android-*` recipe needs.
#
#   apps/android/tools/gradle.sh <gradle args...>
#
# - JDK: the `java` on PATH (mise pins it; must be 21). JAVA_HOME is derived from it when unset.
# - SDK: ANDROID_HOME, else ANDROID_SDK_ROOT, else ~/Android/Sdk (Linux) or ~/Library/Android/sdk
#   (macOS). Nothing is written to local.properties.
# - CI=true adds --no-daemon.
# bash 3.2-compatible (macOS /bin/bash).
set -euo pipefail

ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_JAVA_MAJOR=21

if [[ -z "${JAVA_HOME:-}" ]]; then
  if ! command -v java >/dev/null 2>&1; then
    echo "android: java not found. Run \`mise install\` (mise.toml pins Temurin ${REQUIRED_JAVA_MAJOR})." >&2
    exit 1
  fi
  java_bin="$(command -v java)"
  # mise shims are wrappers; ask the JVM itself where it lives.
  JAVA_HOME="$(java -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java\.home = //p')"
  if [[ -z "$JAVA_HOME" ]]; then JAVA_HOME="$(cd "$(dirname "$java_bin")/.." && pwd)"; fi
  export JAVA_HOME
fi
java_major="$("$JAVA_HOME/bin/java" -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java\.specification\.version = //p')"
if [[ "$java_major" != "$REQUIRED_JAVA_MAJOR" ]]; then
  echo "android: JDK $REQUIRED_JAVA_MAJOR required, found '${java_major:-unknown}' at $JAVA_HOME. Run \`mise install\`." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -n "${ANDROID_SDK_ROOT:-}" ]]; then
  export ANDROID_HOME="$ANDROID_SDK_ROOT"
fi
if [[ -z "${ANDROID_HOME:-}" ]]; then
  for candidate in "$HOME/Android/Sdk" "$HOME/Library/Android/sdk"; do
    if [[ -d "$candidate/platforms" ]]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi
if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME" ]]; then
  echo "android: no Android SDK found (ANDROID_HOME unset; looked in ~/Android/Sdk and ~/Library/Android/sdk)." >&2
  echo "  install it with \`apps/android/tools/sdk.sh install\` (see apps/android/README.md)." >&2
  exit 1
fi

extra=()
if [[ "${CI:-}" == "true" ]]; then extra+=(--no-daemon); fi

cd "$ANDROID_DIR"
exec ./gradlew ${extra[@]+"${extra[@]}"} "$@"
