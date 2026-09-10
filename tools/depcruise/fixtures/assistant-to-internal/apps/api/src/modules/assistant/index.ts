// FIXTURE: violates assistant-app-services-only (assistant → recommendation/internal/**).
import { rank } from '../recommendation/internal/engine.js';

export const reply = (items: readonly string[]) => rank(items);
