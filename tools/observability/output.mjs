// Everything the sync prints. Each line passes through `redact`, which masks the secret values it
// was given (tokens, keys, the alert addresses), so no code path can print one, even by accident.

/** `secrets`: values to mask; values shorter than 4 characters are ignored. */
export function createOutput(secrets, stdout = process.stdout, stderr = process.stderr) {
  const masked = secrets.filter((value) => value.length >= 4);
  masked.sort((a, b) => b.length - a.length);
  const redact = (text) => masked.reduce((line, secret) => line.split(secret).join('***'), text);
  return {
    info: (line) => stdout.write(`${redact(line)}\n`),
    error: (line) => stderr.write(`${redact(line)}\n`),
  };
}

/**
 * One vendor's progress: a line per planned or sent call, `unchanged` lines, warnings and a
 * summary. `change` is called by the HTTP client before a create, update or delete is sent.
 */
export function createReport(target, dryRun, output) {
  const counts = { create: 0, update: 0, delete: 0, unchanged: 0 };
  const mark = dryRun ? '[dry-run] ' : '';
  return {
    change(kind, method, path, what) {
      counts[kind] += 1;
      output.info(`${target}: ${mark}${kind} ${what}: ${method} ${path}`);
    },
    unchanged(what) {
      counts.unchanged += 1;
      output.info(`${target}: unchanged ${what}`);
    },
    note(message) {
      output.info(`${target}: ${message}`);
    },
    warn(message) {
      output.error(`WARN  ${target}: ${message}`);
    },
    summary() {
      const outcome = dryRun ? 'dry run, nothing sent' : 'done';
      const tally = `${counts.create} create, ${counts.update} update, ${counts.delete} delete`;
      output.info(`${target}: ${outcome}: ${tally}, ${counts.unchanged} unchanged`);
    },
  };
}
