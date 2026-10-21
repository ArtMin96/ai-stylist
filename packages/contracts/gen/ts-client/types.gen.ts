// GENERATED — do not edit. Run `just generate`.
// Source: packages/contracts/openapi/**

export type ClientOptions = {
  baseUrl: 'https://api.ai-stylist.app' | 'http://localhost:3000' | (string & {});
};

/**
 * RFC 9457 problem details (planning/06 §2). `code` is stable and machine-readable.
 */
export type ProblemDetails = {
  /**
   * URI identifying the problem type
   */
  type: string;
  title: string;
  status: number;
  /**
   * Stable machine code from the shared-kernel error registry
   */
  code: string;
  detail?: string;
  instance?: string;
  /**
   * Field-level validation failures with JSON-pointer paths
   */
  errors?: Array<ProblemFieldError>;
};

export type ProblemFieldError = {
  /**
   * RFC 6901 JSON pointer into the request body
   */
  pointer: string;
  message: string;
  code?: string;
};

export type HealthCheckStatus = 'ok' | 'down';

export type HealthReport = {
  status: 'ok';
  checks: {
    db: HealthCheckStatus;
  };
};

export type VersionInfo = {
  /**
   * Semantic version of the deployed API
   */
  version: string;
  /**
   * Git commit SHA the build was produced from
   */
  commit: string;
  /**
   * RFC 3339 UTC build timestamp
   */
  builtAt: string;
};

/**
 * Identity providers that sign in with a native identity token (DEC-64).
 */
export type IdentityProvider = 'apple' | 'google';

export type IdTokenSignInRequest = {
  provider: IdentityProvider;
  idToken: {
    /**
     * The provider's identity token (a JWT), verified against the provider's keys.
     */
    token: string;
    /**
     * The unhashed nonce the app generated for the provider request. The identity
     * token's `nonce` claim must equal it or its SHA-256 digest. Sign in with Apple
     * requires it.
     *
     */
    nonce?: string;
    /**
     * Name the provider reports to the app on the first authorization only (Sign in with Apple).
     */
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
    };
  };
};

/**
 * Account id, a prefixed ULID (`usr_`, shared-kernel `ID_PREFIXES.user`).
 */
export type UserId = string;

/**
 * A session the server opened or renewed.
 */
export type SessionGrant = {
  userId: UserId;
  /**
   * The session token for `bearerAuth`. Kept in the Keychain or Keystore-backed storage only (doc 11 §4.2).
   */
  token: string;
  /**
   * When the session ends unless renewed with `refreshSession`. The server may refuse
   * the token earlier (revocation, or a shorter access window, doc 11 §4.2); the client
   * then renews once.
   *
   */
  expiresAt: string;
};

/**
 * The account is inside its 7-day deletion grace window (DEC-65): no session was opened.
 * The only thing the client can do is offer to cancel the deletion with `cancelToken`.
 *
 */
export type DeletionPending = {
  /**
   * End of the grace window; the purge starts after it.
   */
  graceEndsAt: string;
  /**
   * Value for the `Deletion-Cancel-Token` header (`deletionCancelToken`); valid only for `DELETE /v1/me/deletion`.
   */
  cancelToken: string;
  /**
   * At most 15 minutes after issue (doc 11 §4.2).
   */
  cancelTokenExpiresAt: string;
};

/**
 * The verified identity has no account. Nothing is stored. The client asks for the birth
 * year and calls `completeSignUp` with `token`.
 *
 */
export type SignUpPending = {
  /**
   * Sign-up credential for `CompleteSignUpRequest.signUpToken`. Single use, valid only
   * for `completeSignUp`; it opens no session and grants nothing else.
   *
   */
  token: string;
  /**
   * At most 15 minutes after issue.
   */
  expiresAt: string;
};

/**
 * One sign-in outcome. `outcome` names it, and exactly the object of that outcome is
 * present: `session` for `session`, `deletionPending` for `deletion_pending`, `signUp` for
 * `sign_up_required`. Only `session` opens a session.
 *
 */
export type SignInResult = {
  outcome: 'session' | 'deletion_pending' | 'sign_up_required';
  session?: SessionGrant;
  deletionPending?: DeletionPending;
  signUp?: SignUpPending;
};

export type CompleteSignUpRequest = {
  /**
   * `SignUpPending.token` of the `sign_up_required` answer.
   */
  signUpToken: string;
  /**
   * Self-declared birth year (DEC-60). Only a sanity range is enforced here; the age
   * floor is the server's rule and is never restated by a client.
   *
   */
  birthYear: number;
};

