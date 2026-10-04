---
name: code-quality
description: Write and self-review clean, idiomatic code in the language of the file being touched — Swift 6/SwiftUI (apps/ios), Kotlin/Compose (apps/android), TypeScript/NestJS (apps/api, packages, tools), Python/FastAPI (workers), and bash (scripts) — with a language lock so one language's idioms are never applied to another. Use for every code edit or code review in this repo, and whenever a user asks for "clean code", "best practices", "idiomatic", "refactor for readability", "code smell", "naming", "too complex", "is this good Swift/Kotlin/TypeScript/Python", or a lint, detekt, SwiftLint, swift-format, ruff, basedpyright or shellcheck finding. Load it next to the area skill, not instead of it. Not for module boundaries, duplication or source-of-truth drift — use `architecture-review`; not for security or privacy findings — use `security-privacy-review`; not for changing a lint or format gate itself — use `tooling-ci`; not for speed or memory work — use `performance-profiling`.
metadata:
  modules:
  last-reviewed: 2026-10-04
  owner-agent: ios-engineer, android-engineer, api-engineer, platform-engineer, recommendation-engineer, contracts-engineer, ml-engineer, tooling-engineer, test-engineer, architecture-reviewer
---

# Code Quality

The quality bar for every line of code in this repo, split by language. The area skill
(`ios-feature`, `backend-module`, …) says _what_ to build and _where_; this skill says _how the code
itself should read_. Both apply to the same edit.

The bar has three layers, in order of authority:

1. **Gates** — the linters, formatters, type checkers and compilers wired into `just`. They are
   mechanical, they run in CI on every PR, and they do not drift. If a gate and this skill disagree,
   the gate wins and the disagreement is reported (see Stop / escalation).
2. **Repo convention** — what the nearest sibling file already does. Consistency inside one codebase
   is worth more than any external style guide.
3. **The language reference** in the references directory — idioms and judgement calls the gates cannot see.

## Trigger

- Any edit to a source file: `.swift`, `.kt`/`.kts`, `.ts`/`.mts`/`.mjs`/`.cjs`, `.py`, `.sh`.
- Any review of a diff or PR, alongside `architecture-review` (boundaries) and
  `security-privacy-review` (data handling).
- A request for clean, idiomatic, readable or "best practice" code; a refactor for readability; a
  question such as "is this idiomatic Kotlin?".
- A finding from swift-format, SwiftLint, ktlint, detekt, Android Lint, ESLint, `tsc`, Ruff,
  basedpyright or shellcheck.
- Not this skill: where code may live or what it may import (`architecture-review`); whether data
  handling is safe (`security-privacy-review`); changing a gate's configuration (`tooling-ci`);
  measured performance work (`performance-profiling`).

## Required reading

1. The language reference for each file you touch — and **only** that one (the language lock below):

   | File                                                                                 | Language                                     | Reference                                              |
   | ------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------ |
   | `apps/ios/**/*.swift`                                                                | Swift 6 + SwiftUI                            | `.agents/skills/code-quality/references/swift.md`      |
   | `apps/android/**/*.kt`, `apps/android/**/*.kts`                                      | Kotlin + Jetpack Compose + Gradle Kotlin DSL | `.agents/skills/code-quality/references/kotlin.md`     |
   | `apps/api/**/*.ts`, `packages/**/*.ts`, `tools/**/*.{ts,mjs,cjs}`, root `*.mjs`      | TypeScript (NestJS on Fastify, Node ESM)     | `.agents/skills/code-quality/references/typescript.md` |
   | `workers/**/*.py`                                                                    | Python 3.14 + FastAPI                        | `.agents/skills/code-quality/references/python.md`     |
   | `scripts/**/*.sh`, `tools/**/*.sh`, `apps/*/scripts/*.sh`, `apps/android/tools/*.sh` | bash                                         | `.agents/skills/code-quality/references/shell.md`      |

   Generated trees (`packages/contracts/gen/**`, `packages/shared-kernel/src/gen/**`,
   `workers/ml/generated/**`) are never hand-edited, so no reference applies to them; fix the source
   or the generator instead.

2. The nearest sibling file of the same kind (the area skill names it). Read it whole before writing.
3. The gate config for that language, named at the top of its reference, when a finding surprises you.

## Workflow

### The language lock

A practice is good _in a language_, not in general. Most bad "best practice" advice is a correct idiom
moved to the wrong language: a Kotlin `Result` wrapper in Swift that already has typed `throws`, a
TypeScript `I`-prefixed interface in Swift, a Python `Optional[...]` habit in TypeScript, Java getters
in Kotlin, a JavaScript `.forEach` in Swift. The lock prevents that:

- Identify each file's language from the table above before writing or reviewing it.
- Apply and cite only that language's reference. A finding on a `.swift` file never cites
  `kotlin.md`, and a suggestion for a `.ts` file never says "like we do in Python".
- In a mixed-language diff, handle each file on its own with its own reference. Cross-platform
  _parity_ (same behaviour, same strings, same reason codes on iOS and Android) is a product
  requirement owned by `cross-platform-feature`; it never means the same code shape. Each platform
  implements the behaviour in its own idiom.
- Each reference ends with a "Do not import from other languages" list: the false friends that most
  often leak into that language. Check it before you submit.
- When unsure whether something is idiomatic in that language, look at the repo's own code in that
  language first, then the language's official documentation (see Stop / escalation). Never reason
  "language X does it this way, so this language should too".

### Writing

1. **Restate the intent** in one sentence: the behaviour, not the name. Search before write (the
   `agent-operating-contract` skill) runs first; this skill does not repeat it.
2. **Copy the sibling's shape**: file layout, naming, error style, test style. Diverge only when the
   sibling breaks a rule in the reference, and say so in the report.
