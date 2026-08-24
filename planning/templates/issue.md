# Issue — <Short title>

- **Phase / task:** P##-T## (from `phases/P##-….md`)
- **Requirements:** REQ/NFR IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md)
- **Owning module(s):** <per [SPINE §3](../SPINE.md)>
- **Type:** feature | bug | spike | chore

## Scope

<What changes, in 2–5 sentences. For bugs: observed vs expected behavior + reproduction steps.>

## Non-goals

<Explicitly out of scope; link to where deferred work is tracked.>

## Dependencies

<Blocking issues/phases/decisions (OQ-NN, DEC-NN) — or "None".>

## Acceptance criteria

Objectively verifiable; each maps to at least one test.

- [ ] AC-1: <…>
- [ ] AC-2: <…>

## Test plan

- Levels + location (module `tests/` dir): <…>
- For bugs: regression test that fails before the fix.

## Observability

<Logs/metrics/events added or updated; redaction checked — or "None needed" with reason.>

## Rollout

<Feature flag (owner + expiry) / migration order / staged release — or "Direct".>

## Rollback

<Exact revert path: flag off, migration down, revert PR — or "Simple revert".>
