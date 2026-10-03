// Owners registry (planning/14 §7, §11; ADR-0007): the people who own flags, dashboards, alerts and
// runbooks, and the roles that group them. Other registries reference a person or role by id, so
// changing an owner is a data edit in packages/shared-kernel/registry/owners.json (schema beside it),
// never a code change. No contact details live here (planning/11 §8).
import registry from '../registry/owners.json' with { type: 'json' };

/** Stable kebab-case person id, e.g. `arthur-minasyan`. */
export type PersonId = string;

export type Person = {
  readonly id: PersonId;
  /** Display name only. */
  readonly name: string;
  /** GitHub login without the leading `@`. */
  readonly githubHandle?: string;
};

/** Role name (kebab-case), e.g. `on-call`. */
export type OwnerRole = string;

export type OwnersRegistry = {
  readonly people: readonly Person[];
  /** Role → the person ids that hold it; a dashboard, alert or flag may point at a role. */
  readonly roles: Readonly<Record<OwnerRole, readonly PersonId[]>>;
};

// Widened on purpose: `roles` is optional in the schema, so editing owners.json never breaks this file.
const source: { readonly people: readonly Person[]; readonly roles?: OwnersRegistry['roles'] } =
  registry;

export const OWNERS_REGISTRY: OwnersRegistry = {
  people: source.people,
  roles: source.roles ?? {},
};
