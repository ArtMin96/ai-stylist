---
paths:
  - "apps/api/src/modules/**"
---

# API domain modules

**Skill:** `backend-module` (billing → `entitlements-billing`; outfit/context/recommendation/fashion-intel
→ `recommendation-rules`; notifications → `notifications-delivery`; admin → `admin-moderation`; assistant
→ `assistant-chat`. Full module→skill map: `.agents/skills/README.md`).

**Agent:** `api-engineer` (outfit/context/recommendation/fashion-intel → `recommendation-engineer`).

**Proof:** `just test <module>` (e.g. `just test closet`), then `just lint && just typecheck && just arch-check`.

**Invariants that bite here:**
1. A module reaches another module only through its `index.ts` — depcruise `public-api-only` /
   `public-api-only-external`, eslint's boundaries/dependencies rule (`just arch-check`, `just lint`).
2. Only edges declared in `ALLOWED_EDGES` (`tools/depcruise/rules.cjs`) are importable — depcruise
   `allowed-edges-only` catches an undeclared cross-module import.
3. A domain module never imports a provider SDK directly — depcruise `domain-no-provider-sdk`; declare a
   port and let `platform` implement it.