/**
 * Base64url without padding (RFC 4648 §5), as WebAuthn JSON encodes binary values.
 */
export type Base64Url = string;

/**
 * W3C WebAuthn `PublicKeyCredentialDescriptorJSON`.
 */
export type PasskeyCredentialDescriptor = {
  id: Base64Url;
  type: 'public-key';
  transports?: Array<string>;
};

/**
 * WebAuthn extension inputs (`AuthenticationExtensionsClientInputsJSON`). Only the
 * extensions this API requests are modelled.
 *
 */
export type PasskeyExtensionInputs = {
  credProps?: boolean;
};

/**
 * W3C WebAuthn `PublicKeyCredentialRequestOptionsJSON`.
 */
export type PasskeyRequestOptions = {
  challenge: Base64Url;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<PasskeyCredentialDescriptor>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  hints?: Array<string>;
  extensions?: PasskeyExtensionInputs;
};

/**
 * WebAuthn extension outputs (`AuthenticationExtensionsClientOutputsJSON`). Only the
 * extensions this API reads are modelled; send `{}` when there are none.
 *
 */
export type PasskeyExtensionOutputs = {
  credProps?: {
    rk?: boolean;
  };
};

/**
 * W3C WebAuthn `AuthenticationResponseJSON`.
 */
export type PasskeyAuthenticationResponse = {
  id: Base64Url;
  rawId: Base64Url;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: PasskeyExtensionOutputs;
  response: {
    clientDataJSON: Base64Url;
    authenticatorData: Base64Url;
    signature: Base64Url;
    userHandle?: Base64Url;
  };
};

export type PasskeySignInRequest = {
  response: PasskeyAuthenticationResponse;
};

/**
 * W3C WebAuthn `PublicKeyCredentialCreationOptionsJSON`.
 */
export type PasskeyCreationOptions = {
  rp: {
    id?: string;
    name: string;
  };
  user: {
    id: Base64Url;
    name: string;
    displayName: string;
  };
  challenge: Base64Url;
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  timeout?: number;
  excludeCredentials?: Array<PasskeyCredentialDescriptor>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'discouraged' | 'preferred' | 'required';
    requireResidentKey?: boolean;
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
  hints?: Array<string>;
  extensions?: PasskeyExtensionInputs;
};

/**
 * W3C WebAuthn `RegistrationResponseJSON`.
 */
export type PasskeyRegistrationResponse = {
  id: Base64Url;
  rawId: Base64Url;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: PasskeyExtensionOutputs;
  response: {
    clientDataJSON: Base64Url;
    attestationObject: Base64Url;
    authenticatorData?: Base64Url;
    transports?: Array<string>;
    publicKeyAlgorithm?: number;
    publicKey?: Base64Url;
  };
};

export type PasskeyRegistrationRequest = {
  response: PasskeyRegistrationResponse;
  /**
   * Label the person gives the passkey.
   */
  name?: string;
};

/**
 * A passkey stored on the account. Carries no key material.
 */
export type PasskeySummary = {
  name?: string;
  createdAt: string;
};

/**
 * The current session, without its token.
 */
export type SessionInfo = {
  userId: UserId;
  expiresAt: string;
  /**
   * True when the server asks the client to renew now with `refreshSession`.
   */
  needsRefresh?: boolean;
};

export type SignOutResult = {
  success: boolean;
};

/**
 * One signed-in device of the caller. Carries no token and no IP address.
 */
export type DeviceSession = {
  /**
   * True for the session that made this request.
   */
  current: boolean;
  /**
   * When the device signed in.
   */
  createdAt: string;
  /**
   * Last renewal of the session.
   */
  lastActiveAt: string;
  expiresAt: string;
  /**
   * The `User-Agent` the device sent at sign-in, to tell devices apart.
   */
  userAgent?: string;
};

export type DeviceSessionPage = {
  items: Array<DeviceSession>;
  /**
   * Cursor of the next page; null on the last page.
   */
  nextCursor: string | null;
};

export type RevokeSessionsResult = {
  status: boolean;
};

export type RecoveryRequest = {
  email: string;
};

export type RecoveryRequestAccepted = {
  /**
   * Always true, whether or not an account exists for the address.
   */
  status: boolean;
};

/**
 * Consent record id, a prefixed ULID (`cns_`, shared-kernel `ID_PREFIXES.consentRecord`).
 */
export type ConsentRecordId = string;

