Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## · **Open question:** OQ-NN / RISK-NN (`planning/16-risks-open-questions-and-decision-log.md`)
- **Type:** spike · **Skill:** `.agents/skills/<architecture-review | performance-profiling | media-ml-pipeline>/SKILL.md`
- **Labels:** `type:spike`, `mod:<owner>`, `phase:P##`

## Question

One precise question a decision depends on. If you cannot phrase it as a question with a yes/no or a measurable answer, it is not a spike.

<Question: "Can <X> meet <budget/constraint> under <conditions>?" / "Which of A/B/C satisfies <criteria>?">

## Context

Why the answer is needed now and which decision, phase gate, or ADR is waiting on it. Do not reopen a DEC-NN without new evidence.

<Decision blocked: <…>. Prior evidence: <ADR-NNNN / DEC-NN / doc §>. Why existing evidence is insufficient: <…>>

## Time box

Hard cap. When it expires, write up what you have and stop.

- Budget: <n> hours/days · Owner: <…> · Ends: <date>

## Scope

Output is a document, not production code. Prototype code lives in `spike/…` branches or `/tmp`, is never merged, and is deleted or archived at the end.

- In scope: <experiments, measurements, sources to consult>
- Out of scope: <production code, migrations, contract changes, cloud mutation>
- Non-goals: <…>

## Modules touched

SPINE §3 names whose design the answer affects (read-only for this spike).

- Modules affected by the outcome: <names> · Single-writer packages the follow-up will touch: <contracts | shared-kernel | … | none>

## Acceptance criteria

The spike is done when the question is answered with evidence, not when the time is used up.

1. AC-1: written answer with evidence (measurements, primary-source docs with as-of dates, prototype output) at `<path>` — proof: file exists, reviewed by <human>
2. AC-2: options compared on the criteria named in Question — proof: table in the doc
3. AC-3: recommendation + revisit trigger recorded — proof: ADR / decision-log entry linked below

## Architecture guardrails

The recommendation must be implementable inside the invariants; say explicitly which ones it strains.

- [ ] Recommended option respects module boundaries (public API only, no domain logic in adapters, domain never imports provider SDKs)
- [ ] `recommendation ⊥ renderer` preserved by the recommended design
- [ ] Deterministic before AI evaluated first; any AI option comes with the doc-10 fields (schema, cost + latency budget, cache key, fallback, eval)
- [ ] Single source of truth: any new schema/constant is placed in `contracts` / `shared-kernel` / `closet`, not in the spike write-up as a fork
- [ ] Honesty invariants respected by any generated-view option (provenance marker + confidence)
- [ ] Provider options pass the doc 11 §7.5 privacy checklist before being recommended for S2/S3 data
- [ ] Prototype never merged; `just arch-check` untouched

## Search-before-write

What already answers part of this? Prior ADRs, decision-log entries, phase memos, existing code, and external primary sources with as-of dates.

- Existing evidence checked: <ADR-NNNN / DEC-NN / `<path>` / vendor doc (date)> — sufficient / insufficient because <…>

## Data, security, privacy

Spikes are where real data leaks into prototypes. Synthetic only.

- Data used in experiments: <synthetic from `packages/seed-data` | CC0 fixtures>; never production or personal data
- Providers contacted with any data: <none | provider + data category + retention/training terms checked>
- Credentials used: <sandbox/trial account names only, from `docs/SERVICES-SETUP.md` §<n>>; no new secrets in the repo
- `security-privacy-review` skill required for the follow-up: <yes | no — reason>

## Decision output

Where the answer lands and who signs it off.

- Document: `docs/adr/NNNN-<slug>.md` (from `templates/adr.md`) or `planning/…` memo `<path>`
- Decision-log entry: DEC-NN in `planning/16-…` (when accepted) · Open question closed: OQ-NN
- Follow-up issues to create: <Feature / Contract change / Migration / …>

## Kill criteria

Stop early and write up when any of these is true.

- <e.g. "Option A cannot reach <metric> after n runs" / "Vendor cannot exclude training on S3 data" / "Cost > $X/mo at projected volume" / "Time box hit">

## Risks and rollback

- Risk of a wrong answer: <what gets built on it; how reversible>
- Rollback: <prototype branch deleted; no production change — `N/A` if nothing else>

## Test plan

Evidence procedure, not a test suite. Measurements must be reproducible from the same procedure.

- Procedure: <steps, env, device, runs, percentile, dataset (synthetic)>
- Reproducibility artefacts kept: <scripts / notebooks under `<path>`, or none>
- Skips: `N/A — no production tests`

## Dependencies / blocked by

- Issues: <ID or none> · Accounts / trials (`docs/SERVICES-SETUP.md` §<n>): <…> · P00 gates (OQ-07 regions, vendor accounts): <…>

## Definition of done

- [ ] Question answered with pasted evidence (never extrapolated); hypotheses labelled as such
- [ ] Options table + recommendation + revisit trigger in the ADR/memo; DEC/OQ updated
- [ ] Time box respected or overrun explained
- [ ] No production code merged; prototype archived or deleted; no secrets or personal data left behind
- [ ] Follow-up issues created from the right templates; `PROGRESS.md` updated
- [ ] Skill followed (`.agents/skills/<area>`); human review of the write-up
