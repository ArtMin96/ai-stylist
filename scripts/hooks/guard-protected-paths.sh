#!/usr/bin/env bash
# PreToolUse guard, matcher Edit|Write|NotebookEdit (.claude/settings.json).
# Denies edits to generated output, human-authorized-only policy docs, human-applied CI files,
# single-writer files, and test files placed outside a tests/ or e2e/ directory (CLAUDE.md
# "Search before write", "Parallel sessions", "Testing rules"). Gate fixture trees
# (tools/<gate>/fixtures/**) are deliberately rule-breaking copies of the repo and are exempt.
# No jq → deny (fail closed). Read-only: never writes anything itself.
#
# Escape hatch: set AGENT_MAY_EDIT_POLICY=1 to bypass this guard for a human-authorized session.
#
# Reads the PreToolUse JSON payload on stdin (https://code.claude.com/docs/en/hooks — "PreToolUse
# input"): tool_input.file_path (Edit/Write) or tool_input.notebook_path (NotebookEdit). A
# relative path is resolved against the payload's cwd.
set -uo pipefail

if [[ "${AGENT_MAY_EDIT_POLICY:-0}" == "1" ]]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  while IFS= read -r _; do :; done
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"jq is not installed, so the repo path guard cannot inspect this edit (fail closed). Install jq (macOS ships /usr/bin/jq; on Linux use the distro package) and retry."}}'
  exit 0
fi

input="$(cat)"
path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
[[ -z "$path" ]] && exit 0
if [[ "$path" != /* ]]; then
  cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
  path="${cwd:-${CLAUDE_PROJECT_DIR:-$PWD}}/$path"
fi

deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

case "$path" in
  */tools/*/fixtures/*) exit 0 ;;
esac

case "$path" in
  */packages/contracts/gen/* | */packages/shared-kernel/src/gen/* | */workers/ml/generated/* | */packages/db/migrations/meta/*)
    deny "Generated output — run \`just generate\`, never hand-edit." ;;
  */apps/ios/*.xcodeproj/* | */apps/ios/*.xcodeproj)
    deny "Generated Xcode project (gitignored) — edit apps/ios/project.yml or Config/*.xcconfig, then run \`just ios-project\`." ;;
  */apps/android/*gradle.lockfile | */apps/android/gradle/verification-metadata.xml)
    deny "Dependency lock/verification state — change gradle/libs.versions.toml, then run \`just android-deps-lock\` and commit the lockfiles + verification-metadata.xml together." ;;
  */CLAUDE.md | */planning/SPINE.md | */planning/15-*.md)
    deny "Human-authorized only (CLAUDE.md source-of-truth priority) — write a proposal under .claude/plans/ instead." ;;
  */.github/workflows/* | */.github/actions/*)
    deny "CI workflows and composite actions are human-applied — put the exact diff in your report (tooling-engineer proposes, a human applies)." ;;
  */pnpm-lock.yaml | */workers/uv.lock | */secrets/* | */.sops.yaml)
    deny "Single-writer / human-controlled file (CLAUDE.md 'Parallel sessions' and 'Prohibited without explicit human authorization') — sequence this change with a human instead of editing directly." ;;
esac

case "$(basename "$path")" in
  *.test.ts | *.spec.ts | *.test.tsx | *.spec.tsx | *.test.mts | *.spec.mts | *.test.js | *.spec.js | *.test.mjs | *.spec.mjs | test_*.py | *_test.py)
    case "$path" in
      */tests/* | */e2e/*) ;;
      *) deny "Tests live in the owning module's tests/ (CLAUDE.md Testing rules)." ;;
    esac
    ;;
  *Tests.swift | *Test.swift)
    case "$path" in
      */apps/ios/Packages/*/tests/*) ;;
      */apps/ios/*) deny "Swift tests live in apps/ios/Packages/<Pkg>/tests/<Target>Tests/ (CLAUDE.md Testing rules)." ;;
    esac
    ;;
  *Test.kt | *Tests.kt | *Spec.kt)
    case "$path" in
      */src/test/* | */src/androidTest/*) ;;
      */apps/android/*) deny "Android tests live in the Gradle module's src/test/kotlin (or src/androidTest) (CLAUDE.md Testing rules)." ;;
    esac
    ;;
esac

exit 0
