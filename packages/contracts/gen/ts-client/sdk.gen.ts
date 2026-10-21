// GENERATED — do not edit. Run `just generate`.
// Source: packages/contracts/openapi/**

import { client } from './client.gen.js';
import type {
  Client,
  ClientMeta,
  Options as Options2,
  RequestResult,
  TDataShape,
} from './client/index.js';
import type {
  CancelAccountDeletionData,
  CancelAccountDeletionErrors,
  CancelAccountDeletionResponses,
  CancelAccountRecoveryData,
  CancelAccountRecoveryErrors,
  CancelAccountRecoveryResponses,
  CompleteAccountRecoveryData,
  CompleteAccountRecoveryErrors,
  CompleteAccountRecoveryResponses,
  CompleteSignUpData,
  CompleteSignUpErrors,
  CompleteSignUpResponses,
  GetDataExportData,
  GetDataExportErrors,
  GetDataExportResponses,
  GetEntitlementsData,
  GetEntitlementsErrors,
  GetEntitlementsResponses,
  GetHealthData,
  GetHealthErrors,
  GetHealthResponses,
  GetMeasurementsData,
  GetMeasurementsErrors,
  GetMeasurementsResponses,
  GetOnboardingProgressData,
  GetOnboardingProgressErrors,
  GetOnboardingProgressResponses,
  GetPasskeyRegistrationOptionsData,
  GetPasskeyRegistrationOptionsErrors,
  GetPasskeyRegistrationOptionsResponses,
  GetPasskeySignInOptionsData,
  GetPasskeySignInOptionsErrors,
  GetPasskeySignInOptionsResponses,
  GetPreferencesData,
  GetPreferencesErrors,
  GetPreferencesResponses,
  GetProfileData,
  GetProfileErrors,
  GetProfileResponses,
  GetSessionData,
  GetSessionErrors,
  GetSessionResponses,
  GetVersionData,
  GetVersionErrors,
  GetVersionResponses,
  ListConsentsData,
  ListConsentsErrors,
  ListConsentsResponses,
  ListDeviceSessionsData,
  ListDeviceSessionsErrors,
  ListDeviceSessionsResponses,
  RecordConsentData,
  RecordConsentErrors,
  RecordConsentResponses,
  RefreshSessionData,
  RefreshSessionErrors,
  RefreshSessionResponses,
  RegisterPasskeyData,
  RegisterPasskeyErrors,
  RegisterPasskeyResponses,
  ReplaceMeasurementsData,
  ReplaceMeasurementsErrors,
  ReplaceMeasurementsResponses,
  RequestAccountDeletionData,
  RequestAccountDeletionErrors,
  RequestAccountDeletionResponses,
  RequestAccountRecoveryData,
  RequestAccountRecoveryErrors,
  RequestAccountRecoveryResponses,
  RequestDataExportData,
  RequestDataExportErrors,
  RequestDataExportResponses,
  SignInWithIdTokenData,
  SignInWithIdTokenErrors,
  SignInWithIdTokenResponses,
  SignInWithPasskeyData,
  SignInWithPasskeyErrors,
  SignInWithPasskeyResponses,
  SignOutAllDevicesData,
  SignOutAllDevicesErrors,
  SignOutAllDevicesResponses,
  SignOutData,
  SignOutErrors,
  SignOutResponses,
  UpdateOnboardingProgressData,
  UpdateOnboardingProgressErrors,
  UpdateOnboardingProgressResponses,
  UpdatePreferencesData,
  UpdatePreferencesErrors,
  UpdatePreferencesResponses,
  UpdateProfileData,
  UpdateProfileErrors,
  UpdateProfileResponses,
} from './types.gen.js';

export type Options<
  TData extends TDataShape = TDataShape,
  ThrowOnError extends boolean = boolean,
  TResponse = unknown,
