// FIXTURE: violates modules-not-platform (a module importing apps/api/src/platform/**, even a port
// file; shared ports live in shared-kernel and are bound at the composition root). Every such edge
// is also a composition-root-only violation (that rule forbids platform imports from any non-root
// file); check-fixtures.sh declares that overlap.
import type { HealthProbe } from '../../../platform/health/health-probe.port.js';

export const describeProbe = (probe: HealthProbe): string => probe.name;
