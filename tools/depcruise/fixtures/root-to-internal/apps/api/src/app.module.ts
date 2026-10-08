// FIXTURE: violates public-api-only-external (code outside modules/, here the composition root,
// importing a module's internal/** instead of its index.ts).
import { ClosetRepository } from './modules/closet/internal/closet.repository.js';

export const providers = [ClosetRepository];
