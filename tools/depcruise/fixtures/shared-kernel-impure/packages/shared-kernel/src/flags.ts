// FIXTURE: violates shared-kernel-pure. The exception covers the package's own registry/*.json
// data only (the JSON import below is allowed); I/O (node:fs) and code under registry/ are not.
import { readFileSync } from 'node:fs';

import data from '../registry/flags.json' with { type: 'json' };
import { parseFlags } from '../registry/loader.js';

export const flags = parseFlags(readFileSync('flags.json', 'utf8'));
export const defaults = data.flags;
