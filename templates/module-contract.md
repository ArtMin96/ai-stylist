# Module Contract — `<module-name>`

> Module names are canonical per [SPINE §3](../planning/SPINE.md). Path: `apps/api/src/modules/<module-name>` (`platform` lives at `apps/api/src/platform/`, `shared-kernel` at `packages/shared-kernel/`). This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** <what this module alone is accountable for>
- **Owner:** <role/person> · **Status:** Draft | Ratified · **Last updated:** YYYY-MM-DD

## Public interface

The ONLY importable surface (`index.ts`). Everything else is internal and blocked by boundary lint.

| Export | Kind (service/command/query/type/port) | Purpose |
| ------ | -------------------------------------- | ------- |
|        |                                        |         |

## Owned data

Tables/collections this module exclusively reads and writes. No other module touches them directly.

| Table / store | Contents | Sensitivity class (per doc 11) |
| ------------- | -------- | ------------------------------ |
|               |          |                                |

## Invariants

Statements that must always hold; each needs at least one test.

1. <…>
2. <…>

## Events

| Event (published) | Payload schema (owner: `packages/contracts`) | When emitted |
| ----------------- | -------------------------------------------- | ------------ |
|                   |                                              |              |

| Event (consumed) | From module | Reaction |
| ---------------- | ----------- | -------- |
|                  |             |          |

## Dependencies (allowed)

- Modules/ports this module may call: <e.g., `shared-kernel`, `WeatherProvider` port>

## Forbidden dependencies

- <e.g., must NOT import `avatar` or any renderer code; must NOT import provider SDKs — ports only; must NOT read another module's tables>

## Tests

- Location: `apps/api/src/modules/<module-name>/tests/`
- Required levels: <unit for invariants/rules · contract tests for public interface + events · integration where adapters exist>
- Fixtures/builders: module-owned test support package; never duplicated across modules.

## Extension points

How future capabilities plug in WITHOUT modifying internals:

- <e.g., new `ContextProvider` implementations register via the provider port; new reason codes are added to the `shared-kernel` registry>
