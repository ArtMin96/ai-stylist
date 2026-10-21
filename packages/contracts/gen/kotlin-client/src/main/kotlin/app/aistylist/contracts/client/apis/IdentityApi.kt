// GENERATED — run `just generate` (tools/codegen/gen-kotlin.sh). DO NOT EDIT BY HAND.
package app.aistylist.contracts.client.apis

import app.aistylist.contracts.client.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import app.aistylist.contracts.client.models.AccountDeletionRequest
import app.aistylist.contracts.client.models.CompleteSignUpRequest
import app.aistylist.contracts.client.models.ConsentChange
import app.aistylist.contracts.client.models.ConsentPage
import app.aistylist.contracts.client.models.ConsentRecord
import app.aistylist.contracts.client.models.DataExport
import app.aistylist.contracts.client.models.DataExportInProgress
import app.aistylist.contracts.client.models.DeviceSessionPage
import app.aistylist.contracts.client.models.IdTokenSignInRequest
import app.aistylist.contracts.client.models.PasskeyCreationOptions
import app.aistylist.contracts.client.models.PasskeyRegistrationRequest
import app.aistylist.contracts.client.models.PasskeyRequestOptions
import app.aistylist.contracts.client.models.PasskeySignInRequest
import app.aistylist.contracts.client.models.PasskeySummary
import app.aistylist.contracts.client.models.ProblemDetails
import app.aistylist.contracts.client.models.RecoveryCompletionRequest
import app.aistylist.contracts.client.models.RecoveryRequest
import app.aistylist.contracts.client.models.RecoveryRequestAccepted
import app.aistylist.contracts.client.models.RefreshSessionRequest
import app.aistylist.contracts.client.models.RevokeSessionsResult
import app.aistylist.contracts.client.models.SessionGrant
import app.aistylist.contracts.client.models.SessionInfo
import app.aistylist.contracts.client.models.SignInResult
import app.aistylist.contracts.client.models.SignOutResult

