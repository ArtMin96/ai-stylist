package app.aistylist.feature.capture.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

/**
 * Where frames come from. Phase B plugs in CameraX + ML Kit (object detection, and pose in worn
 * mode) or the debug test-frame source. Adapters map their own failures to these results; nothing
 * here throws on a camera or model error.
 */
interface CaptureObservationSource {
    /**
     * Cold: opens the camera (or starts the frames) on collection and stops on cancellation. Emits
     * [CameraFeedEvent.Ready] once frames flow, then one [CameraFeedEvent.Frame] per analysed frame
     * (newest only), stamped with the session's [CaptureClock]. [poseDetection] says whether to run
     * the pose model (worn mode); it changes without restarting the camera.
     */
    fun feed(poseDetection: StateFlow<Boolean>): Flow<CameraFeedEvent>

    /** Takes the full-resolution photo; called only after the session requested a capture. */
    suspend fun takePhoto(): PhotoResult

    /** Measures an imported still once (no device or pose data); null when it cannot be read. */
    suspend fun analyzeStill(photo: PhotoRef): CaptureObservation?
}

sealed interface CameraFeedEvent {
    data object Ready : CameraFeedEvent

    data class Frame(
        val observation: CaptureObservation,
    ) : CameraFeedEvent

    data class Unavailable(
        val reason: CameraUnavailableReason,
    ) : CameraFeedEvent
}

sealed interface PhotoResult {
    data class Taken(
        val photo: PhotoRef,
    ) : PhotoResult

    data object Failed : PhotoResult
}

/**
 * The underwear worn opt-in, stored on the device only (DataStore in phase B), never sent and
 * never in analytics (capture brief §7).
 */
interface WornOptInStore {
    /** [WornOptIn.NOT_ASKED] until the user answers. */
    suspend fun load(): WornOptIn

    suspend fun save(optIn: WornOptIn)
}
