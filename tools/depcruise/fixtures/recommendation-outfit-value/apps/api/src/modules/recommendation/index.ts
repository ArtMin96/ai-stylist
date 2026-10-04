// FIXTURE: violates recommendation-outfit-types-only. recommendation → outfit is a DAG edge, but
// only for item/composition types (`import type`); this is a value import of outfit's logic.
import { composeOutfit } from '../outfit/index.js';

export const rank = (itemIds: readonly string[]) => composeOutfit(itemIds);
