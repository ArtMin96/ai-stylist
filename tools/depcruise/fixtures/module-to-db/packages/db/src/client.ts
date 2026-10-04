// FIXTURE: the packages/db client that only composition roots may import.
export const createDb = (url: string): { readonly url: string } => ({ url });
