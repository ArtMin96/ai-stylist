// Request options every data-layer call spreads into the generated SDK. Built once by the
// composition root; the SDK accepts them per call, so no global client is mutated.
import type { Options } from '@ai-stylist/contracts';

export type ApiConfig = Pick<Options, 'baseUrl' | 'fetch'>;

export function createApiConfig(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiConfig {
  return { baseUrl, fetch: fetchImpl };
}
