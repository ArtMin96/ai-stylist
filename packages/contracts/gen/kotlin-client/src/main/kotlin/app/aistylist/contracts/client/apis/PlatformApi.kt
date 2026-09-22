// GENERATED — run `just generate` (tools/codegen/gen-kotlin.sh). DO NOT EDIT BY HAND.
package app.aistylist.contracts.client.apis

import app.aistylist.contracts.client.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import app.aistylist.contracts.client.models.HealthReport
import app.aistylist.contracts.client.models.ProblemDetails
import app.aistylist.contracts.client.models.VersionInfo

interface PlatformApi {
    /**
     * GET v1/health
     * Liveness and dependency health
     * Returns &#x60;ok&#x60; when the API and every checked dependency are reachable.
     * Responses:
     *  - 200: Health report
     *  - 503: One or more dependencies are down
     *  - 0: Error (RFC 9457)
     *
     * @return [HealthReport]
     */
    @GET("v1/health")
    suspend fun getHealth(): Response<HealthReport>

    /**
     * GET v1/version
     * Build identity of the running API
     * Semantic version, commit SHA and build timestamp of the deployed API.
     * Responses:
     *  - 200: Version information
     *  - 0: Error (RFC 9457)
     *
     * @return [VersionInfo]
     */
    @GET("v1/version")
    suspend fun getVersion(): Response<VersionInfo>

}
