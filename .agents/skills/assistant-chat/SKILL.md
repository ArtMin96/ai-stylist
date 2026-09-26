---
name: assistant-chat
description: Design or build the `assistant` module's future chat adapter (apps/api/src/modules/assistant — a P02 skeleton today, real build gated at P15-T09) — conversation storage, tool-call orchestration, prompt/version registry, per-user limits, entitlement enforcement. Use when asked to add a chat tool schema, wire a conversation or message endpoint, design the P15-T08 tool contracts, or review whether assistant code bypasses an application service. The rule this skill enforces is that assistant calls only the public application services of profile, closet, context, recommendation, fashion-intel and billing (their `index.ts`) — no second recommendation engine, no direct table access, no forked business logic, and no `outfit` import (root CLAUDE.md; `assistant-app-services-only` and `allowed-edges-only` in `just arch-check`). Not for scoring, ranking, or constraint changes to outfit suggestions — use `recommendation-rules`; not for generic pg-boss job or worker plumbing — use `media-ml-pipeline`.
metadata:
  modules: assistant
  last-reviewed: 2026-09-26
  owner-agent: api-engineer
---

# Assistant Chat Module

## Trigger

- Any change inside `apps/api/src/modules/assistant/` — today an empty `@Module({})` skeleton (`apps/api/src/modules/assistant/index.ts`); real behaviour is gated behind the P15 chat build decision (`planning/phases/P15-post-launch-learning.md` §12, task P15-T09).
- Designing or reviewing a chat tool-contract schema (`get_profile`, `query_closet`, `resolve_context`, `request_recommendation`, `submit_feedback`, `query_trends`, `compose_outfit`, `check_entitlement` — P15 §7), before or after the gate.
- Reviewing a diff that touches `assistant` for a boundary violation: an import of another module's `internal/**`, a Drizzle schema, `drizzle-orm`, `packages/db`, `apps/api/src/platform/**`, or a module outside its six allowed edges.
- Do first, then return: `api-contract-change` (tool-contract schemas and conversation endpoints live in `packages/contracts`, single-writer).

## Required reading

1. `docs/modules/assistant.md` — status (skeleton), invariants, allowed dependencies; the contract wins over this skill if they disagree.
2. `planning/phases/P15-post-launch-learning.md` §6 (assistant is "Adapter only"), §7 (tool contracts, endpoints, `conversations`/`messages`/`prompt_versions` tables), §12 tasks P15-T08 to P15-T12.
3. `tools/depcruise/rules.cjs` — `assistant-app-services-only` (no `internal/**`, `platform`, `packages/db`, `drizzle-orm`, `schema.ts`) and `ALLOWED_EDGES.assistant`: `profile`, `closet`, `context`, `recommendation`, `fashion-intel`, `billing`. `outfit` is not on the list; doc 04 §4.1 draws no `assistant → outfit` edge.
4. `planning/10-ai-usage-cost-and-evaluation.md` §2.9 — the chat seam: prompt/version registry, per-conversation token budget, tool-call limit, model routing table, the `chat.stylist` entitlement.
5. The `index.ts` of each of the six allowed modules — what is public there is all a tool call may reach.

## Workflow

1. State which phase you are in before writing anything. Unless P15-T09 (build/defer) is `DONE` in `planning/PROGRESS.md`, anything beyond schema design is speculative; say so in the report instead of building ahead of the gate.
2. Search before write:

   ```bash
   git ls-files apps/api/src/modules/assistant
   rg -n 'export' apps/api/src/modules/profile/index.ts apps/api/src/modules/closet/index.ts apps/api/src/modules/context/index.ts apps/api/src/modules/recommendation/index.ts apps/api/src/modules/fashion-intel/index.ts apps/api/src/modules/billing/index.ts
   rg -n -i 'tool|conversation|prompt_version|chat' packages/contracts packages/shared-kernel/registry
   ```

3. Tool schema: define typed input/output and an authorization scope in `packages/contracts` via `api-contract-change`, one schema per tool (P15 §7), before any `assistant` code. Copy the file layout of `packages/contracts/openapi/modules/platform.yaml`.
4. Module code: every tool handler is a thin adapter — parse the tool input, call the owning module's already-public application service, map the result. Copy the thin-adapter shape of `apps/api/src/platform/version.controller.ts` (`@Inject(TOKEN)` on every constructor parameter). If the capability is not exported from the owning module's `index.ts`, that is a gap in that module's contract: route it to that module's skill, never reach around it.
5. `compose_outfit` (P15 §7) needs outfit composition, but `assistant` may not import `outfit`. Reach it only through `recommendation`'s public service, or stop for an ADR + DEC that adds the edge.
6. Conversation storage (`conversations`, `messages`, `prompt_versions`, `assistant_usage`, P15 §7) is owned by `assistant` once built; no other module reads those tables. Its schema goes through `db-migration`.
7. Model calls go through an LLM port designed per doc 10 §2.9, declared in this module's `index.ts` and implemented in `apps/api/src/platform/`. Each call needs its own doc-10 entry (schema, cost/latency budget, cache key, fallback, eval) before it ships. No LLM port exists in code yet.
8. Tests in `apps/api/src/modules/assistant/tests/`; today only `apps/api/src/modules/assistant/tests/assistant.smoke.test.ts` — extend it, do not replace it.

## Validation commands

```bash
just test assistant
just lint && just typecheck && just arch-check   # arch-check runs assistant-app-services-only + allowed-edges-only
just generate --check                            # only if a tool-contract schema changed
just ci-parity                                   # before PR
```

## Output

- A diff scoped to `apps/api/src/modules/assistant/` (plus `packages/contracts` in its own commit when a tool schema changed), with real test output and a stated answer to "did this land before or after the P15-T09 gate". Report in the `agent-operating-contract` format.

Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green · nothing imported from `internal/**`, a Drizzle schema, `packages/db`, `platform`, or `outfit` · every tool call resolves to an existing public service of an allowed module · `docs/modules/assistant.md` updated when the surface or status changed.

## Stop / escalation

- Building real chat behaviour (tables, streaming endpoints, model calls) before P15-T09's decision → stop; only design work is unconditional.
- A tool needs data or a mutation no allowed module exposes publicly → a gap in that module's contract; route it to that module's skill (`backend-module`, `recommendation-rules`, `fashion-intel-ingestion`, `entitlements-billing`).
- A tool needs `outfit` directly (e.g. `compose_outfit`) → no `assistant → outfit` edge in doc 04 §4.1 or `ALLOWED_EDGES`; ADR + DEC before any code.
- Any scoring, ranking, or constraint rule inside `assistant` "just for chat" → a second recommendation engine; it belongs in `recommendation-rules`, or nowhere.
- Conversation content is user-generated and sensitive (S2/S3 per P15 §10): consent, deletion cascade, retention → `data-lifecycle`, then `security-privacy-review` before PR.

## Overlap

Adjacent: `api-contract-change` (tool schemas and conversation endpoints first), `backend-module` (owns `profile`, `closet`, `context`, where a missing public export gets added), `recommendation-rules` (owns all scoring and the service `assistant` calls for outfits), `fashion-intel-ingestion` (owns the feed query behind `query_trends`), `entitlements-billing` (owns `check_entitlement` data and `chat.stylist`), `media-ml-pipeline` (job plumbing behind a provider call), `data-lifecycle` / `security-privacy-review` (conversation deletion and review before ship). This skill owns only `apps/api/src/modules/assistant/**` and the assistant side of the tool contracts.
