// Analytics port (planning/14 §2, P02 §11). Product code depends on this interface only; the
// composition root (src/app/_layout.tsx) picks the implementation. Events must exist in the
// taxonomy schema (packages/contracts/events/analytics) and never carry sensitive data.

export type AnalyticsPropertyValue = string | number | boolean;

export type AnalyticsEvent = {
  readonly name: string;
  readonly properties?: Readonly<Record<string, AnalyticsPropertyValue>>;
};

export type Analytics = {
  /** Consent is opt-in and defaults to off (doc 11, P02 §11). */
  hasConsent(): boolean;
  setConsent(granted: boolean): void;
  /** No-op until consent is granted; never throws. */
  track(event: AnalyticsEvent): void;
};

/** Where consented events would go (PostHog in a later phase). */
export type AnalyticsSink = {
  send(event: AnalyticsEvent): void;
};
