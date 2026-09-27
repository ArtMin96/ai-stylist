// HTTP for the sync: JSON in and out, a bearer token, no redirects followed, and errors that name
// only the method, the path and the status. Response bodies are never printed, because a vendor
// error body can echo request data. In a dry run every non-GET call is reported and not sent.

const TIMEOUT_MS = 30_000;
const MAX_PAGES = 100;

export class HttpError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'HttpError';
    this.status = options.status;
  }
}

/**
 * `baseUrl`: scheme, host and an optional path prefix. `report.change(kind, method, path, what)`
 * is told about every create, update and delete before it is sent; `dryRun` stops the sending.
 */
export function createClient({ baseUrl, token, dryRun, report }) {
  const base = new URL(baseUrl);
  const prefix = base.pathname.replace(/\/+$/, '');

  async function send(method, path, body, allow404 = false) {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(`${base.origin}${prefix}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error?.cause?.code ?? error?.name ?? 'unknown';
      throw new HttpError(`${method} ${path} → network error (${reason})`, { cause: error });
    }
    const text = await response.text();
    if (allow404 && response.status === 404) return null;
    if (!response.ok) {
      throw new HttpError(`${method} ${path} → ${response.status}`, { status: response.status });
    }
    if (text === '') return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new HttpError(`${method} ${path} → ${response.status} with a non-JSON body`, {
        cause: error,
      });
    }
  }

  /** The request path of a pagination link; a link off this origin and prefix is refused. */
  function pathOf(link, listPath) {
    const url = new URL(link, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(`${prefix}/`)) {
      throw new HttpError(`GET ${listPath} → pagination link outside the API base`);
    }
    return `${url.pathname.slice(prefix.length)}${url.search}`;
  }

  /** Every item of a paginated list (`{ results, next }`); a plain array is returned as it is. */
  async function getAll(path) {
    const items = [];
    let next = path;
    for (let page = 0; next !== null; page += 1) {
      if (page === MAX_PAGES) throw new HttpError(`GET ${path} → more than ${MAX_PAGES} pages`);
      const body = await send('GET', next);
      if (Array.isArray(body)) return body;
      items.push(...(body?.results ?? []));
      next = body?.next ? pathOf(body.next, path) : null;
    }
    return items;
  }

  /** A create, update or delete: always reported, sent unless this is a dry run. */
  async function mutate(kind, method, path, body, what) {
    report.change(kind, method, path, what);
    if (dryRun) return null;
    return send(method, path, body);
  }

  return {
    get: (path) => send('GET', path),
    /** GET that answers null on 404. */
    find: (path) => send('GET', path, undefined, true),
    getAll,
    mutate,
  };
}
