package app.aistylist.core.data.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AppConfigTest {
    @Test
    fun `accepts an https host and strips one trailing slash`() {
        val config = parseAppConfig("https://api.example.test/", "0.1.0")

        assertEquals(AppConfig(apiBaseUrl = "https://api.example.test", appVersion = "0.1.0"), config)
    }

    @Test
    fun `keeps an explicit port (Android emulator dev default)`() {
        val config = parseAppConfig("http://10.0.2.2:3000", "0.1.0")

        assertEquals("http://10.0.2.2:3000", config.apiBaseUrl)
    }

    @Test
    fun `falls back to 0_0_0 when the app version is missing or blank`() {
        for (version in listOf(null, "", "  ")) {
            assertEquals(FALLBACK_APP_VERSION, parseAppConfig("http://localhost:3000", version).appVersion)
        }
    }

    @Test
    fun `rejects a missing or blank base URL naming the key`() {
        for (value in listOf(null, "", "  ")) {
            val error = assertThrows(ConfigError::class.java) { parseAppConfig(value, "0.1.0") }
            assertTrue(error.message.orEmpty().contains("API_BASE_URL"))
        }
    }

    @Test
    fun `rejects a non-http URL naming the key`() {
        for (value in listOf("ftp://nope", "api.example.test", "not a url")) {
            val error = assertThrows(ConfigError::class.java) { parseAppConfig(value, "0.1.0") }
            assertTrue(error.message.orEmpty().contains("API_BASE_URL"))
        }
    }

    @Test
    fun `rejects a base URL with a path so v1 is never doubled`() {
        for (value in listOf("https://api.example.test/v1", "https://api.example.test/v1/", "http://h:3000/api")) {
            val error = assertThrows(ConfigError::class.java) { parseAppConfig(value, "0.1.0") }
            assertTrue(error.message.orEmpty().contains("host-only"))
        }
    }

    @Test
    fun `rejects query, fragment and credentials`() {
        for (value in listOf("https://h.test?x=1", "https://h.test#frag", "https://user:pw@h.test")) {
            assertThrows(ConfigError::class.java) { parseAppConfig(value, "0.1.0") }
        }
    }

    @Test
    fun `PostHog stays off without a key, whatever the host says`() {
        for (key in listOf(null, "", "  ")) {
            assertNull(parseAppConfig(API, "0.1.0", key, POSTHOG).postHog)
        }
        assertNull(parseAppConfig(API, "0.1.0").postHog)
    }

    @Test
    fun `accepts a PostHog key and host, trimmed, with one trailing slash dropped`() {
        val config = parseAppConfig(API, "0.1.0", " $KEY ", " $POSTHOG/ ")

        assertEquals(PostHogSettings(apiKey = KEY, host = POSTHOG), config.postHog)
    }

    @Test
    fun `allows a reverse-proxy path on the PostHog host`() {
        val config = parseAppConfig(API, "0.1.0", KEY, "https://example.test/ingest")

        assertEquals("https://example.test/ingest", config.postHog?.host)
    }

    @Test
    fun `a PostHog key needs an https host, and the error names POSTHOG_HOST`() {
        val badHosts =
            listOf(null, "", "  ", "p.test", "http://p.test", "ftp://p.test", "https://u:p@p.test", "$POSTHOG?q")
        for (host in badHosts) {
            val error = assertThrows(ConfigError::class.java) { parseAppConfig(API, "0.1.0", KEY, host) }
            assertTrue(error.message.orEmpty().contains("POSTHOG_HOST"))
        }
    }

    @Test
    fun `rejects a personal API key without echoing it`() {
        val error = assertThrows(ConfigError::class.java) { parseAppConfig(API, "0.1.0", PERSONAL_KEY, POSTHOG) }

        assertTrue(error.message.orEmpty().contains("POSTHOG_API_KEY"))
        assertTrue(error.message.orEmpty().contains("personal API key"))
        assertFalse(error.message.orEmpty().contains(PERSONAL_KEY))
    }

    @Test
    fun `rejects a key that is not a project key`() {
        for (key in listOf("test-key", "PHC_test", "sk_test")) {
            val error = assertThrows(ConfigError::class.java) { parseAppConfig(API, "0.1.0", key, POSTHOG) }
            assertTrue(error.message.orEmpty().contains("POSTHOG_API_KEY"))
        }
    }

    @Test
    fun `PostHog settings never print the project key`() {
        assertFalse(PostHogSettings(apiKey = KEY, host = POSTHOG).toString().contains(KEY))
        assertFalse(parseAppConfig(API, "0.1.0", KEY, POSTHOG).toString().contains(KEY))
    }

    private companion object {
        const val API = "https://api.example.test"
        const val POSTHOG = "https://posthog.example.test"

        // Synthetic keys; real ones come from the build environment only.
        const val KEY = "phc_synthetic_test"
        const val PERSONAL_KEY = "phx_synthetic_test"
    }
}
