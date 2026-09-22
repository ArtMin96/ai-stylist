package app.aistylist.core.data.config

import java.net.URI
import java.net.URISyntaxException

/**
 * Validated runtime configuration. Built once by the composition root from BuildConfig
 * (`API_BASE_URL` per build type, see app/build.gradle.kts). Contains no secrets.
 */
data class AppConfig(
    /** Host-only API base URL: `scheme://host[:port]`, no path, no trailing slash. */
    val apiBaseUrl: String,
    /** App version (`versionName`), for analytics properties. */
    val appVersion: String,
)

/** Thrown at startup when the build-time configuration is invalid; names the offending key. */
class ConfigError(
    message: String,
    cause: Throwable? = null,
) : IllegalArgumentException(message, cause)

/** Fallback when no version is configured (mirrors the previous app's `'0.0.0'`). */
const val FALLBACK_APP_VERSION: String = "0.0.0"

/**
 * Validate raw build config into an [AppConfig]; throws [ConfigError] naming the key.
 *
 * `API_BASE_URL` must be HOST-ONLY. The OpenAPI paths already start with `/v1`, so a base URL
 * with a path (for example `https://api.example.test/v1`) would request `/v1/v1/...`; it is
 * rejected here instead of silently producing wrong URLs. One trailing slash is tolerated.
 */
fun parseAppConfig(
    rawApiBaseUrl: String?,
    rawAppVersion: String?,
): AppConfig {
    val trimmed = rawApiBaseUrl?.trim().orEmpty()
    if (trimmed.isEmpty()) throw ConfigError("API_BASE_URL is not set")
    val uri =
        try {
            URI(trimmed.removeSuffix("/"))
        } catch (error: URISyntaxException) {
            throw ConfigError("API_BASE_URL is not a valid URL: ${error.reason}", error)
        }
    val scheme = uri.scheme?.lowercase()
    if (scheme != "http" && scheme != "https") {
        throw ConfigError("API_BASE_URL must be an absolute http(s) URL")
    }
    if (uri.host.isNullOrEmpty()) throw ConfigError("API_BASE_URL has no host")
    val hasExtraParts = !uri.rawPath.isNullOrEmpty() || uri.rawQuery != null || uri.rawFragment != null
    if (hasExtraParts || uri.rawUserInfo != null) {
        throw ConfigError("API_BASE_URL must be host-only (scheme://host[:port]); the client adds /v1 itself")
    }
    return AppConfig(
        apiBaseUrl = uri.toString(),
        appVersion = rawAppVersion?.trim()?.takeIf { it.isNotEmpty() } ?: FALLBACK_APP_VERSION,
    )
}
