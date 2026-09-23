package app.aistylist.core.data

import app.aistylist.contracts.client.apis.PlatformApi
import app.aistylist.contracts.client.infrastructure.ApiClient
import app.aistylist.core.data.config.AppConfig
import app.aistylist.core.data.version.NetworkVersionRepository
import app.aistylist.core.data.version.VersionRepository
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Builds the data layer over the GENERATED API client. The composition root (`:app`
 * AppContainer) creates exactly one instance; nothing else constructs HTTP clients.
 *
 * The generated [ApiClient] is always given the host-only base URL: its operations use
 * relative paths that already start with `v1/`, so the request path is `/v1/...` exactly once.
 * (Its built-in default comes from the spec's `servers[]`, which is host-only too; it is unused.)
 * No logging interceptor is installed: request/response bodies are never logged.
 */
class DataServices(
    config: AppConfig,
) {
    private val apiClient =
        ApiClient(
            baseUrl = "${config.apiBaseUrl}/",
            okHttpClientBuilder =
                OkHttpClient
                    .Builder()
                    .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    .callTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS),
        )

    val versionRepository: VersionRepository =
        NetworkVersionRepository(apiClient.createService(PlatformApi::class.java))

    private companion object {
        const val TIMEOUT_SECONDS = 10L
    }
}
