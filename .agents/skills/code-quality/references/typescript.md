# TypeScript (NestJS on Fastify, Node ESM) quality reference

Applies to: `.ts`, `.mts`, `.mjs` and `.cjs` files under `apps/api/`, `packages/` and `tools/`, plus
root config scripts. Never cite this file for Swift, Kotlin, Python or shell.

**Gates (they run, so do not hand-check what they cover):** `tsconfig.base.json` (`strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`verbatimModuleSyntax`, `isolatedModules`, NodeNext modules); `eslint.config.mjs` with
typescript-eslint `recommendedTypeChecked` (no floating promises, no unsafe `any` flow),
`consistent-type-imports` with inline type imports, unused-variable rules with the `_` escape,
`no-console`, a 400-line file-size warning, `no-skip-without-issue`, and the rules in
`tools/eslint/quality.mjs` (test placement, no logging of request bodies); Prettier with `.prettierrc`
(100 columns, single quotes, trailing commas); module boundaries in `tools/depcruise/rules.cjs`.
Canonical siblings: `apps/api/src/platform/resilience/retry.ts`, `apps/api/src/platform/problem.filter.ts`.

## Naming

- Variables and functions `camelCase`; types, classes and Nest providers `PascalCase`; module-level
  constants `UPPER_SNAKE_CASE` (`PROBLEM_CONTENT_TYPE`).
- File names `kebab-case`, with a role suffix where Nest or the repo uses one: `.controller.ts`,
  `.module.ts`, `.filter.ts`, `.port.ts`.
- No `I` prefix on interfaces or `T` prefix on type aliases. Booleans `is`/`has`/`should`.
- Functions say what they return or do: `backoffDelayMs`, `statusOf`. Put the unit in the name of a
  number whose type cannot carry it (`timeoutMs`).

## Types

- No `any`. Use `unknown` and narrow with type guards, `instanceof` or the module's schema. Casts with
  `as` only after a check proves them, as in `problem.filter.ts`; never `as unknown as T`.
- Model closed sets as string-literal unions or `as const` objects with a derived type, not TypeScript
  `enum` (not erasable under `isolatedModules`, and worse at the wire boundary). Shared ones come from
  `packages/shared-kernel` or the generated contracts, never a local copy.
- Discriminated unions for results and states; `switch` on the tag with an exhaustive
  `const _exhaustive: never = value` default.
- `readonly` on properties and `ReadonlyArray`/`readonly T[]` in signatures by default.
- `satisfies` to check an object literal against a type without widening it.
- `exactOptionalPropertyTypes` is on: an optional property is omitted, not set to `undefined`; write
  `prop?: T | undefined` only when callers really pass `undefined`.
- `noUncheckedIndexedAccess` is on: handle the `undefined` from `array[i]` and `record[key]` rather
  than asserting it away with `!`.
- Use `type` aliases or `interface` as the sibling does; do not mix styles inside one file.

## Modules and imports

- ESM with explicit `.js` extensions on relative imports (NodeNext). Named exports; no default exports
  except where a tool demands one (ESLint flat configs).
- `import { type Foo }` for type-only imports (gated). A module's public surface is its `index.ts`;
  never import another module's internal directory (boundary-gated).

## Functions and async

- Keep domain logic in pure functions that take their dependencies (clock, random, sleep) as
  parameters, as `retry.ts` does, so tests need no timers or mocks.
- More than three parameters, or two of the same type next to each other → one options object with
  named, `readonly` fields.
- Every promise is awaited, returned or explicitly handed to a supervisor (gated). Independent work
  runs with `Promise.all`; use `Promise.allSettled` when partial failure is expected.
- Bound every external call with a timeout or an `AbortSignal`; reuse
  `apps/api/src/platform/resilience/` (retry, timeout, circuit breaker) instead of new loops.
- Early returns over nested conditionals; no `else` after `return`.

## Errors

- Throw `Error` subclasses with a message and `{ cause }` when wrapping. Catch `unknown` and narrow it.
- HTTP errors leave the API as RFC 9457 problem details through the shared-kernel `problem()` helper
  and the platform problem filter; never hand-build an error body in a controller.
- Never catch to ignore. Either handle it (retry, fallback, translate) or let it propagate.

## NestJS on Fastify

- Controllers translate HTTP to an application-service call and back; they hold no business rules
  (root `CLAUDE.md`, "No domain logic in adapters").
- Constructor injection with `private readonly`; ports are injected by token with `@Inject(TOKEN)` and
  bound at the composition root `apps/api/src/app.module.ts`.
- Validate untrusted input at the edge with the schema the module already uses (the OpenAPI contract
  through ajv, or zod), then pass typed values inward. Never type `request.body` as trusted `T`.
- Fastify types (`FastifyRequest`, `FastifyReply`), never Express types.
- Log through the injected pino `Logger` with structured fields; never `console` (gated), never request
  bodies or sensitive data (gated for bodies, reviewer-checked for the rest).

## Comments and docs

- TSDoc `/** … */` on exported functions and types: what it does, units, and what it throws.
- Comments explain why and link the deciding doc; no commented-out code, no `TODO` without an issue ID.

## Tests (Vitest)

- Tests in the owning module's tests directory (gated). Reuse fakes and builders from
  `packages/test-support/`; do not mock what you can fake.
- One behaviour per test, named as a sentence; property tests (fast-check) for pure rules.
- `it.skip` only with an issue ID in the title (gated).

## Suppression syntax

`// eslint-disable-next-line <rule> -- <reason>` for one line, `// @ts-expect-error <reason>` (never
`@ts-ignore`) for one type error. Never a file-wide `eslint-disable`, and never for `no-floating-promises`,
`no-explicit-any` or the boundary rules.

## Do not import from other languages

| Habit from        | Leaks in as                                                                | TypeScript instead                                                                     |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Java / C#         | `IUserService`, getter/setter pairs, a class for every helper              | capability-named type, plain properties, exported functions                            |
| Swift / Kotlin    | a `Result`/`Either` library introduced for every call                      | throw inside a layer; a discriminated union only where the sibling already returns one |
| Kotlin / Swift    | `enum` keyword for string sets                                             | string-literal union or `as const` object                                              |
| Python            | `snake_case` fields in code, `Optional[T]` habits (`T \| null` everywhere) | `camelCase` in code (wire names come from the contract), omitted optional properties   |
| Python / shell    | bare `catch {}` to keep going                                              | handle or propagate                                                                    |
| Express tutorials | `req, res` handlers, `express` types                                       | Nest controllers on the Fastify adapter                                                |

## Checklist

No `any`, no unproven `as`, no non-null `!` · closed sets as unions from shared-kernel or contracts ·
exhaustive switches · `readonly` by default · `.js` relative imports, named exports, type-only imports ·
every promise handled, every external call bounded · errors wrapped with `cause`, problem details at the
edge · controllers thin, ports injected · structured pino logging, nothing sensitive · TSDoc on exports ·
tests in the module tests directory using test-support fakes.