interface IdentityApi {
    /**
     * DELETE v1/me/deletion
     * Cancel the account deletion inside its grace window
     * Stops a pending account deletion during its 7-day grace window (DEC-65). The only credential accepted is the cancel credential of the &#x60;deletion_pending&#x60; sign-in outcome (&#x60;deletionCancelToken&#x60;); the caller holds no session, because the deletion revoked them all. The account is active again, but no session is opened or restored: the client signs in again. Once the window has ended the cancel is refused with 410 &#x60;ACCOUNT_DELETED&#x60;. 
     * Responses:
     *  - 204: The deletion is cancelled and the account is active; sign in to open a session.
     *  - 401: `UNAUTHENTICATED`: the cancel credential is missing, malformed or expired. The client signs in again; during the window that sign-in answers `deletion_pending` with a new credential. 
     *  - 404: `NOT_FOUND`: the account has no pending deletion, e.g. it was already cancelled.
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the grace window has ended, so the deletion can no longer be cancelled; the account is deleted or being purged. The client erases everything it stores for the account and returns to its signed-out start. Not cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [Unit]
     */
    @DELETE("v1/me/deletion")
    suspend fun cancelAccountDeletion(@Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<Unit>

    /**
     * DELETE v1/me/recovery
     * Cancel a pending account recovery
     * Cancels the pending recovery link of the caller&#39;s account during its 24-hour delay. Only a signed-in session of that account can cancel; holding the mailbox is not enough. Identity&#39;s own operation: better-auth 1.7.12 has no path for it. 
     * Responses:
     *  - 204: The pending recovery is cancelled; its link no longer works.
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 404: `NOT_FOUND`: the account has no pending recovery.
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [Unit]
     */
    @DELETE("v1/me/recovery")
    suspend fun cancelAccountRecovery(@Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<Unit>

    /**
     * POST v1/auth/recovery/complete
     * Use an account-recovery link
     * The app sends the token of the recovery link it was opened with and gets a sign-in (&#x60;SignInResult&#x60;). The token travels only in this request body: no GET spends it, and no URL carries it to the API. Before the 24-hour delay has passed the use is refused and the token is not spent, so the same link works once the delay is over. From 48 hours after the request, after a cancel, and on a second use it is refused. The person then adds a new passkey with &#x60;registerPasskey&#x60;. Identity&#39;s own operation: the better-auth 1.7.12 magic-link plugin verifies only by a GET that spends the token, and that path is not served. 
     * Responses:
     *  - 200: The outcome of a sign-in (see `SignInResult`)
     *  - 401: `UNAUTHENTICATED`: the link is unknown, used, cancelled, expired or not yet valid. A link used before its 24-hour delay is refused without being spent. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param recoveryCompletionRequest 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [SignInResult]
     */
    @POST("v1/auth/recovery/complete")
    suspend fun completeAccountRecovery(@Body recoveryCompletionRequest: RecoveryCompletionRequest, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<SignInResult>

    /**
     * POST v1/auth/sign-up/complete
     * Complete a pending sign-up with the self-declared birth year (age gate)
     * Second part of a sign-up. The first part is a sign-in whose answer was &#x60;sign_up_required&#x60;; the &#x60;signUpToken&#x60; of that answer authorizes this call. The server applies the age gate (16+, DEC-60) to the birth year. Accepted: the account is created and the answer is the &#x60;session&#x60; outcome. Refused: &#x60;AGE_GATE_FAILED&#x60;, nothing about the attempt is stored, and the sign-up token is spent; a new attempt starts again with a sign-in. Identity&#39;s own operation: better-auth 1.7.12 has no path for it. 
     * Responses:
     *  - 200: The outcome of a sign-in (see `SignInResult`)
     *  - 401: `UNAUTHENTICATED`: the sign-up token is missing, expired, already spent or unknown. Start again with a sign-in.
     *  - 403: `AGE_GATE_FAILED`: the birth year lies fewer than 16 years back (DEC-60). Terminal for this attempt: nothing is stored and the sign-up token is spent. The client shows its refusal screen and offers no way to change the year. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param completeSignUpRequest 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [SignInResult]
     */
    @POST("v1/auth/sign-up/complete")
    suspend fun completeSignUp(@Body completeSignUpRequest: CompleteSignUpRequest, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<SignInResult>

    /**
     * GET v1/me/exports/{id}
     * Read one of the caller&#39;s data exports
     * The state of an export. While it is &#x60;ready&#x60;, every read mints a new download link after the same authorization check; the link lives at most 10 minutes (DEC-44, doc 11 §5.4). The archive itself is kept until &#x60;availableUntil&#x60;. Never cached. 
     * Responses:
     *  - 200: The export
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 404: `NOT_FOUND`: the caller has no export with this id.
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param id 
     * @return [DataExport]
     */
    @GET("v1/me/exports/{id}")
    suspend fun getDataExport(@Path("id") id: kotlin.String): Response<DataExport>

    /**
     * GET v1/auth/passkey/generate-register-options
     * WebAuthn options to add a passkey to the signed-in account
     * Returns a fresh challenge and the WebAuthn creation options (W3C WebAuthn &#x60;PublicKeyCredentialCreationOptionsJSON&#x60;). The account&#39;s existing passkeys are listed as excluded credentials. Needs a recent sign-in (&#x60;RecentSignInRequired&#x60;); otherwise 403 &#x60;FORBIDDEN&#x60;, and the client signs in again first. 
     * Responses:
     *  - 200: WebAuthn creation options
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 403: `FORBIDDEN`: re-authentication is needed. The operation needs a recent sign-in: the session must have been opened by a sign-in a short time ago (better-auth `freshAge`; the server sets the window). Recency counts from the sign-in that opened the session; a renewal with `refreshSession` never resets it. The client signs in again with the same account and repeats the request. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [PasskeyCreationOptions]
     */
    @GET("v1/auth/passkey/generate-register-options")
    suspend fun getPasskeyRegistrationOptions(): Response<PasskeyCreationOptions>

    /**
     * GET v1/auth/passkey/generate-authenticate-options
     * WebAuthn options for a passkey sign-in
     * Returns a fresh challenge and the WebAuthn request options (W3C WebAuthn &#x60;PublicKeyCredentialRequestOptionsJSON&#x60;) for the platform passkey API. Without a session no credentials are listed, so the device offers its discoverable passkeys. 
     * Responses:
     *  - 200: WebAuthn request options
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [PasskeyRequestOptions]
     */
    @GET("v1/auth/passkey/generate-authenticate-options")
    suspend fun getPasskeySignInOptions(): Response<PasskeyRequestOptions>

    /**
     * GET v1/auth/get-session
     * Read the current session
     * The account of the session the access token belongs to, and when that access token expires. Read-only: it extends nothing and returns no token (better-auth &#x60;deferSessionRefresh&#x60;). A token with no live session is answered with 401, never with an empty body. 
     * Responses:
     *  - 200: The current session
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [SessionInfo]
     */
    @GET("v1/auth/get-session")
    suspend fun getSession(): Response<SessionInfo>

    /**
     * GET v1/me/consents
     * The consent the server applies to the caller, per purpose
     * One &#x60;ResolvedConsent&#x60; for every purpose of &#x60;ConsentPurpose&#x60;, in that order (doc 11 §7.2), cursor-paginated; with the default &#x60;limit&#x60; one page holds every purpose. Each entry gives the state the server applies now: the caller&#39;s latest record for the purpose, or, when the caller has none, the purpose&#39;s default. The server decides each default (some depend on the jurisdiction), and &#x60;withdrawable&#x60; marks the purposes the person cannot withdraw, so the apps read both here and never hard-code them. The full append-only history is part of the data export. 
     * Responses:
     *  - 200: One page of the consent the server applies, one entry per purpose
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param cursor Opaque cursor from the &#x60;nextCursor&#x60; of the previous page; omit for the first page. (optional)
     * @param limit Page size (doc 06 §2 cursor pagination). (optional, default to 25)
     * @return [ConsentPage]
     */
    @GET("v1/me/consents")
    suspend fun listConsents(@Query("cursor") cursor: kotlin.String? = null, @Query("limit") limit: kotlin.Int? = 25): Response<ConsentPage>

    /**
     * GET v1/auth/list-sessions
     * List the signed-in devices of the caller
     * One entry per active session of the caller&#39;s account (the device list, doc 11 §4.2), newest first, cursor-paginated (doc 06 §2). Never another user&#39;s sessions and never a session token. 
     * Responses:
     *  - 200: One page of the caller's sessions
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param cursor Opaque cursor from the &#x60;nextCursor&#x60; of the previous page; omit for the first page. (optional)
     * @param limit Page size (doc 06 §2 cursor pagination). (optional, default to 25)
     * @return [DeviceSessionPage]
     */
    @GET("v1/auth/list-sessions")
    suspend fun listDeviceSessions(@Query("cursor") cursor: kotlin.String? = null, @Query("limit") limit: kotlin.Int? = 25): Response<DeviceSessionPage>

    /**
     * POST v1/me/consents
     * Grant or withdraw consent for one purpose
     * Appends a consent record for one purpose (doc 11 §7.1; append-only: a withdrawal is a new record). 201 when a record was appended. 200 when the request repeats the current state for the same policy version: nothing is stored and the current record, with its original dates, is returned. 
     * Responses:
     *  - 200: Unchanged; the current record
     *  - 201: The appended record
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 403: `CONSENT_REQUIRED`: a withdrawal of a purpose that `listConsents` marks `withdrawable: false` (`core_service` today) is refused. That consent is required to use the app (doc 11 §7.2). Deleting the account is what ends this processing (`POST /v1/me/deletion`). 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param consentChange 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [ConsentRecord]
     */
    @POST("v1/me/consents")
    suspend fun recordConsent(@Body consentChange: ConsentChange, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<ConsentRecord>

    /**
     * POST v1/auth/session/refresh
     * Renew a session with its refresh token
     * Exchanges the session&#39;s refresh token for a new pair: a new access token and a new refresh token (doc 11 §4.2). The refresh token travels in the body, never in &#x60;Authorization&#x60;, and the access token never renews a session. The refresh token rotates on every use: the presented one is spent, and the client stores the returned pair and discards the old one. Presenting a refresh token that was already rotated revokes every token of its session (the session family) and is answered 401. Every 401 here is a refused renewal: the client erases the session&#39;s tokens on the device and signs in again. If the answer is lost, the client may retry once with the same refresh token and a new &#x60;Idempotency-Key&#x60;; a refused retry ends the session the same way. Identity&#39;s own operation: better-auth 1.7.12 has no refresh token. 
     * Responses:
     *  - 200: The new access token and refresh token of the session
     *  - 401: `UNAUTHENTICATED`: the refresh token is missing, unknown, expired, revoked or already rotated. A rotated refresh token presented again also revokes its whole session family (doc 11 §4.2). The client erases the session's tokens and signs in again. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param refreshSessionRequest 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [SessionGrant]
     */
    @POST("v1/auth/session/refresh")
    suspend fun refreshSession(@Body refreshSessionRequest: RefreshSessionRequest, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<SessionGrant>

    /**
     * POST v1/auth/passkey/verify-registration
     * Add a passkey to the signed-in account
     * Verifies the attestation the platform passkey API returned for the challenge of &#x60;getPasskeyRegistrationOptions&#x60; and stores the passkey on the caller&#39;s account. An account may hold several passkeys. Opens no new session. 
     * Responses:
     *  - 200: The stored passkey
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 403: The caller is authenticated but may not perform this operation. `code` is `FORBIDDEN` unless the operation names a more specific code for this status. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param passkeyRegistrationRequest 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [PasskeySummary]
     */
    @POST("v1/auth/passkey/verify-registration")
    suspend fun registerPasskey(@Body passkeyRegistrationRequest: PasskeyRegistrationRequest, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<PasskeySummary>

    /**
     * POST v1/me/deletion
     * Request deletion of the caller&#39;s account
     * Starts the deletion of the caller&#39;s account (doc 11 §13.2). At once every session of the account is revoked, this one included, and a sign-in opens no session; the account is kept for a 7-day grace window (DEC-65). A sign-in during the window answers &#x60;deletion_pending&#x60;, whose cancel credential can stop the deletion (&#x60;cancelAccountDeletion&#x60;). After the window the purge runs and cannot be stopped. Re-authentication (doc 02 §11.3): needs a recent sign-in (&#x60;RecentSignInRequired&#x60;); otherwise 403 &#x60;FORBIDDEN&#x60;, and the client signs in again first. After the answer the tokens of this session no longer work and the client returns to its signed-out start. Deleting the account does not cancel a store subscription. 
     * Responses:
     *  - 202: The deletion is requested; its grace window has started
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 403: `FORBIDDEN`: re-authentication is needed. The operation needs a recent sign-in: the session must have been opened by a sign-in a short time ago (better-auth `freshAge`; the server sets the window). Recency counts from the sign-in that opened the session; a renewal with `refreshSession` never resets it. The client signs in again with the same account and repeats the request. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: the account requested a deletion within the last 30 days that was not cancelled (doc 11 §14); a request stopped with `cancelAccountDeletion` does not count. Or another rate limit was hit. Retry after `Retry-After` seconds. 
     *  - 0: Error (RFC 9457)
     *
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [AccountDeletionRequest]
     */
    @POST("v1/me/deletion")
    suspend fun requestAccountDeletion(@Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<AccountDeletionRequest>

    /**
     * POST v1/auth/sign-in/magic-link
     * Ask for an account-recovery link by email
     * Fallback for a person who lost their passkeys (doc 11 §15). The answer is the same status and body whether or not an account exists for the address, so it discloses nothing. When one exists, a single-use link is emailed; it works from 24 to 48 hours after the request, and any signed-in session of the account can cancel it before then (&#x60;cancelAccountRecovery&#x60;). The link opens the app (a universal link on iOS, an app link on Android), never an API URL, and carries its token in the URL fragment, which no server, proxy or link scanner receives; the app then calls &#x60;completeAccountRecovery&#x60;. Never creates an account. 
     * Responses:
     *  - 200: Accepted (uniform for every address)
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param recoveryRequest 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [RecoveryRequestAccepted]
     */
    @POST("v1/auth/sign-in/magic-link")
    suspend fun requestAccountRecovery(@Body recoveryRequest: RecoveryRequest, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<RecoveryRequestAccepted>

    /**
     * POST v1/me/exports
     * Request an export of the caller&#39;s data
     * Starts an asynchronous export of the caller&#39;s data (doc 11 §13.1), open on every plan (&#x60;data.export&#x60;). Answers at once with the new export &#x60;in_progress&#x60;; the client reads it with &#x60;getDataExport&#x60; until it is &#x60;ready&#x60; (a notification follows as well). One export runs at a time per account: while one is in progress, a new request is refused with 429 and the running export. Re-authentication, the same rule as &#x60;requestAccountDeletion&#x60;: needs a recent sign-in (&#x60;RecentSignInRequired&#x60;); otherwise 403 &#x60;FORBIDDEN&#x60;, and the client signs in again first. 
     * Responses:
     *  - 202: The export is accepted and in progress
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 403: `FORBIDDEN`: re-authentication is needed. The operation needs a recent sign-in: the session must have been opened by a sign-in a short time ago (better-auth `freshAge`; the server sets the window). Recency counts from the sign-in that opened the session; a renewal with `refreshSession` never resets it. The client signs in again with the same account and repeats the request. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: an export of this account is already in progress, and `current` is that export (read it with `getDataExport`); or another rate limit was hit, without `current`. `current` is always `in_progress`, so it never carries `download`: a link is minted only by `getDataExport`. Retry after `Retry-After` seconds (doc 11 §14). 
     *  - 0: Error (RFC 9457)
     *
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [DataExport]
     */
    @POST("v1/me/exports")
    suspend fun requestDataExport(@Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<DataExport>

    /**
     * POST v1/auth/sign-in/social
     * Sign in with an Apple or Google identity token
     * The app runs the provider&#39;s native sign-in and sends the identity token it received. The server verifies the token with the provider&#39;s keys, then answers with one &#x60;SignInResult&#x60;: a session for an existing account, &#x60;sign_up_required&#x60; for an identity with no account (nothing is stored until &#x60;completeSignUp&#x60; accepts the birth year), or &#x60;deletion_pending&#x60; for an account inside its deletion grace window (no session). No provider token is ever returned. 
     * Responses:
     *  - 200: The outcome of a sign-in (see `SignInResult`)
     *  - 401: `UNAUTHENTICATED`: the identity token or passkey assertion was not accepted.
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param idTokenSignInRequest 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [SignInResult]
     */
    @POST("v1/auth/sign-in/social")
    suspend fun signInWithIdToken(@Body idTokenSignInRequest: IdTokenSignInRequest, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<SignInResult>

    /**
     * POST v1/auth/passkey/verify-authentication
     * Sign in with a passkey assertion
     * Verifies the assertion the platform passkey API returned for the challenge of &#x60;getPasskeySignInOptions&#x60;. Answers &#x60;session&#x60;, or &#x60;deletion_pending&#x60; for an account inside its deletion grace window. A passkey always belongs to an existing account, so this operation never answers &#x60;sign_up_required&#x60;. 
     * Responses:
     *  - 200: The outcome of a sign-in (see `SignInResult`)
     *  - 401: `UNAUTHENTICATED`: the identity token or passkey assertion was not accepted.
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param passkeySignInRequest 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [SignInResult]
     */
    @POST("v1/auth/passkey/verify-authentication")
    suspend fun signInWithPasskey(@Body passkeySignInRequest: PasskeySignInRequest, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<SignInResult>

    /**
     * POST v1/auth/sign-out
     * Sign out this device
     * Revokes the session the bearer token belongs to on the server.
     * Responses:
     *  - 200: The session is revoked
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [SignOutResult]
     */
    @POST("v1/auth/sign-out")
    suspend fun signOut(@Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<SignOutResult>

    /**
     * POST v1/auth/revoke-sessions
     * Sign out every device
     * Revokes every session of the caller&#39;s account, the current one included.
     * Responses:
     *  - 200: Every session of the account is revoked
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [RevokeSessionsResult]
     */
    @POST("v1/auth/revoke-sessions")
    suspend fun signOutAllDevices(@Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<RevokeSessionsResult>

}