/**
 * Consent purpose keys of doc 11 §7.2, in that order. Mirrors shared-kernel
 * `CONSENT_PURPOSES` value for value (pinned by packages/contracts/tests/kernel-enums.test.ts).
 *
 */
export type ConsentPurpose =
  | 'core_service'
  | 'face_processing'
  | 'location_precise'
  | 'analytics'
  | 'ai_generative'
  | 'notifications'
  | 'training_data';

export type ConsentStatus = 'granted' | 'withdrawn';

/**
 * Version of the policy text the person saw, e.g. `0.1.0-draft`.
 */
export type PolicyVersion = string;

/**
 * Identifier of the app screen where the decision was made, e.g. `onboarding_consent`.
 */
export type ConsentSurface = string;

/**
 * BCP 47 language tag of the text the person saw, e.g. `en-GB`.
 */
export type Locale = string;

/**
 * One append-only consent record (doc 11 §7.1).
 */
export type ConsentRecord = {
  id: ConsentRecordId;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  policyVersion: PolicyVersion;
  /**
   * When the consent was granted; present when `status` is `granted`.
   */
  grantedAt?: string;
  /**
   * When the consent was withdrawn; present when `status` is `withdrawn`.
   */
  withdrawnAt?: string;
  surface: ConsentSurface;
  locale: Locale;
};

export type ConsentPage = {
  items: Array<ConsentRecord>;
  /**
   * Cursor of the next page; null on the last page.
   */
  nextCursor: string | null;
};

export type ConsentChange = {
  purpose: ConsentPurpose;
  status: ConsentStatus;
  policyVersion: PolicyVersion;
  surface: ConsentSurface;
  locale: Locale;
};

/**
 * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
 * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
 * a replay with the same body returns the stored response, the same key with a different
 * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
 *
 */
export type IdempotencyKey = string;

/**
 * Opaque cursor from the `nextCursor` of the previous page; omit for the first page.
 */
export type Cursor = string;

/**
 * Page size (doc 06 §2 cursor pagination).
 */
export type Limit = number;

export type GetHealthData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/health';
};

export type GetHealthErrors = {
  /**
   * One or more dependencies are down
   */
  503: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetHealthError = GetHealthErrors[keyof GetHealthErrors];

export type GetHealthResponses = {
  /**
   * Health report
   */
  200: HealthReport;
};

export type GetHealthResponse = GetHealthResponses[keyof GetHealthResponses];

export type GetVersionData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/version';
};

