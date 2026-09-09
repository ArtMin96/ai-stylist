const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * True only for connection strings that point at this machine. Destructive recipes
 * (`just db-reset`) refuse anything else (planning/15 §5, root CLAUDE.md "Prohibited").
 */
export function isLocalDatabaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') return false;
  return LOCAL_HOSTS.has(parsed.hostname);
}
