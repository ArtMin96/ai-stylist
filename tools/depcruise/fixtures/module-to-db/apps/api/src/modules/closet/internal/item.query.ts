// FIXTURE: violates composition-root-only (a non-root file importing packages/db; only the
// composition roots, platform, dev, packages/db itself, api tests and the seed CLI may).
import { createDb } from '../../../../../../packages/db/src/client.js';

export const itemsDb = createDb;
