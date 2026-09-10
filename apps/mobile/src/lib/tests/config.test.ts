import { ConfigError, DEFAULT_API_BASE_URL, parseConfig } from '@/lib/config';

describe('parseConfig', () => {
  it('defaults the API base URL to localhost:3000 when unset or blank', () => {
    for (const value of [undefined, '', '  ']) {
      const config = parseConfig({
        EXPO_PUBLIC_API_BASE_URL: value,
        EXPO_PUBLIC_EAS_PROJECT_ID: undefined,
        appVersion: undefined,
      });
      expect(config.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
      expect(config.easProjectId).toBeUndefined();
      expect(config.appVersion).toBe('0.0.0');
    }
  });

  it('accepts an https URL and strips the trailing slash', () => {
    const config = parseConfig({
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/',
      EXPO_PUBLIC_EAS_PROJECT_ID: 'proj_123',
      appVersion: '0.1.0',
    });
    expect(config).toEqual({
      apiBaseUrl: 'https://api.example.test',
      easProjectId: 'proj_123',
      appVersion: '0.1.0',
    });
  });

  it('rejects a non-http URL naming the key', () => {
    expect(() =>
      parseConfig({
        EXPO_PUBLIC_API_BASE_URL: 'ftp://nope',
        EXPO_PUBLIC_EAS_PROJECT_ID: undefined,
        appVersion: undefined,
      }),
    ).toThrow(ConfigError);
  });
});
