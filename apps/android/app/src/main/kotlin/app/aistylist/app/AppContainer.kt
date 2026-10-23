package app.aistylist.app

import android.content.Context
import app.aistylist.app.analytics.AndroidPostHogSdk
import app.aistylist.app.analytics.PostHogAnalyticsSink
import app.aistylist.app.capture.CaptureServices
import app.aistylist.core.analytics.Analytics
import app.aistylist.core.analytics.AnalyticsSink
import app.aistylist.core.analytics.ConsentGatedAnalytics
import app.aistylist.core.analytics.NoopAnalyticsSink
import app.aistylist.core.data.DataServices
import app.aistylist.core.data.config.AppConfig
import app.aistylist.core.data.config.PostHogSettings
import app.aistylist.core.data.config.parseAppConfig
import app.aistylist.core.data.version.VersionRepository

/**
 * Composition root (planning/04 §4.3 `composition-root-only`). The ONLY place that reads build
 * configuration and constructs adapters: config, API client (via [DataServices]), analytics and
 * the capture camera's adapters ([CaptureServices]).
 * Screens receive what they need through their view-model factories. No DI framework.
 */
class AppContainer(
    val config: AppConfig,
    val analytics: Analytics,
    val versionRepository: VersionRepository,
    /**
     * The forced test crash that turns on Home's debug tools (consent switch, "Force test crash"):
     * `debug` and `preview` only. Null in `release`, so no code path there can reach the crash.
     */
    val forceTestCrash: (() -> Nothing)?,
    /** Built on first use: the camera adapters need the app context and cost nothing until then. */
    private val captureFactory: () -> CaptureServices = { error("no capture camera in this container") },
) {
    val captureServices: CaptureServices by lazy { captureFactory() }

    companion object {
        /** The container for this build variant. Throws [app.aistylist.core.data.config.ConfigError]. */
        fun fromBuildConfig(context: Context): AppContainer {
            val appContext = context.applicationContext
            return create(
                apiBaseUrl = BuildConfig.API_BASE_URL,
                appVersion = BuildConfig.VERSION_NAME,
                postHogApiKey = BuildConfig.POSTHOG_API_KEY,
                postHogHost = BuildConfig.POSTHOG_HOST,
                debugTools = BuildConfig.DEBUG_TOOLS,
                postHogSink = { settings -> PostHogAnalyticsSink(settings, AndroidPostHogSdk(appContext)) },
                captureFactory = { CaptureServices.create(appContext) },
            )
        }

        /**
         * Throws [app.aistylist.core.data.config.ConfigError] when the build config is invalid.
         *
         * Analytics is always the consent gate (off by default). Its sink is [postHogSink] when a
         * PostHog key is configured, else [NoopAnalyticsSink]: then [postHogSink] is never called
         * and no PostHog code runs. Either sink is untouched until the user opts in.
         *
         * [debugTools] (`BuildConfig.DEBUG_TOOLS`) decides whether Home gets the forced test crash.
         */
        internal fun create(
            apiBaseUrl: String,
            appVersion: String,
            postHogApiKey: String = "",
            postHogHost: String = "",
            debugTools: Boolean = false,
            postHogSink: (PostHogSettings) -> AnalyticsSink,
            captureFactory: () -> CaptureServices = { error("no capture camera in this container") },
        ): AppContainer {
            val config = parseAppConfig(apiBaseUrl, appVersion, postHogApiKey, postHogHost)
            val data = DataServices(config)
            val sink = config.postHog?.let(postHogSink) ?: NoopAnalyticsSink
            return AppContainer(
                config = config,
                analytics = ConsentGatedAnalytics(sink),
                versionRepository = data.versionRepository,
                forceTestCrash = if (debugTools) ::throwForcedTestCrash else null,
                captureFactory = captureFactory,
            )
        }
    }
}
