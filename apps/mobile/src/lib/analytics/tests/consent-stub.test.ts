import { createConsentGatedAnalytics, noopSink, type AnalyticsEvent } from '@/lib/analytics';

const event: AnalyticsEvent = { name: 'app_opened', properties: { platform: 'android' } };

describe('consent-gated analytics', () => {
  it('is off by default and records nothing', () => {
    const sent: AnalyticsEvent[] = [];
    const analytics = createConsentGatedAnalytics({ send: (e) => sent.push(e) });
    expect(analytics.hasConsent()).toBe(false);
    analytics.track(event);
    analytics.track(event);
    expect(sent).toEqual([]);
  });

  it('forwards events only after consent is granted and stops when revoked', () => {
    const sent: AnalyticsEvent[] = [];
    const analytics = createConsentGatedAnalytics({ send: (e) => sent.push(e) });
    analytics.setConsent(true);
    analytics.track(event);
    analytics.setConsent(false);
    analytics.track(event);
    expect(sent).toEqual([event]);
  });

  it('P02 sink is a silent no-op', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(noopSink.send(event)).toBeUndefined();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
