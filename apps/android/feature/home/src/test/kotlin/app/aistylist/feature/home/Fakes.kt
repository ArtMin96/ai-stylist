package app.aistylist.feature.home

import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.ConsentGatedAnalytics
import app.aistylist.core.data.config.AppConfig
import app.aistylist.core.data.model.ApiVersion
import app.aistylist.core.data.model.FailureReason
import app.aistylist.core.data.model.VersionResult
import app.aistylist.core.data.version.VersionRepository
import kotlinx.coroutines.channels.Channel

internal val TEST_CONFIG = AppConfig(apiBaseUrl = "http://api.test", appVersion = "0.1.0-test")

internal val VERSION_OK = VersionResult.Success(ApiVersion(version = "1.2.3", commit = "abcdef0123456789"))

internal val VERSION_DOWN = VersionResult.Failure(FailureReason.Unreachable)

/** Answers each `fetchVersion()` with the next queued result; suspends until one is queued. */
internal class QueuedVersionRepository(
    vararg initial: VersionResult,
) : VersionRepository {
    private val results = Channel<VersionResult>(Channel.UNLIMITED)

    var calls: Int = 0
        private set

    init {
        initial.forEach { results.trySend(it) }
    }

    fun enqueue(result: VersionResult) {
        results.trySend(result)
    }

    override suspend fun fetchVersion(): VersionResult {
        calls++
        return results.receive()
    }
}

/** The real consent gate over a sink that records what would have been sent. */
internal class RecordingAnalytics {
    val sent = mutableListOf<AnalyticsEvent>()
    val analytics = ConsentGatedAnalytics { sent += it }
}
