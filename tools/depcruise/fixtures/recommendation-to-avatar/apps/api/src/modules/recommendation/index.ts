// FIXTURE: violates recommendation-not-renderer (recommendation → avatar, even for a type).
import type { AvatarMesh } from '../avatar/index.js';

export const score = (mesh: AvatarMesh): number => mesh.vertices;
