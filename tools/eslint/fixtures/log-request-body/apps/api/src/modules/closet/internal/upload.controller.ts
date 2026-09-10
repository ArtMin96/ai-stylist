// FIXTURE: violates forbidden-field (no-log-request-body) — a request body reaches a log call.
type Logger = { info(obj: unknown, msg?: string): void };
type Request = { body: unknown; headers: Record<string, string> };

export function handle(logger: Logger, req: Request): void {
  logger.info({ payload: req.body }, 'upload received');
  logger.info(req.headers);
}