> = Options2<TData, ThrowOnError, TResponse> & {
  /**
   * You can provide a client instance returned by `createClient()` instead of
   * individual options. This might be also useful if you want to implement a
   * custom client.
   */
  client?: Client;
  /**
   * You can pass arbitrary values through the `meta` object. This can be
   * used to access values that aren't defined as part of the SDK function.
   */
  meta?: keyof ClientMeta extends never ? Record<string, unknown> : ClientMeta;
};

/**
 * Liveness and dependency health
 *
 * Returns `ok` when the API and every checked dependency are reachable.
 */
export const getHealth = <ThrowOnError extends boolean = false>(
  options?: Options<GetHealthData, ThrowOnError>,
): RequestResult<GetHealthResponses, GetHealthErrors, ThrowOnError> =>
  (options?.client ?? client).get<GetHealthResponses, GetHealthErrors, ThrowOnError>({
    url: '/v1/health',
    ...options,
  });

/**
 * Build identity of the running API
 *
 * Semantic version, commit SHA and build timestamp of the deployed API.
 */
export const getVersion = <ThrowOnError extends boolean = false>(
  options?: Options<GetVersionData, ThrowOnError>,
): RequestResult<GetVersionResponses, GetVersionErrors, ThrowOnError> =>
  (options?.client ?? client).get<GetVersionResponses, GetVersionErrors, ThrowOnError>({
    url: '/v1/version',
    ...options,
  });

/**
 * Sign in with an Apple or Google identity token
 *
 * The app runs the provider's native sign-in and sends the identity token it received.
 * The server verifies the token with the provider's keys, then answers with one
 * `SignInResult`: a session for an existing account, `sign_up_required` for an identity
 * with no account (nothing is stored until `completeSignUp` accepts the birth year), or
 * `deletion_pending` for an account inside its deletion grace window (no session). No
 * provider token is ever returned.
 *
 */
