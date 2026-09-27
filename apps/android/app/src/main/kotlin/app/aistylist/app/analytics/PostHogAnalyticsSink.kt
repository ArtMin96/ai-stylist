package app.aistylist.app.analytics

import android.content.Context
import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsSink
import app.aistylist.core.data.config.PostHogSettings
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid

/**
 * PostHog behind the analytics port. The consent decision stays in
 * [app.aistylist.core.analytics.ConsentGatedAnalytics], which calls this sink only after opt-in:
 *
 * - [activate] sets the SDK up (config from [postHogConfig]), opts in and flushes. Before the first
 *   grant there is no SDK setup, no network and no crash handler. The SDK remembers an earlier
 *   opt-out, so the explicit opt-in is needed on every grant. The flush sends what an earlier
 *   consented run left in the SDK's disk queue right away, such as the crash that ended it (the
 *   SDK writes a fatal `$exception` to disk before the process dies).
 * - [deactivate] opts out (persisted) and closes the SDK, which flushes what was captured under
 *   consent, uninstalls the crash handler and stops the queue. The next grant sets it up again.
 * - [send] captures the event with its scalar properties; nothing else is attached.
 */
internal class PostHogAnalyticsSink(
    private val context: Context,
    private val settings: PostHogSettings,
) : AnalyticsSink {
    override fun activate() {
        PostHogAndroid.setup(context, postHogConfig(settings))
        PostHog.optIn()
        PostHog.flush()
    }

    override fun deactivate() {
        PostHog.optOut()
        PostHog.close()
    }

    override fun send(event: AnalyticsEvent) {
        PostHog.capture(event = event.name, properties = event.postHogProperties())
    }
}
