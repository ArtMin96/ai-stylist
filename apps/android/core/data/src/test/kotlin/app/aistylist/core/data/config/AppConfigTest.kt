package app.aistylist.core.data.config

import org.junit.Assert.assertEquals
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
}
