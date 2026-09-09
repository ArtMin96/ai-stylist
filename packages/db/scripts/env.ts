// Shared by the db scripts: resolve DATABASE_URL from the environment, falling back to the
// repo-root .env (direnv's source of truth) without overriding anything already exported.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

export function loadRootEnv(): void {
  const envFile = path.join(REPO_ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function requireDatabaseUrl(): string {
  loadRootEnv();
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url.trim() === '') {
    process.stderr.write(
      'DATABASE_URL is not set: export it or fill it in the repo-root .env (see .env.example)\n',
    );
    process.exit(1);
  }
  return url;
}

export function log(line: string): void {
  process.stdout.write(`${line}\n`);
}
