---
paths:
  - ".agents/skills/**"
  - ".claude/agents/**"
  - ".claude/rules/**"
  - ".claude/settings.json"
---

# Authoring skills, agents, and rules

**Skill:** `Skill(skill-creator:skill-creator)` for any `.agents/skills/**` change; `Skill(create-agents)`
for any `.claude/agents/**` change.

**Agent:** none single-owns this path — whichever engineer authors a skill/agent for their own domain; a
change is reviewable by `architecture-reviewer`.

**Proof:** `just docs-check <changed path>` before claiming done.

**House standard every skill/agent follows here:**
- Skills: the six NFR-TEAM-100 sections + Overlap, `< 500` lines, `metadata.last-reviewed`, a description
  with concrete trigger phrases **and** a negative trigger, an evals.json +
  trigger-evals.json pair alongside SKILL.md.
- Agents: `name`, a `description` ≤ 1024 chars with triggers + a NOT-for clause, a minimal `tools`
  allowlist, XML-tagged body sections, ≥1 worked example, `Last reviewed: YYYY-MM-DD`.

**Invariants that bite here:**
1. Every backticked repo-relative path in these files must resolve on disk — `docs-check` DC-09.
2. Every `just <recipe>` token must be in `just --summary` — `docs-check` DC-10.
3. Every command shown in a skill or agent is a `just` recipe — no direct package-manager, script-runner,
   or build-tool invocation — `docs-check` DC-11 (see `planning/15-team-workflow-and-ai-agent-operations.md`
   §5 for the banned-token list).
