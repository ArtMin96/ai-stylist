---
name: cross-platform-feature
description: Build one client feature on both native apps from the main (lead) session — preflight, one brief with a parity table, an optional contract lane, then ios-engineer and android-engineer launched together in separate git worktrees (plus api-engineer in the lead checkout when endpoint behaviour is needed), base-SHA checks, integration, a parity review with exact rg and git diff commands, architecture review, the shared Maestro flow, gates and close-out. Use when the user says "implement <feature> on iOS and Android", "build X on both apps", "ship this screen on both platforms", "add the same feature to iOS and Android", or asks to plan, split, launch, merge or reconcile parallel iOS and Android work. Not for a change on one platform only — use `ios-feature` or `android-feature`; not for the contract change itself — use `api-contract-change`; not for server-side work alone — use `backend-module`; not for reviewing a finished diff for boundaries — use `architecture-review`.
argument-hint: '[feature description]'
metadata:
  modules:
  last-reviewed: 2026-09-26
  owner-agent: main-session
---

# Cross-Platform Feature (main-session orchestration)

## Trigger

- The user asks the main session to build, implement or ship one feature on both `apps/ios` and
  `apps/android`. The argument is the feature description.
- The lead plans, launches, integrates or reconciles parallel iOS and Android lanes, or the two
  apps disagree on states, copy, ids, events or error handling.
- Main session only: this flow calls the Agent tool, commits (with permission) and integrates
  worktrees, and no project agent has the Agent tool. Without the Agent tool, follow "Fallback"
  under Stop / escalation.
- Not this skill: one platform (`ios-feature` / `android-feature`); the wire shape alone
  (`api-contract-change`, which runs here as the contract lane); server work alone
  (`backend-module`).

## Required reading

1. Root `CLAUDE.md` "Parallel sessions" and `.claude/agents/README.md` (roster, write sets, the
   parallel-work model).
2. `.agents/skills/agent-operating-contract/SKILL.md`: the base check and the report every lane
   returns.
3. `planning/02-user-journeys-and-information-architecture.md` §1.1 (state coverage rule), §2.1
   (top-level navigation) and the journey's own States subsection; the current phase file;
   `PROGRESS.md`.
4. `.agents/skills/ios-feature/SKILL.md` and `.agents/skills/android-feature/SKILL.md`: the lane
   workflows, sibling files and self-review lists.
5. `.agents/skills/cross-platform-feature/references/brief-template.md`: the brief you fill.
6. `e2e/smoke.yaml`, `e2e/README.md`, `packages/contracts/events/analytics/events.json`,
   `packages/contracts/openapi/modules/`, `packages/shared-kernel/registry/`.

## Workflow

1. **Preflight (lead, before anything else).**

   ```bash
   git status --porcelain                                        # note dirty paths; lanes never see them
   git branch --show-current && git rev-parse HEAD
   jq -r '.worktree.baseRef // "unset"' .claude/settings.json    # must print: head
   test -d node_modules && echo node_modules-present             # contract lane, API lane and gates need it
   ```

   - `baseRef` is not `head` → stop: worktrees would branch from origin/HEAD (a stale `main`).
   - Dirty paths unrelated to the feature stay as they are; never stage them.
   - Ask the human once, in one message: "May I create local branch `feat/<slug>` from HEAD, commit
     the brief, contract and generated clients there, and commit and merge each lane into it?
     Nothing is pushed." The answer picks the integration mode in step 7.

