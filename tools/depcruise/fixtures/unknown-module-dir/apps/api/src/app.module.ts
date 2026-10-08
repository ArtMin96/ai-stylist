// FIXTURE: violates unknown-module (`wardrobe` is not one of the 13 SPINE §3 module names). The
// composition root is the importer so no module-to-module rule (allowed-edges-only) applies.
import { WardrobeModule } from './modules/wardrobe/index.js';

export const modules = [WardrobeModule];