export const signInWithIdToken = <ThrowOnError extends boolean = false>(
  options: Options<SignInWithIdTokenData, ThrowOnError>,
): RequestResult<SignInWithIdTokenResponses, SignInWithIdTokenErrors, ThrowOnError> =>
  (options.client ?? client).post<
    SignInWithIdTokenResponses,
    SignInWithIdTokenErrors,
    ThrowOnError
  >({
    url: '/v1/auth/sign-in/social',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Complete a pending sign-up with the self-declared birth year (age gate)
 *
 * Second part of a sign-up. The first part is a sign-in whose answer was
 * `sign_up_required`; the `signUpToken` of that answer authorizes this call. The server
 * applies the age gate (16+, DEC-60) to the birth year. Accepted: the account is created
 * and the answer is the `session` outcome. Refused: `AGE_GATE_FAILED`, nothing about the
 * attempt is stored, and the sign-up token is spent; a new attempt starts again with a
 * sign-in. Identity's own operation: better-auth 1.7.12 has no path for it.
 *
 */
export const completeSignUp = <ThrowOnError extends boolean = false>(
  options: Options<CompleteSignUpData, ThrowOnError>,
): RequestResult<CompleteSignUpResponses, CompleteSignUpErrors, ThrowOnError> =>
  (options.client ?? client).post<CompleteSignUpResponses, CompleteSignUpErrors, ThrowOnError>({
    url: '/v1/auth/sign-up/complete',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * WebAuthn options for a passkey sign-in
 *
 * Returns a fresh challenge and the WebAuthn request options (W3C WebAuthn
 * `PublicKeyCredentialRequestOptionsJSON`) for the platform passkey API. Without a session
 * no credentials are listed, so the device offers its discoverable passkeys.
 *
 */
export const getPasskeySignInOptions = <ThrowOnError extends boolean = false>(
  options?: Options<GetPasskeySignInOptionsData, ThrowOnError>,
): RequestResult<GetPasskeySignInOptionsResponses, GetPasskeySignInOptionsErrors, ThrowOnError> =>
  (options?.client ?? client).get<
    GetPasskeySignInOptionsResponses,
    GetPasskeySignInOptionsErrors,
    ThrowOnError
  >({ url: '/v1/auth/passkey/generate-authenticate-options', ...options });

/**
 * Sign in with a passkey assertion
 *
 * Verifies the assertion the platform passkey API returned for the challenge of
 * `getPasskeySignInOptions`. Answers `session`, or `deletion_pending` for an account inside
 * its deletion grace window. A passkey always belongs to an existing account, so this
 * operation never answers `sign_up_required`.
 *
 */
export const signInWithPasskey = <ThrowOnError extends boolean = false>(
  options: Options<SignInWithPasskeyData, ThrowOnError>,
): RequestResult<SignInWithPasskeyResponses, SignInWithPasskeyErrors, ThrowOnError> =>
  (options.client ?? client).post<
    SignInWithPasskeyResponses,
    SignInWithPasskeyErrors,
    ThrowOnError
  >({
    url: '/v1/auth/passkey/verify-authentication',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * WebAuthn options to add a passkey to the signed-in account
 *
 * Returns a fresh challenge and the WebAuthn creation options (W3C WebAuthn
 * `PublicKeyCredentialCreationOptionsJSON`). The account's existing passkeys are listed as
 * excluded credentials. Needs a recent sign-in (`RecentSignInRequired`); otherwise 403
 * `FORBIDDEN`, and the client signs in again first.
 *
 */
export const getPasskeyRegistrationOptions = <ThrowOnError extends boolean = false>(
  options?: Options<GetPasskeyRegistrationOptionsData, ThrowOnError>,
): RequestResult<
  GetPasskeyRegistrationOptionsResponses,
  GetPasskeyRegistrationOptionsErrors,
  ThrowOnError
> =>
  (options?.client ?? client).get<
    GetPasskeyRegistrationOptionsResponses,
    GetPasskeyRegistrationOptionsErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/auth/passkey/generate-register-options',
    ...options,
  });

/**
 * Add a passkey to the signed-in account
 *
 * Verifies the attestation the platform passkey API returned for the challenge of
 * `getPasskeyRegistrationOptions` and stores the passkey on the caller's account. An
 * account may hold several passkeys. Opens no new session.
 *
 */
export const registerPasskey = <ThrowOnError extends boolean = false>(
  options: Options<RegisterPasskeyData, ThrowOnError>,
): RequestResult<RegisterPasskeyResponses, RegisterPasskeyErrors, ThrowOnError> =>
  (options.client ?? client).post<RegisterPasskeyResponses, RegisterPasskeyErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/auth/passkey/verify-registration',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Read the current session
 *
 * The account of the session the access token belongs to, and when that access token
 * expires. Read-only: it extends nothing and returns no token (better-auth
 * `deferSessionRefresh`). A token with no live session is answered with 401, never with
 * an empty body.
 *
 */
export const getSession = <ThrowOnError extends boolean = false>(
  options?: Options<GetSessionData, ThrowOnError>,
): RequestResult<GetSessionResponses, GetSessionErrors, ThrowOnError> =>
  (options?.client ?? client).get<GetSessionResponses, GetSessionErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/auth/get-session',
    ...options,
  });

/**
 * Renew a session with its refresh token
 *
 * Exchanges the session's refresh token for a new pair: a new access token and a new
 * refresh token (doc 11 §4.2). The refresh token travels in the body, never in
 * `Authorization`, and the access token never renews a session. The refresh token rotates
 * on every use: the presented one is spent, and the client stores the returned pair and
 * discards the old one. Presenting a refresh token that was already rotated revokes every
 * token of its session (the session family) and is answered 401. Every 401 here is a
 * refused renewal: the client erases the session's tokens on the device and signs in
 * again. If the answer is lost, the client may retry once with the same refresh token and
 * a new `Idempotency-Key`; a refused retry ends the session the same way. Identity's own
 * operation: better-auth 1.7.12 has no refresh token.
 *
 */
export const refreshSession = <ThrowOnError extends boolean = false>(
  options: Options<RefreshSessionData, ThrowOnError>,
): RequestResult<RefreshSessionResponses, RefreshSessionErrors, ThrowOnError> =>
  (options.client ?? client).post<RefreshSessionResponses, RefreshSessionErrors, ThrowOnError>({
    url: '/v1/auth/session/refresh',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Sign out this device
 *
 * Revokes the session the bearer token belongs to on the server.
 */
export const signOut = <ThrowOnError extends boolean = false>(
  options?: Options<SignOutData, ThrowOnError>,
): RequestResult<SignOutResponses, SignOutErrors, ThrowOnError> =>
  (options?.client ?? client).post<SignOutResponses, SignOutErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/auth/sign-out',
    ...options,
  });

/**
 * List the signed-in devices of the caller
 *
 * One entry per active session of the caller's account (the device list, doc 11 §4.2),
 * newest first, cursor-paginated (doc 06 §2). Never another user's sessions and never a
 * session token.
 *
 */
export const listDeviceSessions = <ThrowOnError extends boolean = false>(
  options?: Options<ListDeviceSessionsData, ThrowOnError>,
): RequestResult<ListDeviceSessionsResponses, ListDeviceSessionsErrors, ThrowOnError> =>
  (options?.client ?? client).get<
    ListDeviceSessionsResponses,
    ListDeviceSessionsErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/auth/list-sessions',
    ...options,
  });

