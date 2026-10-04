// Picks the `StorageProvider` adapter from configuration (the composition root passes the
// validated `R2_*` keys and `allowsInMemoryStorage(config)`; this module never reads `process.env`).
// No R2 key: the in-memory provider, so local runs, tests and CI need no bucket. Staging, prod and
// NODE_ENV=production never get here without the keys (`loadConfig` refuses to boot, see
// `allowsInMemoryStorage` in config.ts), and the factory refuses too when told the environment
// does not allow it (defence in depth). Some but not all keys: refused, so a half-configured
// environment never falls back to in-memory URLs silently.
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
   * `allowsInMemoryStorage(config)` of apps/api/src/config.ts (platform cannot import it). `false`:
   * no R2 key is refused instead of binding the in-memory provider. Omitted: allowed (tests).
   */
  readonly allowsInMemory?: boolean;
};

/**
 * `R2StorageProvider` when all four R2 keys are set, `InMemoryStorageProvider` when none is and the
 * environment allows it.
 */
export function createStorageProvider(config: StorageProviderConfig): StorageProvider {
  const keys = {
    R2_ACCOUNT_ID: config.accountId?.trim() ?? '',
    R2_ACCESS_KEY_ID: config.accessKeyId?.trim() ?? '',
    R2_SECRET_ACCESS_KEY: config.secretAccessKey?.trim() ?? '',
    R2_BUCKET: config.bucket?.trim() ?? '',
  };
  const missing = Object.entries(keys)
    .filter(([, value]) => value === '')
    .map(([name]) => name);
  if (missing.length === Object.keys(keys).length) {
    if (config.allowsInMemory === false) {
      throw new TypeError(
        'storage: no R2 keys, and this environment does not allow the in-memory provider; ' +
          `set ${missing.join(', ')}`,
      );
    }
    config.logger.info({ component: 'storage', provider: 'in-memory' }, 'storage: no R2 keys');
    return new InMemoryStorageProvider(() => config.clock.now());
  }
  if (missing.length > 0) {
    throw new TypeError(`storage: R2 is partly configured; set ${missing.join(', ')} as well`);
  }
  config.logger.info({ component: 'storage', provider: 'r2' }, 'storage: R2 presigned URLs');
  return new R2StorageProvider({
    accountId: keys.R2_ACCOUNT_ID,
    accessKeyId: keys.R2_ACCESS_KEY_ID,
    secretAccessKey: keys.R2_SECRET_ACCESS_KEY,
    bucket: keys.R2_BUCKET,
    clock: config.clock,
    logger: config.logger,
  });
}
