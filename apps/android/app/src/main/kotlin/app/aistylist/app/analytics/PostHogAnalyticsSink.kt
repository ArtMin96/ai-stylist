package app.aistylist.app.analytics

import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsSink
import app.aistylist.core.data.config.PostHogSettings
import com.posthog.android.PostHogAndroidConfig
import com.posthog.internal.PostHogNetworkStatus

/**
 * PostHog behind the analytics port. The consent decision stays in
 * [app.aistylist.core.analytics.ConsentGatedAnalytics], which calls this sink only after opt-in:
 *
 * - [activate] sets the SDK up (config from [postHogConfig]), opts in and flushes. Before the first
 *   grant there is no SDK setup, no network and no crash handler. The SDK remembers an earlier
 *   opt-out, so the explicit opt-in is needed on every grant. The flush sends what an earlier
 *   consented run left in the SDK's disk queue right away, such as the crash that ended it (the
 *   SDK writes a fatal `$exception` to disk before the process dies).
 * - [deactivate] withdraws without sending: it switches the queue to "offline", opts out
 *   (persisted), closes the SDK (the crash handler is uninstalled, the queue stopped, and the flush
 *   inside `close()` sends nothing) and deletes the unsent queue. posthog-android 3.71.1 has no
 *   public call that drops its queue: `PostHogQueue.clear()` sits behind the SDK's `protected`
 *   queue, and `close()` always flushes.
 * - [send] captures the event with its scalar properties; nothing else is attached.
 */
internal class PostHogAnalyticsSink(
    private val settings: PostHogSettings,
    private val sdk: PostHogSdk,
) : AnalyticsSink {
    /** The config of the current grant; null while consent is withdrawn. */
    private var granted: PostHogAndroidConfig? = null

    /** Consent was withdrawn earlier in this process: empty the queue again before the next setup. */
    private var discardBeforeSetup = false

    override fun activate() {
        // A write the SDK's queue thread still had pending at withdrawal lands after that purge;
        // this one runs before the new queue loads the directory, so a re-grant sends only new data.
        if (discardBeforeSetup) {
            discardQueue()
            discardBeforeSetup = false
        }
        val config = postHogConfig(settings, sdk.queueDirectory)
        sdk.setup(config)
        sdk.optIn()
        sdk.flush()
        granted = config
    }

    override fun deactivate() {
        val config = granted ?: return
        granted = null
        config.networkStatus = WithdrawnNetworkStatus(sdkStatus = config.networkStatus)
        sdk.optOut()
        sdk.close()
        discardQueue()
        discardBeforeSetup = true
    }

    override fun send(event: AnalyticsEvent) {
        sdk.capture(event.name, event.postHogProperties())
    }

    /** Deletes every queued record file; the directories stay for the SDK. */
    private fun discardQueue() {
        sdk.queueDirectory
            .walkBottomUp()
            .filter { it.isFile }
            .forEach { it.delete() }
    }
}

/**
 * The queue's network status once consent is withdrawn. posthog-android 3.71.1 asks
 * `config.networkStatus.isConnected()` before every send (`PostHogQueue.flush` and `executeBatch`),
 * so "not connected" stops the flush in `close()`, the queue timer and the network callback. A send
 * already on the wire still completes. [unregister] reaches the SDK's own status (the SDK's
 * `PostHogAndroidNetworkStatus` is internal, so it is wrapped, never built here), which the queue's
 * `stop()` releases.
 */
private class WithdrawnNetworkStatus(
    private val sdkStatus: PostHogNetworkStatus?,
) : PostHogNetworkStatus {
    override fun isConnected(): Boolean = false

    override fun unregister() {
        sdkStatus?.unregister()
    }
}
