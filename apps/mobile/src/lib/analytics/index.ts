// Public surface of the analytics port: the types live in ./port so implementations can import
// them without a cycle through this barrel (rule: no-cycles).
export type { Analytics, AnalyticsEvent, AnalyticsPropertyValue, AnalyticsSink } from './port';
export { createConsentGatedAnalytics, noopSink } from './consent-stub';