2. **Search, then write the brief.** Find what exists before naming anything new:

   ```bash
   rg -n -i '<noun>|<synonym>' apps/ios/Packages apps/android/feature apps/android/core packages/contracts/openapi
   rg -n 'operationId:' packages/contracts/openapi/modules
   jq -r '.events[].name' packages/contracts/events/analytics/events.json
   jq -r '.codes | keys[]' packages/shared-kernel/registry/reason-codes.json
   jq -r '.entitlements | keys[]' packages/shared-kernel/registry/entitlements.json
   ```

   Fill `.agents/skills/cross-platform-feature/references/brief-template.md` into `.claude/plans/<yyyy-mm-dd>-<slug>-brief.md`. Every
   row is concrete: states and triggers, exact strings, ids (iOS `accessibilityIdentifier` equals
   Android `testTag`, same literal), `events.json` names, generated operationIds, failure → state,
   entry point, kernel wiring, lanes and files. Platform idioms may differ; behaviour, copy, ids
   and events may not. Anything unknown → ask the human before launching anyone.
   - Entry point: the only screen today is Home (`apps/ios/App/AIStylistApp.swift`,
     `apps/android/app/src/main/kotlin/app/aistylist/app/MainActivity.kt`), and neither app has a
     navigation shell. A second screen → stop and sequence a nav-shell task on both apps first
     (Android needs a navigation dependency, which only the human grants).
   - Registry values (reason codes, entitlements, units): the apps import the generated
     `AIStylistKernel` (Swift) and `app.aistylist.contracts.kernel` (Kotlin) from
     `packages/shared-kernel/registry/*.json` (DEC-55, ADR-0005). No app target consumes them yet,
     so the brief fixes the wiring once for both lanes (template "Contract" section).

3. **Contract lane (only when an operation, field, event or registry entry is missing or
   changes).** Launch `contracts-engineer` alone in the lead checkout (no isolation; it needs
   `node_modules`) with the brief and the exact change. Nothing else runs meanwhile:
   `packages/contracts` and `packages/shared-kernel` are single-writer. Then verify:

   ```bash
   just generate --check                      # exit 0: every generated client matches the contract
   git status --porcelain -- packages         # contract source and generated output, nothing else
   ```

4. **Fix the base.** Worktrees contain only committed state.
   - The human said yes: create the branch, then commit the brief plus anything the lanes need
     that is uncommitted (contract source, generated clients):

     ```bash
     git switch -c feat/<slug>                              # skip if already on it
     git add -- <brief> <contract source> <generated paths> # by name, never -A
     git commit -m "feat(<scope>): brief and contract for <slug>"
     ```

   - The human said no and the lanes need uncommitted files → no worktrees: run the native lanes
     one after the other in the lead checkout (iOS, then Android), no isolation, and skip step 7.
   - The human said no and the lanes need nothing uncommitted → worktrees from HEAD; step 7 uses
     patch mode.
   - Then `BASE=$(git rev-parse HEAD)`. Every lane prompt starts with `Base: <BASE>`.

5. **Launch the lanes in one message** (all Agent calls together). The lead edits nothing while
   they run.

   | Lane                              | `subagent_type`    | `isolation`               | Scope                        | Runs                                      |
   | --------------------------------- | ------------------ | ------------------------- | ---------------------------- | ----------------------------------------- |
   | iOS                               | `ios-engineer`     | `"worktree"`              | `apps/ios/**`                | `just ios-check`, `just test ios`         |
   | Android                           | `android-engineer` | `"worktree"`              | `apps/android/**`            | `just android-check`, `just test android` |
   | API (only for endpoint behaviour) | owning engineer    | none (needs node_modules) | its module under `apps/api/` | its agent's Verification block            |

   The owning API engineer comes from the module table in `.agents/skills/README.md`. Prompt
   skeleton, one per lane (paths, not pasted docs):

   ```
   <feature> — <iOS|Android> lane. Base: <BASE>
   First command: git log -1 --format='%H %s'. If it is not Base, stop BLOCKED.
   Brief (the only parity source; never read the other app's sources):
   <brief pasted verbatim>
   Scope: apps/ios/** only. Files expected: <list>. Sibling to copy: <paths from the brief>.
   Run only: just ios-check, just test ios. Put just generate --check, just lint, just typecheck,
   just arch-check, just docs-check, just ci-parity under Not run (the lead runs them after integration).
   Report: the agent-operating-contract format, with the Parity block.
   ```

   A large feature splits per platform into sequential lanes (data layer, then screen): integrate
   and commit the first pair, take a new `BASE`, then launch the next pair.

6. **Check each report before integrating.**
   - `Base:` equals `BASE` and the status is DONE; PARTIAL or BLOCKED → resolve its `Blockers:`
     first.
   - The worktree path comes from the Agent result or the report's `Worktree:` line
     (`git worktree list` shows its branch). Every changed path must be inside the lane scope:

     ```bash
     git -C <wt> status --porcelain | rg -v '^.. apps/ios/'       # Android lane: apps/android/
     ```

     Any output → do not integrate that lane; relaunch it with the stray paths named.

   - Compare the two Parity blocks line by line with each other and with the brief. A mismatch
     goes back to the owning lane (step 9).

