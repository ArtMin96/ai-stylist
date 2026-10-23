package app.aistylist.feature.capture

import app.aistylist.feature.capture.domain.CameraFeedEvent
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureObservation
import app.aistylist.feature.capture.domain.CaptureObservationSource
import app.aistylist.feature.capture.domain.LightSample
import app.aistylist.feature.capture.domain.NormalizedRect
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.PhotoResult
import app.aistylist.feature.capture.domain.WornOptIn
import app.aistylist.feature.capture.domain.WornOptInStore
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flow

// Synthetic frames and photo references only.

internal val STEADY_ITEM = NormalizedRect(left = 0.2, top = 0.2, right = 0.8, bottom = 0.8)

internal fun syntheticFrame(
    timestampMs: Long,
    box: NormalizedRect? = STEADY_ITEM,
    meanLuma: Double = 128.0,
): CaptureObservation =
    CaptureObservation(
        timestampMs = timestampMs,
        itemBoxes = listOfNotNull(box),
        sharpness = 40.0,
        light = LightSample(meanLuma = meanLuma, clippedShare = 0.0),
    )

/**
 * A scripted camera: by default "ready", then a steady item every [frameEveryMs]. Counts open feeds
 * so tests can see the camera start and stop.
 */
internal class FakeObservationSource(
    private val clock: CaptureClock,
    private val frameEveryMs: Long = 100,
) : CaptureObservationSource {
    var script: suspend FlowCollector<CameraFeedEvent>.() -> Unit = {
        emit(CameraFeedEvent.Ready)
        while (true) {
            delay(frameEveryMs)
            emit(CameraFeedEvent.Frame(syntheticFrame(clock.nowMs())))
        }
    }
    var photo: PhotoResult = PhotoResult.Taken(PhotoRef("synthetic-photo"))
    var still: CaptureObservation? = null

    var openFeeds = 0
        private set
    var feedsStarted = 0
        private set
    var photosTaken = 0
        private set
    var poseDetection: StateFlow<Boolean>? = null
        private set

    override fun feed(poseDetection: StateFlow<Boolean>): Flow<CameraFeedEvent> =
        flow {
            this@FakeObservationSource.poseDetection = poseDetection
            feedsStarted++
            openFeeds++
            try {
                script()
            } finally {
                openFeeds--
            }
        }

    override suspend fun takePhoto(): PhotoResult {
        photosTaken++
        return photo
    }

    override suspend fun analyzeStill(photo: PhotoRef): CaptureObservation? = still
}

/** The on-device store, in memory. */
internal class FakeWornOptInStore(
    var stored: WornOptIn = WornOptIn.NOT_ASKED,
) : WornOptInStore {
    override suspend fun load(): WornOptIn = stored

    override suspend fun save(optIn: WornOptIn) {
        stored = optIn
    }
}