/**
 * Sign out every device
 *
 * Revokes every session of the caller's account, the current one included.
 */
export const signOutAllDevices = <ThrowOnError extends boolean = false>(
  options?: Options<SignOutAllDevicesData, ThrowOnError>,
): RequestResult<SignOutAllDevicesResponses, SignOutAllDevicesErrors, ThrowOnError> =>
  (options?.client ?? client).post<
    SignOutAllDevicesResponses,
    SignOutAllDevicesErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/auth/revoke-sessions',
    ...options,
  });

/**
 * Ask for an account-recovery link by email
 *
 * Fallback for a person who lost their passkeys (doc 11 §15). The answer is the same
 * status and body whether or not an account exists for the address, so it discloses
 * nothing. When one exists, a single-use link is emailed; it works from 24 to 48 hours
 * after the request, and any signed-in session of the account can cancel it before then
 * (`cancelAccountRecovery`). The link opens the app (a universal link on iOS, an app link
 * on Android), never an API URL, and carries its token in the URL fragment, which no
 * server, proxy or link scanner receives; the app then calls `completeAccountRecovery`.
 * Never creates an account.
 *
 */
export const requestAccountRecovery = <ThrowOnError extends boolean = false>(
  options: Options<RequestAccountRecoveryData, ThrowOnError>,
): RequestResult<RequestAccountRecoveryResponses, RequestAccountRecoveryErrors, ThrowOnError> =>
  (options.client ?? client).post<
    RequestAccountRecoveryResponses,
    RequestAccountRecoveryErrors,
    ThrowOnError
  >({
    url: '/v1/auth/sign-in/magic-link',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Use an account-recovery link
 *
 * The app sends the token of the recovery link it was opened with and gets a sign-in
 * (`SignInResult`). The token travels only in this request body: no GET spends it, and no
 * URL carries it to the API. Before the 24-hour delay has passed the use is refused and
 * the token is not spent, so the same link works once the delay is over. From 48 hours
 * after the request, after a cancel, and on a second use it is refused. The person then
 * adds a new passkey with `registerPasskey`. Identity's own operation: the better-auth
 * 1.7.12 magic-link plugin verifies only by a GET that spends the token, and that path is
 * not served.
 *
 */
export const completeAccountRecovery = <ThrowOnError extends boolean = false>(
  options: Options<CompleteAccountRecoveryData, ThrowOnError>,
): RequestResult<CompleteAccountRecoveryResponses, CompleteAccountRecoveryErrors, ThrowOnError> =>
  (options.client ?? client).post<
    CompleteAccountRecoveryResponses,
    CompleteAccountRecoveryErrors,
    ThrowOnError
  >({
    url: '/v1/auth/recovery/complete',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Cancel a pending account recovery
 *
 * Cancels the pending recovery link of the caller's account during its 24-hour delay.
 * Only a signed-in session of that account can cancel; holding the mailbox is not
 * enough. Identity's own operation: better-auth 1.7.12 has no path for it.
 *
 */
export const cancelAccountRecovery = <ThrowOnError extends boolean = false>(
  options?: Options<CancelAccountRecoveryData, ThrowOnError>,
): RequestResult<CancelAccountRecoveryResponses, CancelAccountRecoveryErrors, ThrowOnError> =>
  (options?.client ?? client).delete<
    CancelAccountRecoveryResponses,
    CancelAccountRecoveryErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/recovery',
    ...options,
  });

/**
 * The caller's current consent per purpose
 *
 * The latest consent record of each purpose the caller has decided on, cursor-paginated.
 * A purpose with no record is absent and its default applies (doc 11 §7.2). The full
 * append-only history is part of the data export.
 *
 */
export const listConsents = <ThrowOnError extends boolean = false>(
  options?: Options<ListConsentsData, ThrowOnError>,
): RequestResult<ListConsentsResponses, ListConsentsErrors, ThrowOnError> =>
  (options?.client ?? client).get<ListConsentsResponses, ListConsentsErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/consents',
    ...options,
  });

