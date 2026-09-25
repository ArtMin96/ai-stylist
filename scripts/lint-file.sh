#!/usr/bin/env bash
# just lint-file <path> — single-file lint dispatch by extension, for the PostToolUse hook
# (scripts/hooks/*.sh) so one edit pays for one file's lint, not a whole-repo `just lint` turbo
# run. Prints nothing when clean. Dispatch mirrors `just lint`'s tool choice per file type:
#   .ts/.tsx/.mjs/.cjs eslint · .py ruff · .sh shellcheck · apps/ios .swift swift-format lint + SwiftLint ·
#   apps/android .kt/.kts Spotless check (never rewrites the file) · .json jq (tsconfig/.vscode JSONC
#   skipped) · skill/agent/rule .md scoped docs-check · .github/workflows actionlint.
# Toolchain absent (native toolchain, or node_modules in a fresh worktree): a notice, exit 0.
# Gate fixture trees (tools/*/fixtures/**) are deliberately rule-breaking: never linted here.
# Usage: scripts/lint-file.sh <path>
# Exit: whatever the underlying linter returns; 0 (silently) for extensions with no linter here.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$REPO_ROOT"

if [[ $# -ne 1 ]]; then
  echo "usage: just lint-file <path>" >&2
  exit 2
fi
path="$1"

case "$path" in
  # Generated clients are never linted by hand-edit hooks (regenerate with `just generate`), and the
  # iOS ban fixtures are deliberately bad Swift (`just ios-check-banned --fixtures` owns them).
  */packages/contracts/gen/* | packages/contracts/gen/* | */apps/ios/scripts/fixtures/* | apps/ios/scripts/fixtures/* | \
    */tools/*/fixtures/* | tools/*/fixtures/*)
    exit 0
    ;;
  *.swift)
    # swift-format lint (+ its safety rules) and SwiftLint on this one file. Toolchain absent: notice, exit 0.
    [[ "$path" == */apps/ios/* || "$path" == apps/ios/* ]] || exit 0
    # shellcheck source=apps/ios/scripts/lib.sh
    . apps/ios/scripts/lib.sh
    if ios_has_swift || have docker; then
      ios_swift format lint --strict --configuration apps/ios/.swift-format "$path"
    else
      echo "lint-file: notice: no swift toolchain (swift or docker); skipped swift-format for $path" >&2
    fi
    abs="$(cd "$(dirname "$path")" && pwd)/$(basename "$path")"
    if ! os_is_darwin && have swiftlint-static; then
      (cd apps/ios && swiftlint-static lint --strict --quiet --config .swiftlint.yml "$abs")
    elif have swiftlint; then
      (cd apps/ios && swiftlint lint --strict --quiet --config .swiftlint.yml "$abs")
    else
      echo "lint-file: notice: SwiftLint not installed (mise install); skipped for $path" >&2
    fi
    ;;
  *.kt | *.kts)
    # Spotless (ktlint) check of this one file through the IDE hook in stdin/stdout mode: the file
    # on disk is never rewritten (run `just android-format` to apply). ~2 s with a warm daemon.
    [[ "$path" == */apps/android/* || "$path" == apps/android/* ]] || exit 0
    if ! apps/android/tools/sdk.sh check >/dev/null 2>&1; then
      echo "lint-file: notice: Android SDK missing (just android-sdk install); skipped Spotless for $path" >&2
      exit 0
    fi
    abs="$(cd "$(dirname "$path")" && pwd)/$(basename "$path")"
    formatted="$(mktemp)"
    hook_err="$(mktemp)"
    trap 'rm -f "$formatted" "$hook_err"' EXIT
    if ! apps/android/tools/gradle.sh -q spotlessApply "-PspotlessIdeHook=$abs" \
      -PspotlessIdeHookUseStdIn -PspotlessIdeHookUseStdOut <"$abs" >"$formatted" 2>"$hook_err"; then
      echo "lint-file: notice: the Spotless hook could not run for $path (just android-format --check is the gate):" >&2
      tail -n 3 "$hook_err" >&2
      exit 0
    fi
    # Clean files produce no stdout; a dirty one produces its formatted text.
    if [[ -s "$formatted" ]] && ! cmp -s "$formatted" "$abs"; then
      echo "lint-file: $path is not Spotless/ktlint-formatted; run: just android-format" >&2
      diff -u "$abs" "$formatted" | head -n 40 >&2 || true
      exit 1
    fi
    ;;
  *.ts | *.tsx | *.mjs | *.cjs)
    if [[ ! -x node_modules/.bin/eslint ]]; then
      echo "lint-file: notice: node_modules is not installed in this checkout (pnpm install); skipped eslint for $path" >&2
      exit 0
    fi
    # --no-warn-ignored: a file eslint.config.mjs ignores is not a warning that trips --max-warnings.
    pnpm exec eslint --max-warnings=0 --no-warn-ignored "$path"
    ;;
  *.py)
    uv run --project workers ruff check "$path"
    ;;
  *.sh)
    shellcheck -s bash -x -P SCRIPTDIR "$path"
    ;;
  */tsconfig*.json | tsconfig*.json | */.vscode/*.json | .vscode/*.json)
    exit 0 # JSONC (comments allowed): tsc and the editor validate these
    ;;
  *.json)
    # A malformed .claude/settings.json silently drops every hook, so JSON is at least parsed.
    jq empty "$path"
    ;;
  */.agents/skills/*.md | .agents/skills/*.md | */.claude/skills/*.md | .claude/skills/*.md | \
    */.claude/agents/*.md | .claude/agents/*.md | */.claude/rules/*.md | .claude/rules/*.md)
    # The file-scoped docs-check rules (DC-05/07/09/10/11), on the real path behind a .claude/skills symlink.
    real="$(cd -P "$(dirname "$path")" && pwd)/$(basename "$path")"
    out="$(scripts/docs/docs-check.sh "$real" 2>&1)" || { printf '%s\n' "$out" >&2; exit 1; }
    ;;
  */.github/workflows/*.yml | .github/workflows/*.yml | */.github/workflows/*.yaml | .github/workflows/*.yaml)
    actionlint "$path"
    ;;
  *)
    exit 0
    ;;
esac