export type GetVersionErrors = {
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetVersionError = GetVersionErrors[keyof GetVersionErrors];

export type GetVersionResponses = {
  /**
   * Version information
   */
  200: VersionInfo;
};

export type GetVersionResponse = GetVersionResponses[keyof GetVersionResponses];

export type SignInWithIdTokenData = {
  body: IdTokenSignInRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-in/social';
};

export type SignInWithIdTokenErrors = {
  /**
   * `UNAUTHENTICATED`: the identity token or passkey assertion was not accepted.
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignInWithIdTokenError = SignInWithIdTokenErrors[keyof SignInWithIdTokenErrors];

export type SignInWithIdTokenResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type SignInWithIdTokenResponse =
  SignInWithIdTokenResponses[keyof SignInWithIdTokenResponses];

export type CompleteSignUpData = {
  body: CompleteSignUpRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-up/complete';
};

export type CompleteSignUpErrors = {
  /**
   * `UNAUTHENTICATED`: the sign-up token is missing, expired, already spent or unknown. Start again with a sign-in.
   */
  401: ProblemDetails;
  /**
   * `AGE_GATE_FAILED`: the birth year lies fewer than 16 years back (DEC-60). Terminal
   * for this attempt: nothing is stored and the sign-up token is spent. The client shows
   * its refusal screen and offers no way to change the year.
   *
   */
  403: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type CompleteSignUpError = CompleteSignUpErrors[keyof CompleteSignUpErrors];

export type CompleteSignUpResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type CompleteSignUpResponse = CompleteSignUpResponses[keyof CompleteSignUpResponses];

export type GetPasskeySignInOptionsData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/generate-authenticate-options';
};

export type GetPasskeySignInOptionsErrors = {
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetPasskeySignInOptionsError =
  GetPasskeySignInOptionsErrors[keyof GetPasskeySignInOptionsErrors];

export type GetPasskeySignInOptionsResponses = {
  /**
   * WebAuthn request options
   */
  200: PasskeyRequestOptions;
};

export type GetPasskeySignInOptionsResponse =
  GetPasskeySignInOptionsResponses[keyof GetPasskeySignInOptionsResponses];

export type SignInWithPasskeyData = {
  body: PasskeySignInRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/verify-authentication';
};

export type SignInWithPasskeyErrors = {
  /**
   * `UNAUTHENTICATED`: the identity token or passkey assertion was not accepted.
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignInWithPasskeyError = SignInWithPasskeyErrors[keyof SignInWithPasskeyErrors];

export type SignInWithPasskeyResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type SignInWithPasskeyResponse =
  SignInWithPasskeyResponses[keyof SignInWithPasskeyResponses];

export type GetPasskeyRegistrationOptionsData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/generate-register-options';
};

export type GetPasskeyRegistrationOptionsErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * The caller is authenticated but may not perform this operation. `code` is `FORBIDDEN`
   * unless the operation names a more specific code for this status.
   *
   */
  403: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetPasskeyRegistrationOptionsError =
  GetPasskeyRegistrationOptionsErrors[keyof GetPasskeyRegistrationOptionsErrors];

export type GetPasskeyRegistrationOptionsResponses = {
  /**
   * WebAuthn creation options
   */
  200: PasskeyCreationOptions;
};

export type GetPasskeyRegistrationOptionsResponse =
  GetPasskeyRegistrationOptionsResponses[keyof GetPasskeyRegistrationOptionsResponses];

export type RegisterPasskeyData = {
  body: PasskeyRegistrationRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/passkey/verify-registration';
};

export type RegisterPasskeyErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * The caller is authenticated but may not perform this operation. `code` is `FORBIDDEN`
   * unless the operation names a more specific code for this status.
   *
   */
  403: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RegisterPasskeyError = RegisterPasskeyErrors[keyof RegisterPasskeyErrors];

export type RegisterPasskeyResponses = {
  /**
   * The stored passkey
   */
  200: PasskeySummary;
};

export type RegisterPasskeyResponse = RegisterPasskeyResponses[keyof RegisterPasskeyResponses];

export type GetSessionData = {
  body?: never;
  path?: never;
  query?: never;
  url: '/v1/auth/get-session';
};

export type GetSessionErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type GetSessionError = GetSessionErrors[keyof GetSessionErrors];

export type GetSessionResponses = {
  /**
   * The current session
   */
  200: SessionInfo;
};

export type GetSessionResponse = GetSessionResponses[keyof GetSessionResponses];

export type RefreshSessionData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/get-session';
};

export type RefreshSessionErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RefreshSessionError = RefreshSessionErrors[keyof RefreshSessionErrors];

export type RefreshSessionResponses = {
  /**
   * The renewed session
   */
  200: SessionGrant;
};

export type RefreshSessionResponse = RefreshSessionResponses[keyof RefreshSessionResponses];

export type SignOutData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-out';
};

export type SignOutErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignOutError = SignOutErrors[keyof SignOutErrors];

export type SignOutResponses = {
  /**
   * The session is revoked
   */
  200: SignOutResult;
};

export type SignOutResponse = SignOutResponses[keyof SignOutResponses];

export type ListDeviceSessionsData = {
  body?: never;
  path?: never;
  query?: {
    /**
     * Opaque cursor from the `nextCursor` of the previous page; omit for the first page.
     */
    cursor?: string;
    /**
     * Page size (doc 06 §2 cursor pagination).
     */
    limit?: number;
  };
  url: '/v1/auth/list-sessions';
};

export type ListDeviceSessionsErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type ListDeviceSessionsError = ListDeviceSessionsErrors[keyof ListDeviceSessionsErrors];

export type ListDeviceSessionsResponses = {
  /**
   * One page of the caller's sessions
   */
  200: DeviceSessionPage;
};

export type ListDeviceSessionsResponse =
  ListDeviceSessionsResponses[keyof ListDeviceSessionsResponses];

export type SignOutAllDevicesData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/revoke-sessions';
};

export type SignOutAllDevicesErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type SignOutAllDevicesError = SignOutAllDevicesErrors[keyof SignOutAllDevicesErrors];

export type SignOutAllDevicesResponses = {
  /**
   * Every session of the account is revoked
   */
  200: RevokeSessionsResult;
};

export type SignOutAllDevicesResponse =
  SignOutAllDevicesResponses[keyof SignOutAllDevicesResponses];

export type RequestAccountRecoveryData = {
  body: RecoveryRequest;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/auth/sign-in/magic-link';
};

