# `@ai-stylist/mobile` — React Native + Expo client

Expo (prebuild / dev-client, New Architecture) app for AI Stylist. P02 ships a skeleton: one
placeholder screen that calls `GET /v1/version` through the generated contracts client, a consent
toggle wired to an analytics stub that sends nothing, the module layout, tests, and the build
recipes. Product journeys land in later phases (`.agents/skills/mobile-feature/SKILL.md`).

## Toolchain facts, verified 2026-09-10

| Fact                 | Value                                                                                                                                                                                                                                | How verified                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo SDK             | **57** (`expo@~57.0.21`, latest stable; the P02 brief said "55+")                                                                                                                                                                    | `npm view expo dist-tags.latest` → 57.0.21; `create-expo-app@latest --template blank-typescript` scaffold                                                           |
| React / React Native | `react@19.2.3`, `react-native@0.86.3`                                                                                                                                                                                                | same scaffold; `npx expo install --fix` reports "Dependencies are up to date"; `npx expo-doctor` 21/21 checks passed                                                |
| expo-router          | `~57.0.20`; routes under `src/app/` (a supported default, no `root` plugin option)                                                                                                                                                   | docs.expo.dev/router/reference/src-directory (Context7, 2026-09-10)                                                                                                 |
| New Architecture     | always on; SDK 57 removed `newArchEnabled` from `ExpoConfig` (typecheck error if set); prebuild writes `newArchEnabled=true` to `gradle.properties`                                                                                  | `tsc`, `expo prebuild` output                                                                                                                                       |
| pnpm linker          | **isolated (default)** — Expo supports isolated installs since SDK 54; `node-linker=hoisted` is only a fallback if a native library misresolves. `.npmrc` / `pnpm-workspace.yaml` unchanged                                          | docs.expo.dev/guides/monorepos "Package managers with isolated dependencies" (Context7, 2026-09-10); `expo prebuild` + `expo export` succeed with the isolated tree |
| JDK for Gradle       | 17 (`@react-native/gradle-plugin@0.86.3` uses `kotlin { jvmToolchain(17) }`); `mise.toml` Temurin 17 stays valid                                                                                                                     | plugin source in `node_modules`                                                                                                                                     |
| Tests                | `jest-expo@~57`, `@testing-library/react-native@14` (async `render`), `msw@2` via `msw/node`                                                                                                                                         | `pnpm test` (9 tests)                                                                                                                                               |
| ESLint               | ESLint 10 + root config + `eslint-plugin-react-hooks@7` + `eslint-plugin-expo`. **`eslint-config-expo@57` and `eslint-plugin-react-native@5` crash on ESLint 10** (`context.getFilename` / `getSourceCode` removed) and are not used | `pnpm lint`                                                                                                                                                         |
| Metro                | needs `metro.config.js` `.js`→`.ts` fallback so NodeNext specifiers in `packages/*` resolve                                                                                                                                          | `expo export --platform android` (2.7 MB Hermes bundle)                                                                                                             |

## Layout

```
app.config.ts        Expo config (CNG; ios/ and android/ are generated, never committed)
eas.json             EAS profiles dev | preview | prod (no credentials; `eas init` sets the project id)
metro.config.js      Expo default + workspace `.js`→`.ts` resolver fallback
src/app/             expo-router routes. _layout.tsx = COMPOSITION ROOT (the only file that reads
                     env and constructs adapters). Route files only re-export feature screens.
src/features/        feature modules (screens, hooks, tests/); home/ is the P02 placeholder
src/data/            data layer: generated contracts client + shared-kernel only
src/lib/             config (EXPO_PUBLIC_* validator), analytics port + consent stub, services context
src/render/          Filament boundary — README only in P02; lint-restricted (render-boundary)
e2e/                 Maestro flows (documented test-placement exception)
```

Boundary rules enforced by `eslint.config.mjs` (`no-restricted-imports`) and, from T06, by
dependency-cruiser: `render-boundary` (only `src/render/**` and `src/features/avatar/**` may import
`react-native-filament` or `src/render`), `mobile/workers-not-server` (workspace imports limited to
`@ai-stylist/contracts` and `@ai-stylist/shared-kernel`).

