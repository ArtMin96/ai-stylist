# `avatar` — module reference

Last reviewed: 2026-09-13

## Contract summary

Parametric avatar parameters, calibration, poses, and avatar asset versions. Full contract:
[`docs/modules/avatar.md`](../../../../docs/modules/avatar.md).

## Invariants that bite

- Must never be imported by `recommendation` (`recommendation-not-renderer`) — `recommendation` stays a black box that returns reason codes, never a renderer dependency.
- Honesty invariant: no "exact digital twin" claims; every generated view carries a provenance marker and a confidence value (CLAUDE.md).
- Rendering output reaches the client apps through `packages/contracts`, never through a direct import of another domain module.

## Key files

- `apps/api/src/modules/avatar/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/avatar/internal/README.md` — placeholder; `apps/api/src/modules/<name>/internal/schema.ts` does not exist yet (P04 creates it via `db-migration`).
- `apps/api/src/modules/avatar/tests/` — this module's test suite.

## Owned data

None yet. Planned per SPINE §3: `avatar_configs`, `avatar_assets`, defined in `apps/api/src/modules/<name>/internal/schema.ts` once P04 lands them.

## Events

None yet.

## Allowed / forbidden edges

Allowed: public API of `profile`; `packages/shared-kernel`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); any edge outside the doc 04 §4.1 graph (`allowed-edges-only`); being imported by `recommendation` (`recommendation-not-renderer`).

## Test command

```bash
just test avatar
```

## Phase tasks that touch this module

Status: skeleton (P02), no domain-phase task has touched it yet. `planning/phases/P04-parametric-avatar-v1.md` §6 is where the module goes live: `avatar_configs` (AvatarConfig v1), `avatar_assets`, the measurement→morph mapping service, and bounds/imputation/conflict validation. Check that file's §12/§19 for the current task list.

## Escalate when

- Anything would create an import edge between `avatar` and `recommendation` in either direction — stop immediately, this is the `recommendation-not-renderer` rule and it is architecture-review/ADR territory, not a workaround.
- The actual 3D rendering/asset work starts (scenes, morph targets, glTF/KTX2 assets) — client-side 3D is deferred (no owner until it resumes), so stop and escalate; this skill only owns the domain-module side (config, calibration, versioning).
