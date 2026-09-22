#!/usr/bin/env bash
# PreToolUse guard, matcher Edit|Write|MultiEdit|NotebookEdit (.claude/settings.json).
# Denies edits to generated output, human-authorized-only policy docs, single-writer files, and
# test files placed outside a tests/ or e2e/ directory (CLAUDE.md "Search before write",
# "Parallel sessions", "Testing rules"). Read-only: never writes anything itself.
#
# Escape hatch: set AGENT_MAY_EDIT_POLICY=1 to bypass this guard for a human-authorized session.
#
# Reads the PreToolUse JSON payload on stdin (docs.claude.com/en/hooks — "PreToolUse input"):
# tool_input.file_path is always absolute for Write/Edit/Read. NotebookEdit's path field isn't
# documented on that page; tools-reference.md's permission-rule section implies notebook_path, so
# this guard also tries that key.
set -uo pipefail

if [[ "${AGENT_MAY_EDIT_POLICY:-0}" == "1" ]]; then
  exit 0
fi

input="$(cat)"
path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
[[ -z "$path" ]] && exit 0

deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

case "$path" in
  */packages/contracts/gen/*|*/workers/ml/generated/*|*/packages/db/migrations/meta/*)
    deny "Generated output — run \`just generate\`, never hand-edit." ;;
  */apps/ios/*.xcodeproj/*|*/apps/ios/*.xcodeproj)
    deny "Generated Xcode project (gitignored) — edit apps/ios/project.yml or Config/*.xcconfig, then run \`just ios-project\`." ;;
  */apps/android/*gradle.lockfile|*/apps/android/gradle/verification-metadata.xml)
    deny "Dependency lock/verification state — change gradle/libs.versions.toml, then run \`just android-deps-lock\` and commit the lockfiles + verification-metadata.xml together." ;;
  */CLAUDE.md|*/planning/SPINE.md|*/planning/15-*.md)
    deny "Human-authorized only (CLAUDE.md source-of-truth priority) — write a proposal under .claude/plans/ instead." ;;
  */pnpm-lock.yaml|*/workers/uv.lock|*/secrets/*|*/.sops.yaml|*/.github/workflows/*)
    deny "Single-writer / human-controlled file (CLAUDE.md 'Parallel sessions' and 'Prohibited without explicit human authorization') — sequence this change with a human instead of editing directly." ;;
esac

case "$(basename "$path")" in
  *.test.ts|*.spec.ts|test_*.py)
    case "$path" in
      */tests/*|*/e2e/*) ;;
      *) deny "Tests live in the owning module's tests/ (CLAUDE.md Testing rules)." ;;
    esac
    ;;
  *Tests.swift)
    case "$path" in
      */apps/ios/Packages/*/tests/*) ;;
      */apps/ios/*) deny "Swift tests live in apps/ios/Packages/<Pkg>/tests/<Target>Tests/ (CLAUDE.md Testing rules)." ;;
    esac
    ;;
  *Test.kt)
    case "$path" in
      */src/test/*|*/src/androidTest/*) ;;
      */apps/android/*) deny "Android tests live in the Gradle module's src/test/kotlin (or src/androidTest) (CLAUDE.md Testing rules)." ;;
    esac
    ;;
esac

exit 0
