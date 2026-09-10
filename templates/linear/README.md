# Linear issue templates

Source of truth for the eight issue templates on the Linear team **AI Stylist** (workspace `ai-stylist-app`). Edit the `.md` files here, then re-sync Linear; never edit the Linear copy alone.

Every template is a superset of [`templates/issue.md`](../issue.md) (phase/task, requirements, owning modules, scope, non-goals, dependencies, acceptance criteria, test plan, observability, rollout, rollback) plus the CLAUDE.md guardrails, and points to the matching `.agents/skills/<area>/SKILL.md`.

| File                    | Linear name                     | Default label      | Type-specific sections                                                |
| ----------------------- | ------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `01-feature.md`         | `1 · Feature`                   | `type:feature`     | — (baseline)                                                          |
| `02-bug.md`             | `2 · Bug`                       | `type:bug`         | Reproduction · Regression test (paste the failing run)                |
| `03-improvement.md`     | `3 · Improvement / Tech debt`   | `type:improvement` | Behaviour invariant · before/after perf numbers                       |
| `04-spike.md`           | `4 · Spike / Research`          | `type:spike`       | Question · Time box · Decision output (ADR path) · Kill criteria      |
| `05-contract-change.md` | `5 · Contract change`           | `type:contract`    | Breaking? (oasdiff) · Version bump · Consumers to regenerate          |
| `06-migration.md`       | `6 · Migration`                 | `type:migration`   | Expand / Contract step · Down file · Data backfill · Neon branch test |
| `07-security-review.md` | `7 · Security / privacy review` | `type:security`    | Threat model (doc 11 §2 STRIDE-lite) · Approved-provider check        |
| `08-chore.md`           | `8 · Chore / Ops`               | `type:chore`       | Human-only steps · Secrets involved (names only)                      |

Common sections, in this order, in every template: Context · Scope · Modules touched · Acceptance criteria · Architecture guardrails · Search-before-write · Data, security, privacy · Risks and rollback · Test plan · Dependencies / blocked by · Definition of done. The first line of each body tells an agent to fill every section and write `N/A — <reason>` rather than delete one.

## Labels (already created in the workspace)

- Type: `type:feature` `type:bug` `type:improvement` `type:spike` `type:contract` `type:migration` `type:security` `type:chore` (indigo `#5E6AD2`)
- Module (SPINE §3): `mod:identity` `mod:profile` `mod:avatar` `mod:closet` `mod:media` `mod:outfit` `mod:context` `mod:recommendation` `mod:fashion-intel` `mod:billing` `mod:notifications` `mod:admin` `mod:assistant` `mod:shared-kernel` `mod:platform` (teal `#26B5CE`)
- Phase: `phase:P00` … `phase:P15` (grey `#95A2B3`)

Every issue carries exactly one `type:` label, one `phase:` label, and one `mod:` label per module touched. The workspace-default `Bug` / `Improvement` / `Feature` labels are superseded by the `type:` set.

## Syncing to Linear

The Linear MCP server exposes `list_templates` / `get_template` but no template-creation tool, so templates are created either by hand or by the GraphQL script.

### Option A — by hand (click path, verified against linear.app/docs "Issue templates", 2026-09-11)

1. Linear → **Settings** → **Teams** → **AI Stylist** → **Templates** → **New template** (the docs phrase it as "Team settings > Templates").
2. Name it exactly as in the table above (the `n ·` prefix keeps them sorted).
3. Paste the file body into the description. Leave the title empty so the writer must supply one.
4. Default properties: label = the `type:` label from the table; priority, estimate, assignee, project unset.
5. Save. Repeat for all eight. Use a standard template, not a form template.

### Option B — GraphQL script

```sh
# Key: either export LINEAR_API_KEY, or store it once in ~/.config/ai-stylist/linear-api-key (chmod 600). Never in a repo file.
templates/linear/create-templates.sh --dry-run
templates/linear/create-templates.sh            # creates missing templates on team "AI Stylist"
templates/linear/create-templates.sh --update   # re-syncs bodies of templates that already exist
```

The script resolves the team by name, resolves each `type:` label by name, and calls `templateCreate` (or `templateUpdate` with `--update`) with `type: "issue"` and `templateData = {description, labelIds, priority: 0}`. Requires `curl` and `jq`.

**Verification status:** `templateCreate`, `templateUpdate`, `TemplateCreateInput` (`name!`, `type!`, `templateData: JSON!`, `teamId`, `description`, `sortOrder`) and the `teams` / `issueLabels` / `templates` queries were checked against Linear's public SDK schema (`packages/sdk/src/schema.graphql` on GitHub) on 2026-09-11. The `templateData` keys (`description`, `labelIds`, `priority`) were verified on 2026-09-11: all eight templates were created on the AI Stylist team and read back through the Linear MCP with body, label and priority intact. Re-sync after editing a file with `--update` (or `--update --only 02` for one).

## Keeping them in sync

- Change a rule in `CLAUDE.md`, `templates/issue.md`, or a skill → update the affected template file here → re-run the script with `--update` (or paste by hand).
- Do not add a ninth template without adding a `type:` label and a row in this table.
