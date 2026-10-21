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
  CancelAccountRecoveryData,
  CancelAccountRecoveryErrors,
  CancelAccountRecoveryResponses,
  CompleteAccountRecoveryData,
  CompleteAccountRecoveryErrors,
  CompleteAccountRecoveryResponses,
  CompleteSignUpData,
  CompleteSignUpErrors,
  CompleteSignUpResponses,
  GetHealthData,
  GetHealthErrors,
  GetHealthResponses,
  GetPasskeyRegistrationOptionsData,
  GetPasskeyRegistrationOptionsErrors,
  GetPasskeyRegistrationOptionsResponses,
  GetPasskeySignInOptionsData,
  GetPasskeySignInOptionsErrors,
  GetPasskeySignInOptionsResponses,
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
  RequestAccountRecoveryData,
  RequestAccountRecoveryErrors,
  RequestAccountRecoveryResponses,
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
 * excluded credentials. Needs a recently created session (better-auth `freshAge`);
 * otherwise 403 `FORBIDDEN`, and the client signs in again first.
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
 * The account and expiry of the session the bearer token belongs to. Read-only: it does
 * not extend the session (better-auth `deferSessionRefresh`). A token with no live session
 * is answered with 401, never with an empty body.
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
 * Renew the current session
 *
 * Extends the session the bearer token belongs to and answers with its token and new
 * expiry. The answer may carry a different token than the one presented: the client
 * stores the returned token and discards the old one. A 401 here is a refused renewal:
 * the client ends the session on the device and sends no further call for it.
 *
 */
export const refreshSession = <ThrowOnError extends boolean = false>(
  options?: Options<RefreshSessionData, ThrowOnError>,
): RequestResult<RefreshSessionResponses, RefreshSessionErrors, ThrowOnError> =>
  (options?.client ?? client).post<RefreshSessionResponses, RefreshSessionErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/v1/auth/get-session',
    ...options,
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
 * (`cancelAccountRecovery`). Never creates an account.
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
 * Exchanges the token of a recovery link for a sign-in. Refused before 24 hours and from
 * 48 hours after the request, after a cancel, and on a second use. The person then adds
 * a new passkey with `registerPasskey`. The server never logs the query string of this
 * path.
 *
 */
export const completeAccountRecovery = <ThrowOnError extends boolean = false>(
  options: Options<CompleteAccountRecoveryData, ThrowOnError>,
): RequestResult<CompleteAccountRecoveryResponses, CompleteAccountRecoveryErrors, ThrowOnError> =>
  (options.client ?? client).get<
    CompleteAccountRecoveryResponses,
    CompleteAccountRecoveryErrors,
    ThrowOnError
  >({ url: '/v1/auth/magic-link/verify', ...options });

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
