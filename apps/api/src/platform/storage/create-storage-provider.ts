// Picks the `StorageProvider` adapter from configuration (the composition root passes the `R2_*`
// keys and `allowsInMemory: isLocalOrDevDeployment(config)`; this module never reads
// `process.env`). No R2 key: the in-memory provider, so local runs, tests and CI need no bucket,
// and only when the caller says the environment allows it (fail closed: `allowsInMemory` is
// required). Any R2 key: the R2 adapter, whose constructor is the one check of each key's shape
// and refuses an empty or malformed one by naming the key. Presence and all-or-none are the
// boot rules of apps/api/src/config.ts (`loadConfig`), which platform does not import.
import type { Logger } from 'pino';

import type { Clock } from '../ports/clock.port.js';
import { InMemoryStorageProvider, type StorageProvider } from '../ports/storage.port.js';

import { R2StorageProvider } from './r2-storage-provider.js';

export type StorageProviderConfig = {
  /** `R2_ACCOUNT_ID`. Empty or undefined (with the other three): in-memory provider. */
  readonly accountId: string | undefined;
  /** `R2_ACCESS_KEY_ID`. */
  readonly accessKeyId: string | undefined;
  /** `R2_SECRET_ACCESS_KEY`. */
  readonly secretAccessKey: string | undefined;
  /** `R2_BUCKET`. */
  readonly bucket: string | undefined;
  readonly clock: Clock;
  /** A pino logger built from `loggerOptions()`. */
  readonly logger: Logger;
  /**
   * Whether the in-memory provider may stand in when no R2 key is set: the composition root passes
   * `isLocalOrDevDeployment(config)` of apps/api/src/config.ts (platform cannot import it).
   * Required, so a caller that forgets it does not compile; `false` refuses a configuration
   * without R2 keys instead of binding the in-memory provider.
   */
  readonly allowsInMemory: boolean;
};

/**
 * `InMemoryStorageProvider` when no R2 key is set and the environment allows it, else
 * `R2StorageProvider` (which refuses a missing or malformed key).
 */
export function createStorageProvider(config: StorageProviderConfig): StorageProvider {
  const keys = {
    accountId: config.accountId?.trim() ?? '',
    accessKeyId: config.accessKeyId?.trim() ?? '',
    secretAccessKey: config.secretAccessKey?.trim() ?? '',
    bucket: config.bucket?.trim() ?? '',
  };
  if (Object.values(keys).every((value) => value === '')) {
    if (!config.allowsInMemory) {
      throw new TypeError(
        'storage: no R2 keys, and this environment does not allow the in-memory provider; ' +
          'set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET',
      );
    }
    config.logger.info({ component: 'storage', provider: 'in-memory' }, 'storage: no R2 keys');
    return new InMemoryStorageProvider(() => config.clock.now());
  }
  const provider = new R2StorageProvider({ ...keys, clock: config.clock, logger: config.logger });
  config.logger.info({ component: 'storage', provider: 'r2' }, 'storage: R2 presigned URLs');
  return provider;
}
