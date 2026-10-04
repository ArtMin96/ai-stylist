// FIXTURE: violates modules-not-platform (a module importing apps/api/src/platform/**, even a port
// file; ports are bound at the composition root). Every such edge is also a composition-root-only
// violation (that rule forbids platform imports from any non-root file); check-fixtures.sh
// declares that overlap.
import type { StoragePort } from '../../../platform/ports/storage.port.js';

export const describeStorage = (port: StoragePort): string => port.name;
