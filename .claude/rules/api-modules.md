---
paths:
  - "apps/api/src/modules/**"
  - "apps/api/src/app.module.ts"
  - "apps/api/src/main.ts"
  - "apps/api/src/config.ts"
  - "apps/api/src/dev/**"
  - "apps/api/package.json"
  - "apps/api/tsconfig.json"
  - "apps/api/tsconfig.build.json"
  - "apps/api/vitest.config.ts"
  - "apps/api/eslint.config.mjs"
  - "apps/api/README.md"
  - "apps/api/tests/http.test.ts"
  - "packages/test-support/**"
---

# API domain modules and the composition root

**Skill:** `backend-module` for identity, profile, avatar, closet, media, outfit and context. Module-specific
skills win inside their area: recommendation, and scoring or constraint rules in outfit/context →
`recommendation-rules`; fashion-intel → `fashion-intel-ingestion`; billing → `entitlements-billing`;
notifications → `notifications-delivery`; admin → `admin-moderation`; assistant → `assistant-chat`;
consent, deletion and export → `data-lifecycle`. Full map: `.agents/skills/README.md`.

**Agent:** `recommendation-engineer` for `apps/api/src/modules/{recommendation,outfit,context,fashion-intel}/**`.
`api-engineer` for every other module, the composition root (`apps/api/src/app.module.ts`,
`apps/api/src/main.ts`, `apps/api/src/config.ts`), `apps/api/src/dev/**`, `apps/api/tests/http.test.ts`,
the API workspace files (`apps/api/package.json`, `apps/api/tsconfig.json`,
`apps/api/tsconfig.build.json`, `apps/api/vitest.config.ts`, `apps/api/eslint.config.mjs`,
`apps/api/README.md`), and `packages/test-support/**`.

**Proof:** `just test <module>` (e.g. `just test closet`); `just test api` for the composition root,
`apps/api/src/dev/**` and `apps/api/tests/http.test.ts`; `just test` for `packages/test-support/**`
(no scoped route); then `just lint && just typecheck && just arch-check`.

**Invariants that bite here:**
1. A module reaches another module only through its `index.ts` — depcruise `public-api-only` and
   `public-api-only-external`, plus the eslint boundaries rules (`just arch-check`, `just lint`).
2. Only edges declared in `ALLOWED_EDGES` (`tools/depcruise/rules.cjs`) are importable — depcruise
   `allowed-edges-only`.
3. A domain module never imports a provider SDK or `apps/api/src/platform/**` — depcruise
   `domain-no-provider-sdk` and `modules-not-platform`.
4. A new port is declared in the module's `index.ts`, or in `packages/shared-kernel/` when two modules
   share it. Its fake goes in `packages/test-support/src/`, copying `packages/test-support/src/clock.ts`;
   `platform-engineer` writes the adapter; `api-engineer` binds it in `apps/api/src/app.module.ts`. Do not
   copy the P02-interim `apps/api/src/platform/ports/*.port.ts` and `InMemoryStorageProvider` placement
   (reviewer-checked).
5. `assistant` calls only other modules' public application services — depcruise
   `assistant-app-services-only`. `recommendation` never depends on `avatar` or a renderer — depcruise
   `recommendation-not-renderer`.
6. Only the composition roots (`apps/api/src/app.module.ts`, `apps/api/src/main.ts`,
   `apps/api/src/jobs/**`) construct adapters or import `packages/db/` — depcruise `composition-root-only`.
