// FIXTURE: violates no-cycles (tagging.ts → taxonomy.ts → tagging.ts). Both files sit in one
// module's internal/, so no boundary rule fires; only the cycle does.
import { categoryOf } from './taxonomy.js';

export const tagItem = (name: string): string => categoryOf(name);
export const defaultTag = 'untagged';