/**
 * Grant or withdraw consent for one purpose
 *
 * Appends a consent record for one purpose (doc 11 §7.1; append-only: a withdrawal is a
 * new record). 201 when a record was appended. 200 when the request repeats the current
 * state for the same policy version: nothing is stored and the current record, with its
 * original dates, is returned.
 *
 */
export const recordConsent = <ThrowOnError extends boolean = false>(
  options: Options<RecordConsentData, ThrowOnError>,
): RequestResult<RecordConsentResponses, RecordConsentErrors, ThrowOnError> =>
  (options.client ?? client).post<RecordConsentResponses, RecordConsentErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/consents',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Request an export of the caller's data
 *
 * Starts an asynchronous export of the caller's data (doc 11 §13.1), open on every plan
 * (`data.export`). Answers at once with the new export `in_progress`; the client reads it
 * with `getDataExport` until it is `ready` (a notification follows as well). One export
 * runs at a time per account: while one is in progress, a new request is refused with 429
 * and the running export. Re-authentication, the same rule as `requestAccountDeletion`:
 * needs a recent sign-in (`RecentSignInRequired`); otherwise 403 `FORBIDDEN`, and the
 * client signs in again first.
 *
 */
export const requestDataExport = <ThrowOnError extends boolean = false>(
  options?: Options<RequestDataExportData, ThrowOnError>,
): RequestResult<RequestDataExportResponses, RequestDataExportErrors, ThrowOnError> =>
  (options?.client ?? client).post<
    RequestDataExportResponses,
    RequestDataExportErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/exports',
    ...options,
  });

/**
 * Read one of the caller's data exports
 *
 * The state of an export. While it is `ready`, every read mints a new download link after
 * the same authorization check; the link lives at most 10 minutes (DEC-44, doc 11 §5.4).
 * The archive itself is kept until `availableUntil`. Never cached.
 *
 */
export const getDataExport = <ThrowOnError extends boolean = false>(
  options: Options<GetDataExportData, ThrowOnError>,
): RequestResult<GetDataExportResponses, GetDataExportErrors, ThrowOnError> =>
  (options.client ?? client).get<GetDataExportResponses, GetDataExportErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/exports/{id}',
    ...options,
  });

