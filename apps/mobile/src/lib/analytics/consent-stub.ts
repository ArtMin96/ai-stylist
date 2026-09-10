import type { Analytics, AnalyticsEvent, AnalyticsSink } from './port';

/**
 * P02 sink: drops every event silently (no console, no network). Replace with the PostHog RN SDK
 * adapter once the taxonomy schema check and consent flow land.
 * TODO(P03): posthog-react-native adapter behind this same port; do not add the dependency before.
 */
export const noopSink: AnalyticsSink = {
  send: () => undefined,
};

/** Consent gate: OFF by default; nothing reaches `sink` until `setConsent(true)`. */
export function createConsentGatedAnalytics(sink: AnalyticsSink): Analytics {
  let consent = false;
  return {
    hasConsent: () => consent,
    setConsent: (granted: boolean) => {
      consent = granted;
    },
    track: (event: AnalyticsEvent) => {
      if (!consent) return;
      sink.send(event);
    },
  };
}
