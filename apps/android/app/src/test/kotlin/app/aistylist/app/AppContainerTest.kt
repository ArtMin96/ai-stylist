package app.aistylist.app

import app.aistylist.core.data.config.ConfigError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class AppContainerTest {
    @Test
    fun `wires config, analytics and repositories without touching the network`() {
        val container = AppContainer.create(apiBaseUrl = "http://10.0.2.2:3000", appVersion = "0.1.0")

        assertEquals("http://10.0.2.2:3000", container.config.apiBaseUrl)
        assertEquals("0.1.0", container.config.appVersion)
        assertFalse(container.analytics.hasConsent())
    }

    @Test
    fun `this variant's default API_BASE_URL is valid and host-only`() {
        // BuildConfig of the variant under test (AGP 9 runs unit tests for the debug build type only).
        AppContainer.create(apiBaseUrl = BuildConfig.API_BASE_URL, appVersion = BuildConfig.VERSION_NAME)
    }

    @Test
    fun `fails fast on an API_BASE_URL with a path`() {
        assertThrows(ConfigError::class.java) {
            AppContainer.create(apiBaseUrl = "https://api.ai-stylist.app/v1", appVersion = "0.1.0")
        }
    }
}