/**
 * Cancel the account deletion inside its grace window
 *
 * Stops a pending account deletion during its 7-day grace window (DEC-65). The only
 * credential accepted is the cancel credential of the `deletion_pending` sign-in outcome
 * (`deletionCancelToken`); the caller holds no session, because the deletion revoked them
 * all. The account is active again, but no session is opened or restored: the client signs
 * in again. Once the window has ended the cancel is refused with 410 `ACCOUNT_DELETED`.
 *
 */
export const cancelAccountDeletion = <ThrowOnError extends boolean = false>(
  options?: Options<CancelAccountDeletionData, ThrowOnError>,
): RequestResult<CancelAccountDeletionResponses, CancelAccountDeletionErrors, ThrowOnError> =>
  (options?.client ?? client).delete<
    CancelAccountDeletionResponses,
    CancelAccountDeletionErrors,
    ThrowOnError
  >({
    security: [{ name: 'Deletion-Cancel-Token', type: 'apiKey' }],
    url: '/v1/me/deletion',
    ...options,
  });

/**
 * Request deletion of the caller's account
 *
 * Starts the deletion of the caller's account (doc 11 §13.2). At once every session of the
 * account is revoked, this one included, and a sign-in opens no session; the account is
 * kept for a 7-day grace window (DEC-65). A sign-in during the window answers
 * `deletion_pending`, whose cancel credential can stop the deletion
 * (`cancelAccountDeletion`). After the window the purge runs and cannot be stopped.
 * Re-authentication (doc 02 §11.3): needs a recent sign-in (`RecentSignInRequired`);
 * otherwise 403 `FORBIDDEN`, and the client signs in again first. After the answer the
 * tokens of this session no longer work and the client returns to its signed-out start.
 * Deleting the account does not cancel a store subscription.
 *
 */
export const requestAccountDeletion = <ThrowOnError extends boolean = false>(
  options?: Options<RequestAccountDeletionData, ThrowOnError>,
): RequestResult<RequestAccountDeletionResponses, RequestAccountDeletionErrors, ThrowOnError> =>
  (options?.client ?? client).post<
    RequestAccountDeletionResponses,
    RequestAccountDeletionErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/deletion',
    ...options,
  });

/**
 * Read the caller's profile settings
 *
 * Presentation, starting shape and the six settings of REQ-ONB-100. A profile nothing has
 * been written to answers with its defaults and `version` 0.
 *
 */
export const getProfile = <ThrowOnError extends boolean = false>(
  options?: Options<GetProfileData, ThrowOnError>,
): RequestResult<GetProfileResponses, GetProfileErrors, ThrowOnError> =>
  (options?.client ?? client).get<GetProfileResponses, GetProfileErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/profile',
    ...options,
  });

/**
 * Change some of the caller's profile settings
 *
 * Partial update (see the file header): each member present replaces its stored value.
 * Answers with the whole profile at its new `version`.
 *
 */
export const updateProfile = <ThrowOnError extends boolean = false>(
  options: Options<UpdateProfileData, ThrowOnError>,
): RequestResult<UpdateProfileResponses, UpdateProfileErrors, ThrowOnError> =>
  (options.client ?? client).patch<UpdateProfileResponses, UpdateProfileErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/profile',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Read the caller's body measurements
 *
 * The caller's current measurement set, in SI units. A set nothing has been written to
 * answers with no measurement and `version` 0. Never cached.
 *
 */
export const getMeasurements = <ThrowOnError extends boolean = false>(
  options?: Options<GetMeasurementsData, ThrowOnError>,
): RequestResult<GetMeasurementsResponses, GetMeasurementsErrors, ThrowOnError> =>
  (options?.client ?? client).get<GetMeasurementsResponses, GetMeasurementsErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/measurements',
    ...options,
  });

/**
 * Replace the caller's body measurements
 *
 * Replaces the whole set. A measurement absent from `measurements` is removed, which is how
 * a single field is cleared; `{}` removes every measurement. Values are SI (`cm`, `kg`);
 * the app converts for display only. Answers with the stored set at its new `version`.
 *
 */
