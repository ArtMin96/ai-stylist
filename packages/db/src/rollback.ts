import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { sql } from 'drizzle-orm';

import type { Db } from './client.js';
import { MIGRATIONS_FOLDER } from './migrate.js';

type JournalEntry = { idx: number; when: number; tag: string };
type Journal = { entries: JournalEntry[] };

export type RollbackResult = {
  readonly tag: string;
  readonly downFile: string;
};

/**
 * Roll back the most recently applied migration by executing `migrations/down/<idx>.sql` and
 * deleting its row from `drizzle.__drizzle_migrations`, in one transaction.
 *
 * drizzle-kit has no down migrations; the down files are hand-written next to each generated
 * migration and reviewed with it. Expand–contract (planning/06 §7) is a convention this script
 * cannot verify: a down file must only undo the additive step it pairs with.
 *
 * Returns null when nothing is applied.
 */
export async function rollbackLast(db: Db): Promise<RollbackResult | null> {
  const journal = JSON.parse(
    await readFile(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
  ) as Journal;

  const applied = await db.execute<{ id: number; created_at: string | number }>(
    sql`select id, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`,
  );
  const last = applied[0];
  if (last === undefined) return null;

  const createdAt = Number(last.created_at);
  const entry = journal.entries.find((e) => e.when === createdAt);
  if (entry === undefined) {
    throw new Error(
      `rollback: applied migration created_at=${createdAt} has no journal entry (edited journal?)`,
    );
  }

  const downFile = path.join(
    MIGRATIONS_FOLDER,
    'down',
    `${entry.idx.toString().padStart(4, '0')}.sql`,
  );
  let downSql: string;
  try {
    downSql = await readFile(downFile, 'utf8');
  } catch {
    throw new Error(`rollback: ${entry.tag} has no down file at ${downFile}; write one first`);
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(downSql));
    await tx.execute(sql`delete from drizzle.__drizzle_migrations where id = ${last.id}`);
  });

  return { tag: entry.tag, downFile };
}
