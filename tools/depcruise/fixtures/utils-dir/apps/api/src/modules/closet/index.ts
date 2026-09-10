// FIXTURE: imports from a utils/ directory.
import { titleCase } from './utils/format.js';

export const label = (s: string) => titleCase(s);
