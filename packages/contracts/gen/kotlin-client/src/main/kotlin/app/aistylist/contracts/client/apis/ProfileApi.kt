// GENERATED — run `just generate` (tools/codegen/gen-kotlin.sh). DO NOT EDIT BY HAND.
package app.aistylist.contracts.client.apis

import app.aistylist.contracts.client.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import app.aistylist.contracts.client.models.MeasurementSet
import app.aistylist.contracts.client.models.MeasurementSetVersionConflict
import app.aistylist.contracts.client.models.MeasurementsReplacement
import app.aistylist.contracts.client.models.OnboardingProgress
import app.aistylist.contracts.client.models.OnboardingProgressUpdate
import app.aistylist.contracts.client.models.Preferences
import app.aistylist.contracts.client.models.PreferencesUpdate
import app.aistylist.contracts.client.models.PreferencesVersionConflict
import app.aistylist.contracts.client.models.ProblemDetails
import app.aistylist.contracts.client.models.Profile
import app.aistylist.contracts.client.models.ProfileUpdate
import app.aistylist.contracts.client.models.ProfileVersionConflict

interface ProfileApi {
    /**
     * GET v1/me/measurements
     * Read the caller&#39;s body measurements
     * The caller&#39;s current measurement set, in SI units. A set nothing has been written to answers with no measurement and &#x60;version&#x60; 0. Never cached. 
     * Responses:
     *  - 200: The caller's measurement set
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [MeasurementSet]
     */
    @GET("v1/me/measurements")
    suspend fun getMeasurements(): Response<MeasurementSet>

    /**
     * GET v1/me/onboarding-progress
     * Read the caller&#39;s onboarding progress
     * Per-step progress of the onboarding flow (doc 02 §3.2) and the step the app resumes at after a quit or a crash. 
     * Responses:
     *  - 200: The caller's onboarding progress
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [OnboardingProgress]
     */
    @GET("v1/me/onboarding-progress")
    suspend fun getOnboardingProgress(): Response<OnboardingProgress>

    /**
     * GET v1/me/preferences
     * Read the caller&#39;s style preferences
     * Fit and style preferences, soft dislikes and hard exclusions, climate tolerance, occasions and the typical day, and usual sizes. Preferences nothing has been written to answer with empty lists and &#x60;version&#x60; 0. 
     * Responses:
     *  - 200: The caller's preferences
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [Preferences]
     */
    @GET("v1/me/preferences")
    suspend fun getPreferences(): Response<Preferences>

    /**
     * GET v1/me/profile
     * Read the caller&#39;s profile settings
     * Presentation, starting shape and the six settings of REQ-ONB-100. A profile nothing has been written to answers with its defaults and &#x60;version&#x60; 0. 
     * Responses:
     *  - 200: The caller's profile
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [Profile]
     */
    @GET("v1/me/profile")
    suspend fun getProfile(): Response<Profile>

