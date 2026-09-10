import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { HomeScreen } from '@/features/home/home-screen';
import { createApiConfig } from '@/data/api';
import { createConsentGatedAnalytics, type AnalyticsEvent } from '@/lib/analytics';
import { AppServicesProvider, type AppServices } from '@/lib/app-services';
import { parseConfig } from '@/lib/config';

const API = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function renderHome(services: Partial<AppServices> = {}) {
  const sent: AnalyticsEvent[] = [];
  const config = parseConfig({
    EXPO_PUBLIC_API_BASE_URL: API,
    EXPO_PUBLIC_EAS_PROJECT_ID: undefined,
    appVersion: '0.1.0-test',
  });
  const full: AppServices = {
    config,
    api: createApiConfig(config.apiBaseUrl),
    analytics: createConsentGatedAnalytics({ send: (e) => sent.push(e) }),
    ...services,
  };
  await render(
    <AppServicesProvider services={full}>
      <HomeScreen />
    </AppServicesProvider>,
  );
  return { sent, analytics: full.analytics };
}

describe('HomeScreen', () => {
  it('shows the API version returned by GET /v1/version through the generated client', async () => {
    server.use(
      http.get(`${API}/v1/version`, () =>
        HttpResponse.json({
          version: '1.2.3',
          commit: 'abcdef0123456789',
          buildTime: '2026-09-10T00:00:00Z',
        }),
      ),
    );
    await renderHome();
    expect(screen.getByRole('header', { name: 'AI Stylist' })).toBeOnTheScreen();
    expect(await screen.findByTestId('api-version')).toHaveTextContent(/API 1\.2\.3 \(abcdef0\)/);
  });

  it('shows a friendly error (never a stack) when the API is down', async () => {
    server.use(http.get(`${API}/v1/version`, () => HttpResponse.error()));
    await renderHome();
    expect(await screen.findByTestId('api-error')).toHaveTextContent(/Could not reach the API/);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  it('sends zero analytics events while consent is off, even after toggling', async () => {
    server.use(
      http.get(`${API}/v1/version`, () =>
        HttpResponse.json({
          version: '1.0.0',
          commit: 'deadbeef',
          buildTime: '2026-09-10T00:00:00Z',
        }),
      ),
    );
    const { sent, analytics } = await renderHome();
    await screen.findByTestId('api-version');
    expect(analytics.hasConsent()).toBe(false);
    expect(sent).toEqual([]);

    await fireEvent(screen.getByLabelText('Share anonymous usage data'), 'valueChange', true);
    await waitFor(() => expect(analytics.hasConsent()).toBe(true));
    // Only events tracked after opt-in may flow; nothing tracked before it is replayed.
    expect(sent).toEqual([]);
  });
});
