/**
 * Structural match for the shared-kernel `FeatureFlags` port
 * (packages/shared-kernel/src/feature-flags.ts), plus `set` to flip a flag mid-test. `K` is the
 * flag-key union: API tests pass the kernel's, `fakeFeatureFlags<FeatureFlagKey>({ … })`.
 */
export type FakeFeatureFlags<K extends string = string> = {
  isEnabled(key: K): Promise<boolean>;
  /** Turn `key` on or off for every later check. */
  set(key: K, on: boolean): void;
};

/**
 * Flags answering `values`. A key not given is off (every flag's off state is its safe rollback,
 * planning/14 §11), so a test names each flag it depends on. Never throws, like the port.
 */
export function fakeFeatureFlags<K extends string = string>(
  values: Partial<Record<K, boolean>> = {},
): FakeFeatureFlags<K> {
  const current: Partial<Record<K, boolean>> = { ...values };
  return {
    isEnabled: (key) => Promise.resolve(current[key] === true),
    set: (key, on) => {
      current[key] = on;
    },
  };
}
