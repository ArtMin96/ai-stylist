package app.aistylist.app

import app.aistylist.core.analytics.Analytics
import app.aistylist.core.analytics.ConsentGatedAnalytics
import app.aistylist.core.analytics.NoopAnalyticsSink
import app.aistylist.core.data.DataServices
import app.aistylist.core.data.config.AppConfig
import app.aistylist.core.data.config.parseAppConfig
import app.aistylist.core.data.version.VersionRepository

/**
 * Composition root (planning/04 §4.3 `composition-root-only`). The ONLY place that reads build
 * configuration and constructs adapters: config, API client (via [DataServices]) and analytics.
 * Screens receive what they need through their view-model factories. No DI framework.
 */
class AppContainer(
    val config: AppConfig,
    val analytics: Analytics,
    val versionRepository: VersionRepository,
) {
    companion object {
        /** Throws [app.aistylist.core.data.config.ConfigError] when the build config is invalid. */
        fun create(
            apiBaseUrl: String,
            appVersion: String,
        ): AppContainer {
            val config = parseAppConfig(apiBaseUrl, appVersion)
            val data = DataServices(config)
            return AppContainer(
                config = config,
                // P02: consent stub over a no-op sink; zero events leave the device (P02 §11).
                analytics = ConsentGatedAnalytics(NoopAnalyticsSink),
                versionRepository = data.versionRepository,
            )
        }
    }
}