7. **Integrate** (lead checkout, on `feat/<slug>`), one lane at a time.

   ```bash
   # with commit permission
   git -C <wt> add -- apps/ios                      # the lane scope only
   git -C <wt> commit -m "feat(ios): <slug>"
   git merge --no-ff <wt-branch>
   git worktree remove <wt>
   # without commit permission (patch mode)
   git -C <wt> add -A                               # step 6 proved every path is in scope
   git -C <wt> diff --cached --binary <BASE> > <scratchpad>/ios.patch
   git apply --3way <scratchpad>/ios.patch
   git worktree remove --force <wt>                 # prompts the human: the worktree still holds the change
   ```

   A merge or `--3way` conflict → stop, show it, ask. Lane branches stay (deleting a branch is
   human-only).

8. **Parity review on the integrated tree.** Both apps are now in one tree. Each pair must match
   the brief; write the results into a parity note (item → iOS → Android → match or fix).

   ```bash
   git diff <BASE> --stat -- apps/ios apps/android && git status --porcelain -- apps
   # ids: accessibilityIdentifier (iOS) == testTag (Android)
   rg -o --no-filename -r '$1' 'accessibilityIdentifier\("([^"]+)"\)' apps/ios/Packages/Features/Sources | sort -u
   rg -o --no-filename -r '$1' '(?:testTag\(|const val [A-Z_]+: String = )"([^"]+)"' apps/android/feature | sort -u
   # generated client operations
   rg -o --no-filename -r '$1' 'client\.([a-z][A-Za-z0-9]+)\(' apps/ios/Packages/Core/Sources/APIData | sort -u
   rg -o --no-filename -r '$1' 'api\.([a-z][A-Za-z0-9]+)\(' apps/android/core/data/src/main | sort -u
   # analytics: iOS names are hand-written and must equal events.json byte for byte; Android is generated
   jq -r '.events[].name' packages/contracts/events/analytics/events.json
   rg -o --no-filename -r '$1' 'name: "([^"]+)"' apps/ios/Packages/Core/Sources/Analytics | sort -u
   rg -o --no-filename -r '$1' 'AnalyticsTaxonomy\.([A-Za-z]+)\.NAME' apps/android --glob '!**/src/test/**' | sort -u
   # every brief string (one per line in <scratchpad>/brief-strings.txt) exists on both apps
   while IFS= read -r s; do printf '%s\tios=%s\tandroid=%s\n' "$s" "$(rg -F -l -- "$s" apps/ios/Packages | wc -l | tr -d ' ')" "$(rg -F -l -- "$s" apps/android | wc -l | tr -d ' ')"; done < <scratchpad>/brief-strings.txt
   ```

   Then read, side by side: the iOS `*Model` state enum and the Android `*UiState`, each error →
   state mapping, where logic lives (model target / ViewModel, never a business rule in either
   client), and the tests (`apps/ios/Packages/Features/tests/`, the feature module's
   src/test/kotlin). A count of 0 in the string loop, or any unmatched id, operation or event,
   is a mismatch. Known gap today: iOS `consent-toggle` and `retry-button` have no Android
   `testTag` (`HomeTestTags` holds only `api-version` and `api-error`); a feature that touches
   Home closes it or records it under "Intended differences".

9. **Review and fix.** Launch `architecture-reviewer` in the lead checkout on
   `git diff <BASE>` plus untracked files, stating "both apps in scope: include the parity lens".
   In the same message launch `security-privacy-reviewer` when the feature touches consent, auth,
   tokens, analytics payloads or sensitive data. Each fix goes to the owning engineer in the lead
   checkout with no isolation, one write agent at a time (or both in new worktrees from a newly
   committed `BASE`). A platform limitation that blocks parity → write it under "Intended
   differences" in the brief; the human accepts it.
