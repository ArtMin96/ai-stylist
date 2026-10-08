// FIXTURE: closes the cycle back to tagging.ts.
import { defaultTag } from './tagging.js';

export const categoryOf = (name: string): string => (name.length > 0 ? name : defaultTag);
