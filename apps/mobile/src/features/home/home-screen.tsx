// Placeholder home screen (P02): proves the generated client reaches the API and that analytics
// stays off until consent. Real journeys land in src/features (planning/02).
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { fetchVersion, type VersionResult } from '@/data/version';
import { useAppServices } from '@/lib/app-services';

export function HomeScreen() {
  const { api, analytics, config } = useAppServices();
  // `null` = a request is in flight; keyed by attempt so Retry restarts the request.
  const [version, setVersion] = useState<{ attempt: number; result: VersionResult } | null>(null);
  const [consent, setConsent] = useState(analytics.hasConsent());
  const [attempt, setAttempt] = useState(0);
  const loading = version === null || version.attempt !== attempt;

  useEffect(() => {
    // Registered in packages/contracts/events/analytics/events.json; consentRequired, so the
    // gate drops it until the user opts in.
    analytics.track({
      name: 'app_opened',
      properties: { platform: Platform.OS, appVersion: config.appVersion, coldStart: true },
    });
  }, [analytics, config.appVersion]);

  useEffect(() => {
    let cancelled = false;
    void fetchVersion(api).then((result) => {
      if (!cancelled) setVersion({ attempt, result });
    });
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  const onConsentChange = (granted: boolean) => {
    analytics.setConsent(granted);
    setConsent(granted);
  };

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        AI Stylist
      </Text>
      <Text style={styles.caption}>API: {config.apiBaseUrl}</Text>

      <View style={styles.card} accessible accessibilityLabel="API version">
        {loading ? (
          <Text style={styles.body}>Checking API version…</Text>
        ) : version.result.ok ? (
          <Text style={styles.body} testID="api-version">
            API {version.result.version.version} ({version.result.version.commit.slice(0, 7)})
          </Text>
        ) : (
          <>
            <Text style={styles.body} testID="api-error">
              The API is not reachable right now: {version.result.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt((n) => n + 1)}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>Retry</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.row}>
        <Text style={styles.body}>Share anonymous usage data</Text>
        <Switch
          accessibilityLabel="Share anonymous usage data"
          onValueChange={onConsentChange}
          value={consent}
        />
      </View>
      <Text style={styles.caption}>Off by default. Nothing is sent until you opt in.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700' },
  caption: { fontSize: 13, opacity: 0.7 },
  card: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  body: { fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
