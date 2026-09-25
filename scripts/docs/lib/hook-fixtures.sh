#!/usr/bin/env bash
# `docs-check --fixtures`, hook half: replays every tools/docs/fixtures/hooks/*.json Claude Code hook
# payload through the scripts/hooks/ script its README row names and compares the decision with that
# row's "Expected" cell. tools/docs/fixtures/hooks/README.md is the only source of expectations.
# Source, do not execute; depends on common.sh being sourced first.
#
# Placeholders in a payload, replaced per case: HOOK_FIXTURE_REPO → a throwaway committed checkout
# (hook_fixture_template), HOOK_FIXTURE_SCRATCH → a throwaway scratch dir. The optional top-level
# "_harness" key (the hooks never read it) holds "args" (the hook's exec-form args), "setup"
# (space-separated hook_fixture_step names, run in order before the hook) and "nojq" (true = run
# the hook with a PATH that has no jq). The decision is permissionDecision (PreToolUse), decision
# (Stop), or "allow" when the hook prints nothing.

HOOK_FIXTURE_REPO="/home/arthur/Projects/app"
HOOK_FIXTURE_SCRATCH="/home/arthur/scratchpad"
HOOK_FIXTURE_GITC=(-c user.name=docs-check -c user.email=docs-check@invalid -c commit.gpgsign=false -c core.hooksPath=/dev/null)

# hook_fixture_template DIR — the committed checkout every case starts from (a copy per case).
hook_fixture_template() {
  local dir="$1"
  mkdir -p "$dir/planning" "$dir/apps/api/src" "$dir/apps/android/app" "$dir/.claude/rules" || return 1
  printf '.claude/worktrees/\n' >"$dir/.gitignore"
  printf '# Progress\n' >"$dir/PROGRESS.md"
  printf '# Progress ledger\n' >"$dir/planning/PROGRESS.md"
  printf 'export const app = 1;\n' >"$dir/apps/api/src/app.ts"
  printf 'plugins {}\n' >"$dir/apps/android/app/build.gradle.kts"
  printf '# Rule\n' >"$dir/.claude/rules/r.md"
  git -C "$dir" init -q &&
    git -C "$dir" add -A &&
    git -C "$dir" "${HOOK_FIXTURE_GITC[@]}" commit -q -m template
}

# hook_fixture_step REPO STEP — one "_harness.setup" step:
#   start                 session-start.sh, source "startup", session fixture-session (the baseline)
#   edit-source           change apps/api/src/app.ts          edit-progress  change PROGRESS.md
#   edit-rules            change .claude/rules/r.md           commit         commit everything
#   worktree              linked worktree .claude/worktrees/wt (branch wt)
#   edit-worktree-source  change .claude/worktrees/wt/apps/api/src/app.ts
#   symlink               apps/ios/sneaky -> ../android (a directory symlink out of one write set)
hook_fixture_step() {
  local repo="$1" step="$2"
  case "$step" in
    start)
      jq -nc --arg cwd "$repo" '{session_id: "fixture-session", cwd: $cwd, hook_event_name: "SessionStart", source: "startup"}' |
        CLAUDE_PROJECT_DIR="$repo" "$DOCS_CHECK_REPO_ROOT/scripts/hooks/session-start.sh" >/dev/null
      ;;
    edit-source) printf 'export const more = 2;\n' >>"$repo/apps/api/src/app.ts" ;;
    edit-progress) printf -- '- progress line\n' >>"$repo/PROGRESS.md" ;;
    edit-rules) printf 'More.\n' >>"$repo/.claude/rules/r.md" ;;
    commit) git -C "$repo" add -A && git -C "$repo" "${HOOK_FIXTURE_GITC[@]}" commit -q -m step ;;
    worktree) git -C "$repo" worktree add -q -b wt "$repo/.claude/worktrees/wt" ;;
    edit-worktree-source) printf 'export const wt = 3;\n' >>"$repo/.claude/worktrees/wt/apps/api/src/app.ts" ;;
    symlink) mkdir -p "$repo/apps/ios" && ln -s ../android "$repo/apps/ios/sneaky" ;;
    *) echo "unknown setup step '$step'" >&2; return 1 ;;
  esac
}

# hook_fixture_nojq_bin DIR — a PATH directory with the tools the hooks use, minus jq.
hook_fixture_nojq_bin() {
  local dir="$1" tool
  mkdir -p "$dir"
  for tool in bash cat env git dirname basename sed awk mkdir sort tr; do
    ln -s "$(command -v "$tool")" "$dir/$tool"
  done
}

