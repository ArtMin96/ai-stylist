// Typed `EXPO_PUBLIC_*` keys (mirrors the "Mobile / Expo" block of the repo-root .env.example).
// Expo types `process.env` values as `any`; these declarations make our keys `string | undefined`.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_EAS_PROJECT_ID?: string;
  }
}
