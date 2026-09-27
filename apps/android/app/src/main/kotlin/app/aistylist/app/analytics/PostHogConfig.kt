package app.aistylist.app.analytics

import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsPropertyValue
import app.aistylist.core.data.config.PostHogSettings
import com.posthog.PersonProfiles
import com.posthog.android.PostHogAndroidConfig
import java.io.File

/** Frames from our own code count as in-app (the SDK adds the applicationId, which is not a code package). */
private const val APP_CODE_PACKAGE = "app.aistylist"

/**
 * The PostHog SDK configuration (planning/14 §5). Pure: it builds the config object and never
 * calls the SDK; [PostHogAnalyticsSink.activate] hands it to `PostHogAndroid.setup` after consent.
 *
 * - On: error-tracking autocapture of uncaught JVM exceptions, the only automatic capture.
 * - Off: application lifecycle events, screen views, deep links, element/rage/dead clicks, session
 *   replay (with its screenshots, logcat and touches), surveys, feature-flag preload and
 *   `$feature_flag_called`, push-token registration and push-open events, NDK crash capture.
 * - People: person profiles for identified users only (the app identifies nobody yet), no default
 *   person properties.
 * - Breadcrumbs: none. Exception steps are off, so a crash report carries no trail of earlier
 *   activity (planning/14 §5 allows event names at most; iOS parity is none).
 * - Queue: the SDK keeps unsent events (and the crash it writes before the process dies) as files
 *   under [queueDirectory]. [PostHogAnalyticsSink.deactivate] deletes them on withdrawal.
 */
internal fun postHogConfig(
    settings: PostHogSettings,
    queueDirectory: File,
): PostHogAndroidConfig =
    PostHogAndroidConfig(apiKey = settings.apiKey, host = settings.host).apply {
        // posthog-android 3.71.1 keeps a preset prefix (PostHogAndroid.setup: `storagePrefix ?: …`)
        // and queues each event as a file under it (PostHogQueue: File(storagePrefix, apiKey)).
        storagePrefix = queueDirectory.absolutePath

        captureApplicationLifecycleEvents = false
        captureScreenViews = false
        captureDeepLinks = false
        captureElementInteractions = false
        captureRageClicks = false
        captureDeadClicks = false
        capturePushNotificationSubscriptions = false
        capturePushNotificationOpened = false

        sessionReplay = false
        sessionReplayConfig.screenshot = false
        sessionReplayConfig.captureLogcat = false
        sessionReplayConfig.captureTouches = false
        surveys = false

        preloadFeatureFlags = false
        sendFeatureFlagEvent = false

        personProfiles = PersonProfiles.IDENTIFIED_ONLY
        setDefaultPersonProperties = false

        errorTrackingConfig.autoCapture = true
        errorTrackingConfig.captureNativeCrashes = false
        errorTrackingConfig.inAppIncludes += APP_CODE_PACKAGE
        errorTrackingConfig.exceptionSteps.enabled = false

        debug = false
    }

/** The event's port properties as the scalars PostHog serialises, one [postHogValue] per value. */
internal fun AnalyticsEvent.postHogProperties(): Map<String, Any> =
    properties.mapValues { (_, value) -> value.postHogValue() }

/** One port property value → the scalar type PostHog serialises (string, number, boolean). */
internal fun AnalyticsPropertyValue.postHogValue(): Any =
    when (this) {
        is AnalyticsPropertyValue.Text -> value
        is AnalyticsPropertyValue.Number -> value
        is AnalyticsPropertyValue.Flag -> value
    }
