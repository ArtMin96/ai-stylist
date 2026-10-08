// FIXTURE: violates not-to-unresolvable (the imported file does not exist: a typo or a stale path).
import { findItem } from './internal/item.repositry.js';

export const itemById = (id: string) => findItem(id);
