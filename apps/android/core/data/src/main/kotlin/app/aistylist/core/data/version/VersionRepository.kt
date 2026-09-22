package app.aistylist.core.data.version

import app.aistylist.contracts.client.apis.PlatformApi
import app.aistylist.contracts.client.infrastructure.Serializer
import app.aistylist.contracts.client.models.ProblemDetails
import app.aistylist.core.data.model.ApiVersion
import app.aistylist.core.data.model.FailureReason
import app.aistylist.core.data.model.VersionResult
import kotlinx.serialization.SerializationException
import okhttp3.ResponseBody
import java.io.IOException

/** Reads the running API's build identity. */
interface VersionRepository {
    /** `GET /v1/version` through the generated client; never throws (except cancellation). */
    suspend fun fetchVersion(): VersionResult
}

internal class NetworkVersionRepository(
    private val api: PlatformApi,
) : VersionRepository {
    override suspend fun fetchVersion(): VersionResult {
        // Only I/O and body-decoding failures are mapped; CancellationException and programming
        // errors propagate, so coroutine cancellation keeps working.
        val response =
            try {
                api.getVersion()
            } catch (_: IOException) {
                return VersionResult.Failure(FailureReason.Unreachable)
            } catch (_: SerializationException) {
                return VersionResult.Failure(FailureReason.InvalidResponse)
            }
        val body = response.body()
        return when {
            response.isSuccessful && body != null -> {
                VersionResult.Success(ApiVersion(version = body.version, commit = body.commit))
            }

            response.isSuccessful -> {
                VersionResult.Failure(FailureReason.InvalidResponse)
            }

            else -> {
                VersionResult.Failure(problemOrStatus(response.code(), response.errorBody()))
            }
        }
    }

    /** Retrofit buffers error bodies in memory, so reading one here does no I/O. */
    private fun problemOrStatus(
        status: Int,
        errorBody: ResponseBody?,
    ): FailureReason {
        val text = errorBody?.use { it.string() }.orEmpty()
        val problem =
            try {
                Serializer.kotlinxSerializationJson.decodeFromString(ProblemDetails.serializer(), text)
            } catch (_: SerializationException) {
                null
            } catch (_: IllegalArgumentException) {
                null
            }
        return if (problem != null && problem.title.isNotBlank()) {
            FailureReason.Problem(status = status, title = problem.title)
        } else {
            FailureReason.HttpStatus(status)
        }
    }
}
