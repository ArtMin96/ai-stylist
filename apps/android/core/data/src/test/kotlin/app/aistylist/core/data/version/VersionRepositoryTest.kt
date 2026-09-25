package app.aistylist.core.data.version

import app.aistylist.core.data.DataServices
import app.aistylist.core.data.config.parseAppConfig
import app.aistylist.core.data.model.ApiVersion
import app.aistylist.core.data.model.FailureReason
import app.aistylist.core.data.model.VersionResult
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/** Drives the real generated client (Retrofit + kotlinx.serialization) against a local server. */
class VersionRepositoryTest {
    private val server = MockWebServer()

    @Before
    fun startServer() {
        server.start()
    }

    @After
    fun stopServer() {
        server.close()
    }

    private fun repository(): VersionRepository {
        // server.url("/") is host-only plus a trailing slash, exactly like a configured API_BASE_URL.
        val config = parseAppConfig(server.url("/").toString(), "0.1.0-test")
        return DataServices(config).versionRepository
    }

    private fun json(
        code: Int,
        body: String,
        contentType: String = "application/json",
    ): MockResponse =
        MockResponse
            .Builder()
            .code(code)
            .addHeader("Content-Type", contentType)
            .body(body)
            .build()

    @Test
    fun `requests v1 version exactly once in the path and maps the body`() =
        runTest {
            server.enqueue(
                json(200, """{"version":"1.2.3","commit":"abcdef0123456789","builtAt":"2026-09-10T00:00:00Z"}"""),
            )

            val result = repository().fetchVersion()

            assertEquals(VersionResult.Success(ApiVersion("1.2.3", "abcdef0123456789")), result)
            assertEquals("/v1/version", server.takeRequest().url.encodedPath)
        }

    @Test
    fun `maps an RFC 9457 problem to its title`() =
        runTest {
            server.enqueue(
                json(
                    503,
                    """{"type":"about:blank","title":"Service unavailable","status":503,"code":"SERVICE_UNAVAILABLE"}""",
                    contentType = "application/problem+json",
                ),
            )

            val result = repository().fetchVersion()

            assertEquals(VersionResult.Failure(FailureReason.Problem(503, "Service unavailable")), result)
        }

    @Test
    fun `maps a non-problem error body to the HTTP status`() =
        runTest {
            server.enqueue(json(500, "<html>oops</html>", contentType = "text/html"))

            val result = repository().fetchVersion()

            assertEquals(VersionResult.Failure(FailureReason.HttpStatus(500)), result)
        }

    @Test
    fun `maps a 200 body that breaks the contract to InvalidResponse`() =
        runTest {
            server.enqueue(json(200, """{"unexpected":true}"""))

            val result = repository().fetchVersion()

            assertEquals(VersionResult.Failure(FailureReason.InvalidResponse), result)
        }

    @Test
    fun `maps a refused connection to Unreachable`() =
        runTest {
            val repository = repository()
            server.close()

            val result = repository.fetchVersion()

            assertEquals(VersionResult.Failure(FailureReason.Unreachable), result)
        }
}