    /**
     * PUT v1/me/measurements
     * Replace the caller&#39;s body measurements
     * Replaces the whole set. A measurement absent from &#x60;measurements&#x60; is removed, which is how a single field is cleared; &#x60;{}&#x60; removes every measurement. Values are SI (&#x60;cm&#x60;, &#x60;kg&#x60;); the app converts for display only. Answers with the stored set at its new &#x60;version&#x60;. 
     * Responses:
     *  - 200: The stored measurement set
     *  - 400: `MEASUREMENT_IMPLAUSIBLE`: a value lies outside its hard bounds (shared-kernel `registry/measurement-definitions.json`, doc 07 §3.3). Nothing of the request is stored. `errors[]` points at each refused value (e.g. `/measurements/height/value`) and never repeats it (doc 11 §8). `VALIDATION_FAILED`: the body breaks this schema, e.g. an `estimated` or `derived` value without `confidence`. 
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 409: `VERSION_MISMATCH`: `If-Match` names an older version than the stored one. `current` is the stored measurement set, so the app can keep the losing edit and offer to re-apply it on top (doc 04 §8). `IDEMPOTENCY_KEY_REUSED` or `CONFLICT` otherwise, without `current`. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param ifMatch The &#x60;version&#x60; of the resource the client last read, as a quoted integer, e.g. &#x60;\&quot;3\&quot;&#x60; (doc 06 §2). Every write to a versioned resource sends it; a stale version is refused with 409 &#x60;VERSION_MISMATCH&#x60;. 
     * @param measurementsReplacement 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [MeasurementSet]
     */
    @PUT("v1/me/measurements")
    suspend fun replaceMeasurements(@Header("If-Match") ifMatch: kotlin.String, @Body measurementsReplacement: MeasurementsReplacement, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<MeasurementSet>

    /**
     * PATCH v1/me/onboarding-progress
     * Record the outcome of onboarding steps
     * Records &#x60;completed&#x60; or &#x60;skipped&#x60; for each step present. A status only moves forward (&#x60;pending&#x60; → &#x60;skipped&#x60; → &#x60;completed&#x60;): a write that would move a step back leaves it unchanged and is still answered with 200, so a replayed or late write from a device&#39;s local buffer is harmless. Answers with the whole progress. 
     * Responses:
     *  - 200: The updated onboarding progress
     *  - 400: `VALIDATION_FAILED`: the body breaks this schema, or it marks a required step `skipped`. `errors[]` names each step. 
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 409: `IDEMPOTENCY_KEY_REUSED` when the `Idempotency-Key` was already used with a different request; `VERSION_MISMATCH` when `If-Match` no longer matches the stored version; `CONFLICT` otherwise. Exception: on an operation whose answer carries a credential (marked `x-idempotency-replay: never`), any repeated `Idempotency-Key` is refused with `CONFLICT`, never answered from the store, and the client starts that step again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param onboardingProgressUpdate 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [OnboardingProgress]
     */
    @PATCH("v1/me/onboarding-progress")
    suspend fun updateOnboardingProgress(@Body onboardingProgressUpdate: OnboardingProgressUpdate, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<OnboardingProgress>

    /**
     * PATCH v1/me/preferences
     * Change some of the caller&#39;s style preferences
     * Partial update (see the file header): each member present replaces its stored value whole, an empty list or object empties it, and &#x60;clear&#x60; removes &#x60;climateTolerance&#x60; or &#x60;typicalDay&#x60;. Answers with all preferences at their new &#x60;version&#x60;. 
     * Responses:
     *  - 200: The updated preferences
     *  - 400: `VALIDATION_FAILED`: the body breaks this schema, a member is both set and named in `clear`, or `sizingByRegion` holds two entries for one size system and garment group. `errors[]` names each field. 
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 409: `VERSION_MISMATCH`: `If-Match` names an older version than the stored one. `current` is the stored preferences, so the app can keep the losing edit and offer to re-apply it on top (doc 04 §8). `IDEMPOTENCY_KEY_REUSED` or `CONFLICT` otherwise, without `current`. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param ifMatch The &#x60;version&#x60; of the resource the client last read, as a quoted integer, e.g. &#x60;\&quot;3\&quot;&#x60; (doc 06 §2). Every write to a versioned resource sends it; a stale version is refused with 409 &#x60;VERSION_MISMATCH&#x60;. 
     * @param preferencesUpdate 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [Preferences]
     */
    @PATCH("v1/me/preferences")
    suspend fun updatePreferences(@Header("If-Match") ifMatch: kotlin.String, @Body preferencesUpdate: PreferencesUpdate, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<Preferences>

    /**
     * PATCH v1/me/profile
     * Change some of the caller&#39;s profile settings
     * Partial update (see the file header): each member present replaces its stored value. Answers with the whole profile at its new &#x60;version&#x60;. 
     * Responses:
     *  - 200: The updated profile
     *  - 400: `VALIDATION_FAILED`: the body breaks this schema, or `startingShape` is not a shape of the shared-kernel registry. `errors[]` names each field. 
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 409: `VERSION_MISMATCH`: `If-Match` names an older version than the stored one. `current` is the stored profile, so the app can keep the losing edit and offer to re-apply it on top (doc 04 §8). `IDEMPOTENCY_KEY_REUSED` or `CONFLICT` otherwise, without `current`. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @param ifMatch The &#x60;version&#x60; of the resource the client last read, as a quoted integer, e.g. &#x60;\&quot;3\&quot;&#x60; (doc 06 §2). Every write to a versioned resource sends it; a stale version is refused with 409 &#x60;VERSION_MISMATCH&#x60;. 
     * @param profileUpdate 
     * @param idempotencyKey Client-generated ULID that makes a mutating request safe to retry (doc 06 §2; the mobile mutation-log &#x60;opId&#x60;). A key is scoped to the caller and the operation: the authenticated principal, or for an operation with &#x60;security: []&#x60; the credential in its body (for &#x60;requestAccountRecovery&#x60;, which carries none, the request hash alone). The server keeps key, request hash and response for 48 h: a replay with the same body returns the stored response; the same key with a different body is refused with 409 &#x60;IDEMPOTENCY_KEY_REUSED&#x60;. Exception: an operation whose answer carries a credential (&#x60;SessionGrant.token&#x60;, &#x60;SessionGrant.refreshToken&#x60;, &#x60;DeletionPending.cancelToken&#x60;, &#x60;SignUpPending.token&#x60;) is never answered from the store, and its credential is never stored. Such an operation is marked &#x60;x-idempotency-replay: never&#x60;. A repeated key on it is refused with 409 &#x60;CONFLICT&#x60;, and the client starts that step again. Optional for the caller.  (optional)
     * @return [Profile]
     */
    @PATCH("v1/me/profile")
    suspend fun updateProfile(@Header("If-Match") ifMatch: kotlin.String, @Body profileUpdate: ProfileUpdate, @Header("Idempotency-Key") idempotencyKey: kotlin.String? = null): Response<Profile>

}
