package app.aistylist.app.analytics

import android.content.Context
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import java.io.File

/** Where the SDK keeps its event queue (in the app's cache: never backed up). */
private const val QUEUE_DIRECTORY = "posthog-queue"

/**
 * The posthog-android calls [PostHogAnalyticsSink] makes, behind one seam so its consent lifecycle
 * is unit-tested with a fake SDK (`PostHogAnalyticsSinkTest`). [AndroidPostHogSdk] is the only
 * implementation that reaches the SDK.
 */
internal interface PostHogSdk {
    /** The directory the SDK's event queue writes to; [postHogConfig] points the SDK at it. */
    val queueDirectory: File

    fun setup(config: PostHogAndroidConfig)

    fun optIn()

    fun optOut()

    fun flush()

    fun close()

    fun capture(
        event: String,
        properties: Map<String, Any>,
    )
}

/** The official SDK: the process-wide `PostHog` instance, set up through `PostHogAndroid`. */
internal class AndroidPostHogSdk(
    private val context: Context,
) : PostHogSdk {
    override val queueDirectory: File = File(context.cacheDir, QUEUE_DIRECTORY)

    override fun setup(config: PostHogAndroidConfig) = PostHogAndroid.setup(context, config)

    override fun optIn() = PostHog.optIn()

    override fun optOut() = PostHog.optOut()

    override fun flush() = PostHog.flush()

    override fun close() = PostHog.close()

    override fun capture(
        event: String,
        properties: Map<String, Any>,
    ) = PostHog.capture(event = event, properties = properties)
}