10. **Shared e2e, once.** After both apps render the brief's strings and ids, launch
    `test-engineer` in the lead checkout with the brief to extend `e2e/` once
    (`e2e-device-testing`), never a per-platform copy. It runs `just ios-e2e e2e/<flow>.yaml` (Mac
    with a simulator) and `just android-e2e e2e/<flow>.yaml` (running emulator) or reports them as
    not run. No CI workflow runs Maestro, so a CI run is never e2e evidence.
11. **Gates** in the lead checkout (Validation commands). Record each result.
12. **Close-out.** After every code lane has finished, launch `docs-maintainer` with every report's
    `Suggested PROGRESS.md line` (never in the same wave as an engineer editing `docs/modules/**`).
    Ask the human before any push, PR or merge.

Never: copy constants between the apps or from `packages/shared-kernel` into Swift or Kotlin
(error codes, IDs and the event envelope are TS-only; a native need for one is a contract-lane
question); fork business rules into the clients; hand-edit `packages/contracts/gen/`; let two
write agents share a working tree; widen a lane's scope mid-run; add 3D (none in the native apps;
the future path is Filament behind an ADR).

## Validation commands

```bash
just generate --check                        # contract and all generated clients in sync
just lint && just typecheck && just arch-check
just ios-check                               # Linux: lint, format, bans, package tests; macOS adds the simulator build + tests
just ios-build --config dev && just ios-test # macOS only; otherwise "Not run: no Mac"
just android-check                           # Spotless, module graph, detekt, Lint, tests, APKs
just ios-e2e e2e/<flow>.yaml                 # Mac + simulator, after step 10
just android-e2e e2e/<flow>.yaml             # running emulator, after step 10
just docs-check                              # after close-out
just ci-parity                               # the PR gate, before asking to open a PR
```

## Output

The lead's final message to the user: the brief path, `BASE`, one row per lane (agent, worktree,
status, integration commit or patch), the parity note, the reviewer verdicts, each gate with its
real result, everything under `Not run:` with the reason, and the next human action (push, PR,
nav-shell grant, Mac or emulator run).

Done checklist: preflight done and `baseRef` is `head` · brief written before any lane · contract
lane alone and first · every lane's `Base:` equals `BASE` · lane scopes disjoint and verified ·
parity note from the step 8 commands · architecture review on the integrated diff · e2e extended
once, after both apps · gates recorded honestly · `docs-maintainer` close-out · nothing pushed
without the human.

## Stop / escalation

- **Fallback — you cannot call the Agent tool** (you are a subagent): never build both apps in one
  tree. Fill the brief, write both lane prompts, return them as BLOCKED "needs the main session to
  launch lanes", and stop.
- `.claude/settings.json` has no `"worktree": {"baseRef": "head"}` → stop; the human applies it.
- A report's `Base:` differs from `BASE`, or a worktree changed paths outside its lane → do not
  integrate it; relaunch with the problem named.
- The two apps need different contracts → stop; redesign the shared contract with
  `api-contract-change`.
- A lane needs a file outside its scope (`packages/**`, `e2e/**`, `justfile`, `.github/**`) → the
  lead sequences that change with its owner; never widen a lane mid-run.
- A needed value is not in `packages/shared-kernel/registry/` → contract lane first. An error
  code, ID or envelope field in native code → stop; a human decides (DEC-55 keeps them TS-only).
- A second screen and no navigation shell → nav-shell task first on both apps; the Android
  navigation dependency needs the human's grant.
- A merge or `git apply --3way` conflict → stop and show it.
- Parity impossible because of a platform limitation → "Intended differences" in the brief; the
  human accepts it.
- Anything 3D → stop; 3D is deferred for the native apps.

## Overlap

Adjacent: `ios-feature` and `android-feature` (the lane workflows; the brief and this parity review
win over either lane's reading), `api-contract-change` (the contract lane, always first),
`backend-module` (the API lane), `agent-operating-contract` (base check and report every lane
follows), `architecture-review` and `security-privacy-review` (their lenses on the integrated diff;
this skill adds parity), `e2e-device-testing` (the shared flow, run once by `test-engineer`),
`docs-maintenance` (close-out), `release-readiness` (both artifacts from one commit). This skill
owns the brief (`.claude/plans/<yyyy-mm-dd>-<slug>-brief.md`) and the integration; it owns no source
path.
