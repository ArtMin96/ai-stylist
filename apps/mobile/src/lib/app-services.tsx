// Dependency container handed down from the composition root. Screens read adapters through
// `useAppServices()`; only src/app/_layout.tsx (and tests) construct one.
import { createContext, useContext, type ReactNode } from 'react';

import type { ApiConfig } from '@/data/api';
import type { Analytics } from '@/lib/analytics';
import type { MobileConfig } from '@/lib/config';

export type AppServices = {
  readonly config: MobileConfig;
  readonly api: ApiConfig;
  readonly analytics: Analytics;
};

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider(props: { services: AppServices; children: ReactNode }) {
  return (
    <AppServicesContext.Provider value={props.services}>
      {props.children}
    </AppServicesContext.Provider>
  );
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (services === null) {
    throw new Error('useAppServices() called outside the composition root provider');
  }
  return services;
}
