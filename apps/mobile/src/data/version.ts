import { getVersion, type VersionInfo } from '@ai-stylist/contracts';

import type { ApiConfig } from './api';

export type VersionResult =
  | { readonly ok: true; readonly version: VersionInfo }
  | { readonly ok: false; readonly message: string };

const UNREACHABLE = 'Could not reach the API';

/** GET /v1/version mapped to a result the screen can render; never throws. */
export async function fetchVersion(api: ApiConfig): Promise<VersionResult> {
  try {
    const { data, error, response } = await getVersion({ ...api });
    if (data) return { ok: true, version: data };
    // The generated client swallows network failures into `error` with no response.
    if (!response) return { ok: false, message: UNREACHABLE };
    const title =
      error && typeof error === 'object' && 'title' in error && typeof error.title === 'string'
        ? error.title
        : undefined;
    return { ok: false, message: title ?? `API responded with ${response.status}` };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}
