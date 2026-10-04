// FIXTURE: violates dev-ports-only (apps/api/src/dev importing platform). The shared-kernel port
// import on the first line is allowed and must stay silent; both platform edges fire, the adapter
// and the platform-internal port file alike (no platform file is importable from dev).
import type { StoragePort } from '../../../../packages/shared-kernel/src/ports/storage.js';
import type { HealthProbe } from '../platform/health/health-probe.port.js';
import { R2StorageAdapter } from '../platform/storage/r2-storage.adapter.js';

export const demoStorage: StoragePort = new R2StorageAdapter();
export const demoProbe: HealthProbe = { name: 'db' };
