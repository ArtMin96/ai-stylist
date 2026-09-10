// FIXTURE: violates public-api-only (closet → profile/internal/**).
import { findProfile } from '../profile/internal/profile.repository.js';

export const ownerOf = (id: string) => findProfile(id);
