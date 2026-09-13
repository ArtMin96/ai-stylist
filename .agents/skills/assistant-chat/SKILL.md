---
name: assistant-chat
description: Design or build the `assistant` module's future chat adapter (apps/api/src/modules/assistant — a P02 skeleton today, real build gated at P15) — conversation storage, tool-call orchestration, prompt/version registry, per-user limits, entitlement enforcement. Use when asked to add a chat tool schema, wire a conversation or message endpoint, design the P15-T08 tool contracts, or review whether assistant code is bypassing an application service. The binding rule this skill exists to enforce: assistant calls only the same public application services every other client uses (profile/closet/context/recommendation/fashion-intel/outfit/billing `index.ts`) — no second recommendation engine, no direct table access, no forked business logic (root CLAUDE.md; enforced by the `assistant-app-services-only` arch-check rule). Not for scoring, ranking, or constraint changes to outfit suggestions — use `recommendation-rules`; not for generic pg-boss job/worker plumbing — use `media-ml-pipeline`.

metadata:
  modules: assistant
  last-reviewed: 2026-09-13
  owner-agent: api-engineer
---

# Assistant Chat Module

## Trigger

- Any change inside `apps/api/src/modules/assistant/` — currently a `@Module({})` skeleton
  (`apps/api/src/modules/assistant/index.ts`) with no exports; real behaviour is gated behind the
  P15 chat build decision (`planning/phases/P15-post-launch-learning.md` §12, task P15-T09).
- Designing or reviewing a chat **tool-contract schema** (`get_profile`, `query_closet`,
  `resolve_context`, `request_recommendation`, `submit_feedback`, `query_trends`, `compose_outfit`,
  `check_entitlement` — P15 §7) before or after the gate passes.
- Reviewing a diff that touches `assistant` for a boundary violation — an import of another
  module's `internal/**`, a Drizzle schema, or `apps/api/src/platform/**` — the exact shape the
  `assistant-app-services-only` rule in `tools/depcruise/rules.cjs` forbids.
- Do first, then return here: `api-contract-change` (the tool-contract schemas and conversation
  endpoints live in `packages/contracts`, single-writer, before assistant code consumes them).

## Required reading

1. `docs/modules/assistant.md` — current status (skeleton), invariants, allowed/forbidden
   dependencies; this is the contract that wins over this skill if the two ever disagree.
2. `planning/phases/P15-post-launch-learning.md` §6 (module changes — assistant is explicitly
   "Adapter only"), §7 (tool-contract schemas, endpoints, `conversations`/`messages`/`prompt_versions`
   tables), §12 tasks P15-T08 through P15-T12 (design-always, gate, build 1, build 2, qualification).
3. Root `CLAUDE.md` architectural invariant: "`assistant` (future chat) only calls the same
   application services as every other client — no second recommendation engine, no direct table
   access, no forked business logic." This skill exists to keep that sentence true in code.
4. `tools/depcruise/rules.cjs` rule `assistant-app-services-only` — the enforced form of the same
   invariant: `apps/api/src/modules/assistant/` may not import any module's `internal/**`, a Drizzle
   schema, or `platform`.
5. `apps/api/src/modules/assistant/index.ts` and the `index.ts` of every module it is allowed to
   call (`profile`, `closet`, `context`, `recommendation`, `fashion-intel`, `outfit`, `billing`) —
   what is already public there is what a tool call is allowed to reach.

## Workflow

1. Confirm which phase state you are in before writing anything: P15-T09 (the chat build/defer
   decision) has not run yet in this repo as of this writing, so any behaviour beyond schema design
   is speculative — say so explicitly in your report rather than quietly building ahead of the gate.
2. For a tool schema: define input/output types and an authorization scope in `packages/contracts`
   (`api-contract-change` skill), one schema per tool per P15 §7, before touching `assistant` code.
3. For module code: every tool handler is a thin adapter — parse the tool-contract input, call the
   already-public application service of the owning module (never that module's `internal/**` or a
   table), map the result back to the tool-contract output. If the capability you need is not yet
   exported from the owning module's `index.ts`, that is a gap in the owning module's contract, not
   a reason to reach around it — stop and route that as a `backend-module` task on the owning module.
4. Conversation/message storage (`conversations`, `messages`, `prompt_versions`,
   `assistant_usage` per P15 §7) is owned by `assistant` itself once it exists; no other module reads
   those tables directly.
5. Model calls go through the same LLM chat port pattern described in
   `planning/10-ai-usage-cost-and-evaluation.md` §2.7 — cost/latency budget, cache key, fallback, and
   an eval, same as any other AI-backed capability (root `CLAUDE.md` "AI usage in product code").
6. Cross-module data needs are satisfied by an existing public export or a new one added to the
   owning module in its own PR — never by importing that module's `internal/**` from `assistant`,
   even temporarily "to get it working."
7. Tests in `apps/api/src/modules/assistant/tests/`; today that is the P02 smoke test that the
   module loads (`docs/modules/assistant.md`) — extend it, do not replace it, until real behaviour
   lands.

## Validation commands

```bash
just test assistant
just lint && just typecheck && just arch-check   # arch-check runs assistant-app-services-only
just generate --check                             # only if a tool-contract schema changed
just ci-parity                                    # before PR
```

## Output

- A diff scoped to `apps/api/src/modules/assistant/` (plus `packages/contracts` when a tool schema
  changed, in its own commit/PR per the contract-first rule), with real test output; a stated
  answer to "did this land before or after the P15-T09 build gate" in the report.

Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green (no
`assistant-app-services-only` violation) · nothing imported from another module's `internal/**`, a
Drizzle schema, or `platform` · every tool call resolves to an existing public application service ·
`docs/modules/assistant.md` updated when the public surface or status changed.

## Stop / escalation

- A tool needs data or a mutation that no module currently exposes publicly → this is a gap in the
  owning module's contract; stop and route to `backend-module` for that module, not a workaround
  inside `assistant`.
- Any temptation to add a scoring, ranking, or constraint rule inside `assistant` "just for chat" →
  that is a second recommendation engine; stop — it belongs in `recommendation-rules` (or nowhere,
  if the engine already produces what is needed).
- Conversation/message content is user-generated and sensitive (S2/S3 per P15 §10): consent,
  deletion-cascade, and retention design → `security-privacy-review` before PR.
- Building real chat behaviour before P15-T09's build/defer decision has run → stop; the phase file
  is explicit that only design work is unconditional.

## Overlap

Adjacent: `api-contract-change` (tool-contract schemas and conversation endpoints are contract work
first), `backend-module` (owns every module `assistant` calls into — `profile`, `closet`, `context`,
`outfit`, `billing` — and is where a missing public export gets added), `recommendation-rules`
(owns all scoring/ranking; `assistant` only ever calls its existing public service),
`fashion-intel-ingestion` (owns the trend/feed data `assistant` may query via `query_trends`),
`media-ml-pipeline` (owns the LLM port implementation and job plumbing behind the chat provider),
`security-privacy-review` (reviews conversation storage and deletion before ship). This skill owns
only `apps/api/src/modules/assistant/` and the assistant-side half of its tool-contract usage.
