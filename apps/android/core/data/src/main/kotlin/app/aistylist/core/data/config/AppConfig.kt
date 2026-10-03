package app.aistylist.core.data.config

import java.net.URI
import java.net.URISyntaxException

/**
 * Validated runtime configuration. Built once by the composition root from BuildConfig
 * (`API_BASE_URL` per build type, `POSTHOG_API_KEY` / `POSTHOG_HOST` from the build environment,
 * see app/build.gradle.kts). No credential: the PostHog project key is a write-only client key that
 * ships inside the app by design, but it is injected at build time and never committed.
 */
data class AppConfig(
    /** Host-only API base URL: `scheme://host[:port]`, no path, no trailing slash. */
    val apiBaseUrl: String,
    /** App version (`versionName`), for analytics properties. */
    val appVersion: String,
    /** PostHog analytics + error tracking; `null` when no key is configured (no PostHog code runs). */
    val postHog: PostHogSettings? = null,
)

/** The PostHog project this build reports to (`POSTHOG_API_KEY`, `POSTHOG_HOST`). */
data class PostHogSettings(
    /** Project key (`phc_…`); never a personal API key (`phx_…`). */
    val apiKey: String,
    /** Absolute https URL of the PostHog ingestion host (a reverse-proxy path is allowed). */
    val host: String,
) {
    /** Keeps the project key out of logs and exception messages. */
    override fun toString(): String = "PostHogSettings(host=$host, apiKey=<redacted>)"
}

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
 *
 * PostHog is optional: a blank `POSTHOG_API_KEY` leaves it off whatever `POSTHOG_HOST` says. A key
 * must be a project key (`phc_…`): a personal API key (`phx_…`) can read and change the whole
 * project and must never ship in an app. With a key, `POSTHOG_HOST` is required, must be https and
 * has no default, because the ingestion region is a project decision (OQ-07), not a guess.
 */
fun parseAppConfig(
    rawApiBaseUrl: String?,
    rawAppVersion: String?,
    rawPostHogApiKey: String? = null,
    rawPostHogHost: String? = null,
): AppConfig {
    val apiBaseUrl = parseHttpUrl(API_BASE_URL, rawApiBaseUrl, schemes = setOf("http", "https"))
    if (!apiBaseUrl.rawPath.isNullOrEmpty()) {
        throw ConfigError("$API_BASE_URL must be host-only (scheme://host[:port]); the client adds /v1 itself")
    }
    return AppConfig(
        apiBaseUrl = apiBaseUrl.toString(),
        appVersion = rawAppVersion?.trim()?.takeIf { it.isNotEmpty() } ?: FALLBACK_APP_VERSION,
        postHog = parsePostHogSettings(rawPostHogApiKey, rawPostHogHost),
    )
}

private const val API_BASE_URL = "API_BASE_URL"
private const val POSTHOG_API_KEY = "POSTHOG_API_KEY"
private const val POSTHOG_HOST = "POSTHOG_HOST"
private const val POSTHOG_PROJECT_KEY_PREFIX = "phc_"
private const val POSTHOG_PERSONAL_KEY_PREFIX = "phx_"

private fun parsePostHogSettings(
    rawApiKey: String?,
    rawHost: String?,
): PostHogSettings? {
    val apiKey = rawApiKey?.trim().orEmpty()
    if (apiKey.isEmpty()) return null
    if (apiKey.startsWith(POSTHOG_PERSONAL_KEY_PREFIX)) {
        throw ConfigError("$POSTHOG_API_KEY is a personal API key ($POSTHOG_PERSONAL_KEY_PREFIX…); use the project key")
    }
    if (!apiKey.startsWith(POSTHOG_PROJECT_KEY_PREFIX)) {
        throw ConfigError("$POSTHOG_API_KEY must be a PostHog project key ($POSTHOG_PROJECT_KEY_PREFIX…)")
    }
    val host = parseHttpUrl(POSTHOG_HOST, rawHost, schemes = setOf("https"))
    return PostHogSettings(apiKey = apiKey, host = host.toString())
}

/**
 * An absolute URL in one of [schemes], with a host and no credentials, query or fragment; one
 * trailing slash dropped.
 */
private fun parseHttpUrl(
    key: String,
    raw: String?,
    schemes: Set<String>,
): URI {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) throw ConfigError("$key is not set")
    val uri =
        try {
            URI(trimmed.removeSuffix("/"))
        } catch (error: URISyntaxException) {
            throw ConfigError("$key is not a valid URL: ${error.reason}", error)
        }
    if (uri.scheme?.lowercase() !in schemes) {
        throw ConfigError("$key must be an absolute ${schemes.sorted().joinToString("/")} URL")
    }
    if (uri.host.isNullOrEmpty()) throw ConfigError("$key has no host")
    if (uri.rawQuery != null || uri.rawFragment != null || uri.rawUserInfo != null) {
        throw ConfigError("$key must not contain credentials, a query or a fragment")
    }
    return uri
}
