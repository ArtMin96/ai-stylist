// GENERATED — run `just generate` (tools/codegen/gen-kotlin.sh). DO NOT EDIT BY HAND.
package app.aistylist.contracts.client.apis

import app.aistylist.contracts.client.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import app.aistylist.contracts.client.models.EntitlementState
import app.aistylist.contracts.client.models.ProblemDetails

interface BillingApi {
    /**
     * GET v1/me/entitlements
     * Read the caller&#39;s resolved entitlements
     * The entitlements the server resolves for the caller now (doc 12 §3.2): over the caller&#39;s active grants the most generous value wins, per entitlement; an entitlement no active grant supplies takes its Free-plan value (doc 12 §1.2). Every registered entitlement appears once. The apps may cache the answer briefly to render (doc 12 §3.3); a gated request is decided by the server alone. 
     * Responses:
     *  - 200: The caller's entitlement state
     *  - 401: `UNAUTHENTICATED`: the access token is missing, malformed, expired or revoked. The client renews the session once with its refresh token (`refreshSession`); if the renewal is refused too, it signs in again. 
     *  - 410: `ACCOUNT_DELETED`: the account is deleted or its deletion is in progress. The client erases everything it stores for the account and returns to its signed-out start; it tells this reply from 401 by the status alone. A 410 is cacheable by default (RFC 9110 §15.5.11), so the reply carries `Cache-Control: no-store` and must not be cached. 
     *  - 429: `RATE_LIMITED`: a rate limit was hit (doc 11 §14); retry after `Retry-After` seconds.
     *  - 0: Error (RFC 9457)
     *
     * @return [EntitlementState]
     */
    @GET("v1/me/entitlements")
    suspend fun getEntitlements(): Response<EntitlementState>

}
