// Composition root (planning/04 §4.3 `composition-root-only`; the docs call it `_root.tsx`, but
// expo-router names the root layout `_layout.tsx`). This is the only file that reads env and
// constructs adapters: config, API request options, analytics. Screens receive them via context.
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { createApiConfig } from '@/data/api';
import { createConsentGatedAnalytics, noopSink } from '@/lib/analytics';
import { AppServicesProvider, type AppServices } from '@/lib/app-services';
import { parseConfig, readPublicEnv } from '@/lib/config';

export function composeServices(): AppServices {
  const config = parseConfig(readPublicEnv(Constants.expoConfig?.version));
  return {
    config,
    api: createApiConfig(config.apiBaseUrl),
    // P02: consent stub with a no-op sink — zero events leave the device (P02 §11).
    analytics: createConsentGatedAnalytics(noopSink),
  };
}

export default function RootLayout() {
  const services = useMemo(() => composeServices(), []);
  return (
    <AppServicesProvider services={services}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppServicesProvider>
  );
}
