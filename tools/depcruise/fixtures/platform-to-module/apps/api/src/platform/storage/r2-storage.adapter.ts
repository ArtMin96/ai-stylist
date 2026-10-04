// FIXTURE: violates platform-leaf (a platform adapter importing a domain module; platform depends
// on shared-kernel, contracts and SDKs only). The import uses the module's public index.ts, so
// public-api-only-external does not fire.
import { ownerOf } from '../../modules/closet/index.js';

export const keyFor = (itemId: string): string => `${ownerOf(itemId)}/${itemId}`;
