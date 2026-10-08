/**
 * Structural match for the shared-kernel `OutboxWriter` port
 * (packages/shared-kernel/src/ports/outbox-writer.ts), plus what it recorded. `E` is the envelope
 * type a test expects to read back; the transaction handle is ignored (no database).
 */
export type RecordingOutboxWriter<E = unknown> = {
  append(envelope: E, tx?: unknown): Promise<void>;
  /** Every appended envelope, in order. */
  readonly appended: readonly E[];
};

/** An OutboxWriter that keeps each envelope in memory and always resolves. */
export function recordingOutboxWriter<E = unknown>(): RecordingOutboxWriter<E> {
  const appended: E[] = [];
  return {
    appended,
    append: (envelope) => {
      appended.push(envelope);
      return Promise.resolve();
    },
  };
}