3. **Write the smallest clear version**, holding these language-neutral principles. Each reference
   says how they look in its language:
   - _Names reveal intent._ A reader understands what a function does and returns from its signature.
     No abbreviations beyond the language's own conventions, no type-in-name noise.
   - _One reason to change per unit._ A function does one thing at one level of abstraction; a type
     owns one concept. Split when a name needs "and".
   - _Make illegal states unrepresentable._ Prefer closed types (enums, sealed types, discriminated
     unions, `Literal`) over booleans and nullable fields that must agree with each other.
   - _Handle errors where you can act on them._ Never swallow, never log-and-rethrow the same error,
     never catch the broadest error type to keep going.
   - _No magic values._ Shared constants, units, reason codes and entitlement names come from
     `packages/shared-kernel` or the generated clients (root `CLAUDE.md`, "Single source of truth");
     local constants get a name.
   - _Immutability by default._ Mutate only what must change, in the narrowest scope.
   - _Comments say why, not what._ Explain a non-obvious decision, an invariant or a link to the
     doc that decides it. Delete comments that restate the code; never leave commented-out code.
   - _No speculative generality._ No interface with one implementation unless it is a port the
     architecture requires, no parameters "for later", no unused code.
   - _Early exit over nesting._ Guard the edge cases first; keep the happy path at the left margin.
4. **Self-review with the reference checklist** before running anything. Fix what you find; do not
   leave it for the gate.
5. **Run the gates** (Validation commands). Fix each finding at its cause. A suppression is the last
   resort and follows the policy below.

### Reviewing

1. Run the language gates first, so the review spends attention only on what tools cannot see.
2. Read each file against its own reference only. Group findings by file, and give each one:
   severity (`blocker` breaks a gate, a reference rule or correctness; `should` hurts readability or
   maintainability; `nit` is taste within the rules), `file:line`, the reference section it comes
   from, and a concrete rewrite in that same language.
3. Do not raise a finding that only restates a gate's job (formatting, import order): the gate reports
   it with less noise. Do not raise one that imports another language's idiom.

### Suppression policy (all languages)

A suppression hides a gate finding forever, so it needs a reason a reviewer can check:

- Narrowest scope only: one line or one declaration, never a whole file or module.
- Name the exact rule and give the reason on the same line, in that language's syntax (each
  reference shows it). A suppression without a rule name or a reason is a `blocker` in review.
- Never suppress a safety rule to save time: force unwraps, unchecked `Sendable`, `!!`, `any`,
  floating promises, bare `except`, unquoted variables. Restructure the code instead.

### Gates only ratchet up

The gates are the long-term guarantee, so they only get stricter. Never relax a rule, raise a
threshold, add a baseline, widen an ignore list or turn warnings back into non-errors to make a change
pass. To propose a stricter rule (or a rule this skill keeps catching by hand), hand it to `tooling-ci`
(`tooling-engineer`) with the finding count it would add; the stricter rule lands with the fixes for
every existing finding in the same change.

## Validation commands

```bash
just lint-file <path>          # one file, the same dispatch the post-edit hook runs
just format --check            # formatters: Prettier, swift-format, Spotless/ktlint, Ruff format
just lint                      # ESLint, Ruff, shellcheck, SwiftLint, Android Lint, detekt
just typecheck                 # tsc and basedpyright
just test <module>             # behaviour still holds after a refactor
just ios-check                 # only if apps/ios changed (on Linux: lint, format, bans, package tests)
just android-check             # only if apps/android changed (Spotless, detekt, Lint, tests)
```

## Output

The code change itself, plus a `Code quality` line in the hand-back report (`agent-operating-contract`
format) naming the reference(s) applied and any suppression added with its reason. In review mode,
the findings list from Reviewing step 2.

Done checklist: each touched file matched to exactly one reference · reference checklist walked for
each file · no idiom from another language · no new suppression without rule name and reason · no
gate relaxed · `just format --check`, `just lint` and `just typecheck` green (or the language's own
check) · behaviour unchanged where the task was a refactor (tests green).

## Stop / escalation

- A gate rule and a reference rule conflict → follow the gate, and report the conflict with both
  texts; the human updates the reference (`.agents/**` is human-applied, `.claude/rules/agent-authoring.md`).
- A sibling file breaks a reference rule and matching it would spread the problem → write the new
  code to the reference, leave the sibling alone, and list it under "Noticed but not touched".
- Clean code would need a change outside your write set (a shared type, a generated client) → stop
  and hand back to the owner named in the area rule, with the exact change needed.
- You want a new lint rule, a raised strictness level or a new formatter option → hand it to
  `tooling-ci` (`tooling-engineer`); never edit gate config from this skill.
- The reference may be stale for a fast-moving API (Swift, SwiftUI, Kotlin, Compose, NestJS,
  FastAPI) → check the current official docs (context7 MCP or the vendor site), follow them, and
  report the stale line so a human can update the reference.

## Overlap

Adjacent: `architecture-review` (where code lives, what it imports, duplication; on a PR both run,
each in its own lane) · `security-privacy-review` (what data code touches and logs) · `tooling-ci`
(the gate configs: `apps/ios/.swiftlint.yml`, `apps/ios/.swift-format`,
`apps/android/config/detekt.yml`, `eslint.config.mjs`, `workers/pyproject.toml`) ·
`performance-profiling` (any claim that code is faster) · the area skills (`ios-feature`,
`android-feature`, `backend-module`, `recommendation-rules`, `media-ml-pipeline`, …), which own the
files and decide structure, while this skill decides line-level quality. On a conflict about
placement or layering, the area skill and `architecture-review` win. This skill owns no paths; it
owns the files under `.agents/skills/code-quality/`.