# hook_fixture_decision OUTPUT -> allow | deny | ask | block | invalid
hook_fixture_decision() {
  local d
  [[ -z "$1" ]] && { echo allow; return; }
  d="$(jq -r '.hookSpecificOutput.permissionDecision // .decision // "allow"' <<<"$1" 2>/dev/null | head -n1)"
  echo "${d:-invalid}"
}

# run_hook_fixtures FIXTURE_DIR STAGE_DIR — replay every README row; 1 if any case failed.
run_hook_fixtures() {
  local dir="$1" stage="$2" failures=0 row name script expected json case_dir run_path out decision step f
  local setup nojq harness_read
  local -a names args
  if ! command -v jq >/dev/null 2>&1; then
    echo "FAIL  hooks: jq is required to replay the hook fixtures" >&2
    return 1
  fi
  mkdir -p "$stage"
  if ! hook_fixture_template "$stage/template" >/dev/null 2>&1; then
    echo "FAIL  hooks: could not build the template checkout" >&2
    return 1
  fi
  hook_fixture_nojq_bin "$stage/nojq-bin"

  # Cases without setup steps never change their checkout, so they share one copy.
  mkdir -p "$stage/shared/scratch"
  cp -R "$stage/template" "$stage/shared/repo"

  names=()
  while IFS= read -r row <&3; do
    { read -r name; read -r script; read -r expected; } <<<"$(md_table_cells "$row")"
    name="${name//\`/}"
    script="${script//\`/}"
    [[ -n "$name" && "$name" == *.json ]] || continue
    names+=("$name")
    if [[ ! -f "$dir/$name" || ! -x "$DOCS_CHECK_REPO_ROOT/scripts/hooks/$script" ]]; then
      echo "FAIL  hooks/$name: README row names a missing payload or hook script '$script'" >&2
      failures=$((failures + 1))
      continue
    fi
    # One jq call: line 1 = "<setup steps>|<nojq>", then one line per exec-form arg.
    args=() setup="" nojq=false harness_read=""
    while IFS= read -r f; do
      if [[ -z "$harness_read" ]]; then
        setup="${f%|*}" nojq="${f##*|}" harness_read=1
      elif [[ -n "$f" ]]; then
        args+=("$f")
      fi
    done <<<"$(jq -r '((._harness.setup // "") + "|" + ((._harness.nojq // false) | tostring)), (._harness.args[]? // empty)' "$dir/$name")"

    case_dir="$stage/shared"
    if [[ -n "$setup" ]]; then
      case_dir="$stage/${name%.json}"
      mkdir -p "$case_dir/scratch"
      cp -R "$stage/template" "$case_dir/repo"
    fi
    json="$(cat "$dir/$name")"
    json="${json//"$HOOK_FIXTURE_SCRATCH"/$case_dir/scratch}"
    json="${json//"$HOOK_FIXTURE_REPO"/$case_dir/repo}"

    for step in $setup; do
      if ! hook_fixture_step "$case_dir/repo" "$step" >"$case_dir/setup.log" 2>&1; then
        echo "FAIL  hooks/$name: setup step '$step' failed: $(cat "$case_dir/setup.log")" >&2
        failures=$((failures + 1))
        continue 2
      fi
    done
    run_path="$PATH"
    [[ "$nojq" == "true" ]] && run_path="$stage/nojq-bin"

    out="$(cd "$case_dir/repo" && printf '%s' "$json" |
      env -u AGENT_MAY_EDIT_POLICY -u AGENT_SKIP_PROGRESS_GATE CLAUDE_PROJECT_DIR="$case_dir/repo" PATH="$run_path" \
        "$DOCS_CHECK_REPO_ROOT/scripts/hooks/$script" ${args[@]+"${args[@]}"} 2>"$stage/stderr")"
    decision="$(hook_fixture_decision "$out")"
    if [[ "$decision" == "$expected" ]]; then
      echo "ok    hooks/$name -> $decision"
    else
      echo "FAIL  hooks/$name: $script expected '$expected', got '$decision'" >&2
      [[ -n "$out" ]] && echo "      stdout: $out" >&2
      [[ -s "$stage/stderr" ]] && sed 's/^/      stderr: /' "$stage/stderr" >&2
      failures=$((failures + 1))
    fi
  done 3<<<"$(md_table_data_rows "$dir/README.md" 'Fixture')"

  for f in "$dir"/*.json; do
    name="$(basename "$f")"
    case " ${names[*]-} " in *" $name "*) ;; *)
      echo "FAIL  hooks/$name: no row in tools/docs/fixtures/hooks/README.md" >&2
      failures=$((failures + 1))
      ;;
    esac
  done
  [[ $failures -eq 0 ]]
}
