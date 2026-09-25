# Closet taxonomy registry — bump procedure

Last reviewed: 2026-09-25

## Status

No taxonomy registry exists yet: `packages/shared-kernel/registry/` holds only
`reason-codes.json`, `entitlements.json` and `units.json`. P06-T01 scopes the v1 registry and
decides where it lives. Until that lands, a taxonomy task is design only: stop before inventing a
file, a location, or a codegen output.

## Ownership

`closet` (SPINE §3) owns the category/subcategory taxonomy, attribute schemas, and the applicable-
attribute map as a _concept_ (`docs/modules/closet.md`, root `CLAUDE.md` "Single source of truth" —
"taxonomy in `closet`"). The registry that encodes that concept is versioned and codegen'd from
`packages/contracts`/`packages/shared-kernel`, the same way reason codes and entitlement names are:
`closet` decides what the taxonomy contains, this skill's files are how that decision reaches every
client. Full governance model: `planning/08-closet-taxonomy-and-organization.md` §12.

## Why this lives here and not in `backend-module`

A taxonomy bump changes a wire-visible registry consumed by the native-app pickers, API validation, and the
classifier's JSON schema simultaneously — the same fan-out as any other contract change, and it is
single-writer for the same reason (`packages/contracts`/`shared-kernel` "Parallel sessions" rule).
`backend-module` picks up again once the registry has landed, for any `closet`-module code that
reacts to the new ids.

## The bump procedure (doc 08 §12)

1. **Registry edit.** Add the new id(s) with parent, display label, applicable-attribute set,
   layering-role default, and a classifier-mapping note. Additive changes (new subcategory/enum
   value) are a minor bump and safe for old clients (unknown-id-tolerant readers per doc 06).
   Splits, merges, and deprecations are a major bump and must ship a **migration rule** in the
   registry itself: `deprecates: cat.x → cat.y`, or a conditional split rule
   (`cat.tops.shirt` → `shirt|overshirt` by `attr.layering-role`).
2. **Codegen.** `just generate` regenerates the native-app pickers/labels, API validation, and the
   classifier JSON schema + prompt artifact from the one registry. Never hand-edit any of the three;
   a stale one is exactly the drift doc 08 §12 exists to prevent.
3. **Backfill job.** A backfill applies the migration rule(s) to stored `closet` item attributes.
   Ambiguous cases (the rule cannot decide) fall to `.other` plus a review nudge — never a silent
   guess. Rows with `source: user` migrate by rule but keep `source: user` (a user correction is
   never silently overwritten by a registry change).
4. **Saved filters/tags survive.** Structured saved-filter queries (registry ids, not strings) are
   rewritten by the same migration rules that back-fill items, so a filter referencing a deprecated
   id keeps returning the right results via the mapping.
5. **Eval gate.** Classification prompts embed the registry version; a bump requires regenerating
   the prompt artifact and re-running the eval gate (doc 10) before deploy — a stale prompt would
   classify against a taxonomy version the stored data no longer matches.
6. **Governance.** Every taxonomy change is a lightweight ADR (`templates/adr.md`) citing evidence
   from doc 08 §13's data-quality metrics (`other`-rate, user requests) — additions are curated, not
   accretive.

## Drill reference

`planning/phases/P07-closet-organization-and-sync.md` task P07-T14 is the registry-bump drill: a
vN→vN+1 fixture with a split rule, its backfill job, and proof that saved filters/tags survive the
bump. Read it before writing a real bump — it is the worked example this procedure is distilled
from. `planning/phases/P06-closet-capture-pipeline.md` task P06-T01 is where the v1 registry itself
was scoped (all doc 08 §3 categories including shoes/accessories, plus the attribute-applicability
map).

## Escalate when

- A migration rule cannot classify a real stored case even as `.other` (e.g. the split condition's
  attribute is missing on old rows) — that is a data-quality gap in the rule, not a code bug; stop
  and revise the rule before running the backfill.
- A saved filter would silently stop matching anything after the bump — the migration rule for that
  id is incomplete; fix the rule, don't special-case the filter.
- The proposed change is additive in name but actually splits or renames an id read by stored data —
  treat it as major regardless of how it is described in the request.