export const replaceMeasurements = <ThrowOnError extends boolean = false>(
  options: Options<ReplaceMeasurementsData, ThrowOnError>,
): RequestResult<ReplaceMeasurementsResponses, ReplaceMeasurementsErrors, ThrowOnError> =>
  (options.client ?? client).put<
    ReplaceMeasurementsResponses,
    ReplaceMeasurementsErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/measurements',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Read the caller's style preferences
 *
 * Fit and style preferences, soft dislikes and hard exclusions, climate tolerance,
 * occasions and the typical day, and usual sizes. Preferences nothing has been written to
 * answer with empty lists and `version` 0.
 *
 */
export const getPreferences = <ThrowOnError extends boolean = false>(
  options?: Options<GetPreferencesData, ThrowOnError>,
): RequestResult<GetPreferencesResponses, GetPreferencesErrors, ThrowOnError> =>
  (options?.client ?? client).get<GetPreferencesResponses, GetPreferencesErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/preferences',
    ...options,
  });

/**
 * Change some of the caller's style preferences
 *
 * Partial update (see the file header): each member present replaces its stored value
 * whole, an empty list or object empties it, and `clear` removes `climateTolerance` or
 * `typicalDay`. Answers with all preferences at their new `version`.
 *
 */
export const updatePreferences = <ThrowOnError extends boolean = false>(
  options: Options<UpdatePreferencesData, ThrowOnError>,
): RequestResult<UpdatePreferencesResponses, UpdatePreferencesErrors, ThrowOnError> =>
  (options.client ?? client).patch<
    UpdatePreferencesResponses,
    UpdatePreferencesErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/preferences',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Read the caller's onboarding progress
 *
 * Per-step progress of the onboarding flow (doc 02 §3.2) and the step the app resumes at
 * after a quit or a crash.
 *
 */
export const getOnboardingProgress = <ThrowOnError extends boolean = false>(
  options?: Options<GetOnboardingProgressData, ThrowOnError>,
): RequestResult<GetOnboardingProgressResponses, GetOnboardingProgressErrors, ThrowOnError> =>
  (options?.client ?? client).get<
    GetOnboardingProgressResponses,
    GetOnboardingProgressErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/onboarding-progress',
    ...options,
  });

/**
 * Record the outcome of onboarding steps
 *
 * Records `completed` or `skipped` for each step present. A status only moves forward
 * (`pending` → `skipped` → `completed`): a write that would move a step back leaves it
 * unchanged and is still answered with 200, so a replayed or late write from a device's
 * local buffer is harmless. Answers with the whole progress.
 *
 */
export const updateOnboardingProgress = <ThrowOnError extends boolean = false>(
  options: Options<UpdateOnboardingProgressData, ThrowOnError>,
): RequestResult<UpdateOnboardingProgressResponses, UpdateOnboardingProgressErrors, ThrowOnError> =>
  (options.client ?? client).patch<
    UpdateOnboardingProgressResponses,
    UpdateOnboardingProgressErrors,
    ThrowOnError
  >({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/onboarding-progress',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

/**
 * Read the caller's resolved entitlements
 *
 * The entitlements the server resolves for the caller now (doc 12 §3.2): over the caller's
 * active grants the most generous value wins, per entitlement; an entitlement no active
 * grant supplies takes its Free-plan value (doc 12 §1.2). Every registered entitlement
 * appears once. The apps may cache the answer briefly to render (doc 12 §3.3); a gated
 * request is decided by the server alone.
 *
 */
export const getEntitlements = <ThrowOnError extends boolean = false>(
  options?: Options<GetEntitlementsData, ThrowOnError>,
): RequestResult<GetEntitlementsResponses, GetEntitlementsErrors, ThrowOnError> =>
  (options?.client ?? client).get<GetEntitlementsResponses, GetEntitlementsErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/me/entitlements',
    ...options,
  });
