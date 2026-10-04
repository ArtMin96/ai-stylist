// FIXTURE: violates dev-ports-only (apps/api/src/dev importing a platform adapter). The port import
// on the first line is the allowed narrowing and must stay silent; only the adapter edge fires.
import type { StoragePort } from '../platform/ports/storage.port.js';
import { R2StorageAdapter } from '../platform/storage/r2-storage.adapter.js';

export const demoStorage: StoragePort = new R2StorageAdapter();
