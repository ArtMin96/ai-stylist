// FIXTURE: violates allowed-edges-only (closet → outfit; the 04 §4.1 DAG lets closet import only
// profile and media). The import goes through outfit's public index.ts, so only the DAG rule fires.
import { composeOutfit } from '../outfit/index.js';

export const suggestFromCloset = (itemIds: readonly string[]) => composeOutfit(itemIds);