export type RequestAccountRecoveryErrors = {
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RequestAccountRecoveryError =
  RequestAccountRecoveryErrors[keyof RequestAccountRecoveryErrors];

export type RequestAccountRecoveryResponses = {
  /**
   * Accepted (uniform for every address)
   */
  200: RecoveryRequestAccepted;
};

export type RequestAccountRecoveryResponse =
  RequestAccountRecoveryResponses[keyof RequestAccountRecoveryResponses];

export type CompleteAccountRecoveryData = {
  body?: never;
  path?: never;
  query: {
    /**
     * Single-use token from the emailed link.
     */
    token: string;
  };
  url: '/v1/auth/magic-link/verify';
};

export type CompleteAccountRecoveryErrors = {
  /**
   * `UNAUTHENTICATED`: the link is unknown, used, cancelled, not yet valid or expired.
   */
  401: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type CompleteAccountRecoveryError =
  CompleteAccountRecoveryErrors[keyof CompleteAccountRecoveryErrors];

export type CompleteAccountRecoveryResponses = {
  /**
   * The outcome of a sign-in (see `SignInResult`)
   */
  200: SignInResult;
};

export type CompleteAccountRecoveryResponse =
  CompleteAccountRecoveryResponses[keyof CompleteAccountRecoveryResponses];

export type CancelAccountRecoveryData = {
  body?: never;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/recovery';
};

export type CancelAccountRecoveryErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `NOT_FOUND`: the account has no pending recovery.
   */
  404: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type CancelAccountRecoveryError =
  CancelAccountRecoveryErrors[keyof CancelAccountRecoveryErrors];

export type CancelAccountRecoveryResponses = {
  /**
   * The pending recovery is cancelled; its link no longer works.
   */
  204: void;
};

export type CancelAccountRecoveryResponse =
  CancelAccountRecoveryResponses[keyof CancelAccountRecoveryResponses];

export type ListConsentsData = {
  body?: never;
  path?: never;
  query?: {
    /**
     * Opaque cursor from the `nextCursor` of the previous page; omit for the first page.
     */
    cursor?: string;
    /**
     * Page size (doc 06 §2 cursor pagination).
     */
    limit?: number;
  };
  url: '/v1/me/consents';
};

export type ListConsentsErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type ListConsentsError = ListConsentsErrors[keyof ListConsentsErrors];

export type ListConsentsResponses = {
  /**
   * One page of current consent records
   */
  200: ConsentPage;
};

export type ListConsentsResponse = ListConsentsResponses[keyof ListConsentsResponses];

export type RecordConsentData = {
  body: ConsentChange;
  headers?: {
    /**
     * Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the
     * mobile mutation-log `opId`). The server keeps key, request hash and response for 48 h:
     * a replay with the same body returns the stored response, the same key with a different
     * body is refused with 409 `IDEMPOTENCY_KEY_REUSED`. Optional for the caller.
     *
     */
    'Idempotency-Key'?: string;
  };
  path?: never;
  query?: never;
  url: '/v1/me/consents';
};

export type RecordConsentErrors = {
  /**
   * `UNAUTHENTICATED`: the credential is missing, malformed, expired or revoked. The client
   * renews the session once (`refreshSession`); if the renewal is refused too, it signs in
   * again.
   *
   */
  401: ProblemDetails;
  /**
   * `CONSENT_REQUIRED`: a withdrawal of `core_service` is refused. This consent is
   * required to use the app (doc 11 §7.2). Deleting the account is what ends this
   * processing (`POST /v1/me/deletion`).
   *
   */
  403: ProblemDetails;
  /**
   * `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different
   * request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version;
   * `CONFLICT` otherwise.
   *
   */
  409: ProblemDetails;
  /**
   * `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client
   * erases everything it stores for the account and returns to its signed-out start; it
   * tells this reply from 401 by the status alone. A 410 is cacheable by default
   * (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be
   * cached.
   *
   */
  410: ProblemDetails;
  /**
   * `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
   */
  429: ProblemDetails;
  /**
   * Error (RFC 9457)
   */
  default: ProblemDetails;
};

export type RecordConsentError = RecordConsentErrors[keyof RecordConsentErrors];

export type RecordConsentResponses = {
  /**
   * Unchanged; the current record
   */
  200: ConsentRecord;
  /**
   * The appended record
   */
  201: ConsentRecord;
};

export type RecordConsentResponse = RecordConsentResponses[keyof RecordConsentResponses];
