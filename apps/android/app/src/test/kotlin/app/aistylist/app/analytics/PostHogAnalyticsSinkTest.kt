package app.aistylist.app.analytics

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsPropertyValue
import app.aistylist.core.data.config.PostHogSettings
import com.posthog.android.PostHogAndroidConfig
import com.posthog.internal.PostHogNetworkStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

private val SETTINGS = PostHogSettings(apiKey = "phc_synthetic_test", host = "https://posthog.example.test")

/**
 * The sink's consent lifecycle on the plain JVM, against a fake SDK: what reaches PostHog
 * (`transmitted`) and what stays queued on the device (`queued()`).
 */
class PostHogAnalyticsSinkTest {
    @get:Rule
    val temporaryFolder = TemporaryFolder()

    private val sdk by lazy { FakePostHogSdk(temporaryFolder.newFolder("posthog-queue")) }
    private val sink by lazy { PostHogAnalyticsSink(SETTINGS, sdk) }

    private val appOpened =
        AnalyticsEvent(
            name = AnalyticsTaxonomy.AppOpened.NAME,
            properties = mapOf(AnalyticsTaxonomy.AppOpened.PLATFORM to AnalyticsPropertyValue.Text("android")),
        )

    private val appOpenedFile = "${AnalyticsTaxonomy.AppOpened.NAME}.event"

    @Test
    fun `a grant sends what an earlier consented run left queued, such as its crash`() {
        sdk.writeQueueFile("earlier-run-crash.event")

        sink.activate()

        assertEquals(listOf("earlier-run-crash.event"), sdk.transmitted)
        assertEquals(emptyList<String>(), sdk.queued())
    }

    @Test
    fun `while consent holds, events are captured with their scalar properties`() {
        sink.activate()
        sink.send(appOpened)

        assertEquals(listOf("1-$appOpenedFile"), sdk.queued())
        assertEquals(
            listOf(AnalyticsTaxonomy.AppOpened.NAME to mapOf(AnalyticsTaxonomy.AppOpened.PLATFORM to "android")),
            sdk.captured,
        )
    }

    @Test
    fun `withdrawal discards unsent events instead of sending them`() {
        sink.activate()
        sink.send(appOpened)

        sink.deactivate()

        assertEquals(emptyList<String>(), sdk.transmitted)
        assertEquals(emptyList<String>(), sdk.queued())
    }

    @Test
    fun `withdrawal still releases the SDK's own network callback`() {
        sink.activate()

        sink.deactivate()

        assertFalse(sdk.networkStatuses.single().registered)
    }

    @Test
    fun `a re-grant after withdrawal sends only what is captured after it`() {
        sink.activate()
        sink.send(appOpened)
        sink.deactivate()
        // A write the SDK's queue thread still had pending lands after the withdrawal.
        sdk.writeQueueFile("late-write.event")

        sink.activate()
        sink.send(appOpened)

        assertEquals(emptyList<String>(), sdk.transmitted)
        assertEquals(listOf("2-$appOpenedFile"), sdk.queued())
    }
}

/**
 * posthog-android 3.71.1, reduced to the behaviour the sink relies on (from the SDK source):
 * - `PostHogAndroid.setup` installs the SDK's own network status when the config has none.
 * - `capture` queues one file per event under `File(storagePrefix, apiKey)`, unless opted out or
 *   closed. The opt-out is persisted, so it outlives `close`.
 * - Every queue send first asks `config.networkStatus.isConnected()` (`PostHogQueue.flush`), then
 *   sends every queued file and deletes it.
 * - `close` flushes, then the queue's `stop()` calls `config.networkStatus.unregister()`.
 */
private class FakePostHogSdk(
    override val queueDirectory: File,
) : PostHogSdk {
    /** What reached PostHog, in order (queue file names). */
    val transmitted = mutableListOf<String>()

    /** Every capture call that was queued: event name and properties. */
    val captured = mutableListOf<Pair<String, Map<String, Any>>>()

    /** The SDK's own network status, one per setup. */
    val networkStatuses = mutableListOf<SdkNetworkStatus>()

    private var config: PostHogAndroidConfig? = null
    private var optedOut = false

    /** Every file still queued on the device. */
    fun queued(): List<String> = queueFiles().map(File::getName)

    /** A queue file written outside a grant: by an earlier run, or late by the SDK's queue thread. */
    fun writeQueueFile(name: String) {
        File(queueDirectory, SETTINGS.apiKey).apply { mkdirs() }.resolve(name).writeText("synthetic")
    }

    override fun setup(config: PostHogAndroidConfig) {
        if (config.networkStatus == null) {
            config.networkStatus = SdkNetworkStatus().also { networkStatuses += it }
        }
        this.config = config
    }

    override fun optIn() {
        optedOut = false
    }

    override fun optOut() {
        optedOut = true
    }

    override fun flush() {
        val config = config ?: return
        if (config.networkStatus?.isConnected() == false) return
        queueFiles().forEach { file ->
            transmitted += file.name
            file.delete()
        }
    }

    override fun close() {
        val config = config ?: return
        flush()
        config.networkStatus?.unregister()
        this.config = null
    }

    override fun capture(
        event: String,
        properties: Map<String, Any>,
    ) {
        val config = config ?: return
        if (optedOut) return
        captured += event to properties
        File(checkNotNull(config.storagePrefix), config.apiKey)
            .apply { mkdirs() }
            .resolve("${captured.size}-$event.event")
            .writeText("synthetic")
    }

    private fun queueFiles(): List<File> =
        queueDirectory
            .walk()
            .filter(File::isFile)
            .sortedBy(File::getName)
            .toList()
}

/** Stands in for the SDK's own (internal) network status: online, with its callback registered. */
private class SdkNetworkStatus : PostHogNetworkStatus {
    var registered = true
        private set

    override fun isConnected(): Boolean = true

    override fun unregister() {
        registered = false
    }
}