Naming note: planning docs call the composition root `src/app/_root.tsx`; expo-router requires the
root layout to be `_layout.tsx`, so that file is the composition root.

## Configuration

`EXPO_PUBLIC_*` keys come from the repo-root `.env` (`.env.example` lists them, values empty):

- `EXPO_PUBLIC_API_BASE_URL` — API base URL; empty = `http://localhost:3000`. A physical phone
  cannot reach your laptop's `localhost`: set it to `http://<your-LAN-IP>:3000`.
- `EXPO_PUBLIC_EAS_PROJECT_ID` — set after `eas init` (human step; no Expo account yet, P02 §3).

`EXPO_PUBLIC_*` values are inlined into the JS bundle at build time — never put secrets there.

## Commands (`just` first, package scripts underneath)

```bash
just dev-mobile                 # Metro for a development build (expo start --dev-client)
just dev-mobile --android       # …and open on a connected Android device/emulator (needs adb)
pnpm --filter @ai-stylist/mobile test | lint | typecheck | doctor | export
just mobile-android-build --profile dev|preview|prod        # prebuild + Gradle (needs ANDROID_HOME)
just mobile-android-build --cloud --profile preview         # EAS Build (needs EXPO_TOKEN / eas login)
just mobile-ios-build --cloud eas|gha --profile dev|preview|prod   # never local on Linux
```

## Running on an Android phone from a fresh clone

1. `just bootstrap` (mise toolchain + `pnpm install`), then `just doctor`.
2. Phone: Settings → About → tap "Build number" 7× → Developer options → enable **USB debugging**.
   Plug in via USB, accept the RSA prompt. `adb devices` must list the phone as `device`
   (`adb` comes with the Android platform-tools; `just bootstrap --system` installs the SDK + udev rules).
3. Start the API (`just dev-api`) and set `EXPO_PUBLIC_API_BASE_URL=http://<laptop-LAN-IP>:3000` in
   `.env` (phone and laptop on the same Wi-Fi).
4. **P02 placeholder: Expo Go is enough.** The skeleton uses only modules bundled in Expo Go
   (expo-router, expo-constants, expo-status-bar, screens, safe-area). Install Expo Go from the
   Play Store and run:
   `pnpm --filter @ai-stylist/mobile exec expo start --go --android`
   (`just dev-mobile` starts Metro in dev-client mode; press `s` in the terminal to switch to Expo Go).
5. **Development build (required as soon as a native module such as `react-native-filament` is
   added):** `just mobile-android-build --profile dev` (needs the Android SDK + JDK 17 from mise),
   install `android/app/build/outputs/apk/debug/app-debug.apk` with `adb install`, then
   `just dev-mobile --android`. Without a local SDK, use `--cloud` (EAS) once the Expo account exists.

iOS cannot be built or run from Linux; the CI lanes (`.github/workflows/ios-*.yml`, ADR-0002) do it.

## Tests

- `pnpm --filter @ai-stylist/mobile test` — Jest (`jest-expo`) + RN Testing Library + MSW. Tests
  live in `tests/` directories next to the code (`src/features/home/tests/`, `src/lib/tests/`,
  `src/lib/analytics/tests/`). They cannot live under `src/app/`: expo-router's `require.context`
  bundles every file there, so a test file would become a route and drag `msw` into the app bundle.
- `e2e/smoke.yaml` — Maestro; needs a device/emulator and the Maestro CLI (nightly CI tier). Not
  runnable on the P02 Linux dev machine.

## Not in P02 (on purpose)

- `react-native-filament` — added with the P01-gated 3D work; `src/render/README.md`.
- PostHog RN SDK — the consent stub's sink is a no-op; the port stays (`src/lib/analytics`).
- Crash reporting, dark mode (`expo-system-ui`), splash/icon branding (placeholders in `assets/`).
