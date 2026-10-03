// FIXTURE: violates forbidden-field (no-log-request-body, key check): log payload keys built from a
// word in packages/shared-kernel/registry/forbidden-log-keys.json. There is no `.body`, `.headers`
// or `.cookies` member here, so every report comes from the key check.
type Logger = {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
};

export function syncCloset(logger: Logger, userEmail: string, itemCount: number): void {
  logger.info({ token: 'CANARY-MARKER-TOKEN', itemCount }, 'closet sync started');
  logger.warn({ userEmail }, 'closet sync retried');
}
