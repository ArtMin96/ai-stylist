import { Writable } from 'node:stream';

export type MemoryLogStream = Writable & {
  /** Every complete line written so far (pino writes one JSON object per line). */
  lines(): string[];
  /** Parsed JSON records; lines that are not JSON are skipped. */
  records(): Record<string, unknown>[];
  /** Raw concatenated output. */
  text(): string;
};

/** In-memory sink for pino (`{ stream }` / `pino(opts, stream)`): assert on what was logged. */
export function memoryLogStream(): MemoryLogStream {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  }) as MemoryLogStream;
  stream.text = () => chunks.join('');
  stream.lines = () =>
    stream
      .text()
      .split('\n')
      .filter((line) => line.length > 0);
  stream.records = () =>
    stream.lines().flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
  return stream;
}
