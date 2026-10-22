package app.aistylist.feature.capture.debug

import android.graphics.Bitmap
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.feature.capture.camera.CapturePhotoStore
import app.aistylist.feature.capture.domain.CameraFeedEvent
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureObservation
import app.aistylist.feature.capture.domain.CaptureObservationSource
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.PhotoResult
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn

/** The frame on screen and where it is: segment [segmentIndex] started at [segmentStartMs]. */
data class ShownFrame(
    val bitmap: Bitmap,
    val offset: FrameOffset,
    val segmentIndex: Int,
    val segmentStartMs: Long,
)

/**
 * Plays one frame set in real time through the camera step (capture brief §11): each segment's
 * image for its frame count at the index's fps, moved by its jitter, the last segment looping until
 * the step ends. Observations come from [analysis], stamped with the session [clock]. A photo is the
 * frame on screen; imported stills go to [stills] (the real analysis path). With [recordsCaptures]
 * (`captureRecordOnly=1`) a single set's photo is not taken: the session locks again and the camera
 * carries on, as in a sweep, so the unlocked states keep coming back for screenshots.
 */
class FrameSetSource(
    val set: FrameSet,
    private val analysis: HarnessAnalysis,
    private val fps: Int,
    private val clock: CaptureClock,
    private val photos: CapturePhotoStore,
    private val stills: CaptureObservationSource,
    private val dispatcher: CoroutineDispatcher,
    private val recordsCaptures: Boolean = false,
) : CaptureObservationSource {
    private val shownFrame = MutableStateFlow<ShownFrame?>(null)
    val shown: StateFlow<ShownFrame?> = shownFrame.asStateFlow()

    override fun feed(poseDetection: StateFlow<Boolean>): Flow<CameraFeedEvent> =
        flow {
            // Ready once the first frame is measured (the detector probe runs on first use), like
            // the camera, whose first analysed frame makes it ready: the anyway timer starts here.
            analysis.use { analyzer -> analyzer.bitmap(set.segments.first()) }
            emit(CameraFeedEvent.Ready)
            set.segments.forEachIndexed { index, segment ->
                val isLast = index == set.segments.lastIndex
                val startMs = clock.nowMs()
                var frameNumber = 0
                while (isLast || frameNumber < segment.frames) {
                    val observation =
                        analysis.use { analyzer ->
                            val offset = analyzer.offset(segment, frameNumber)
                            shownFrame.value = ShownFrame(analyzer.bitmap(segment), offset, index, startMs)
                            val withPose = poseDetection.value && set.mode == CaptureMode.WORN
                            analyzer.observe(segment, offset, clock.nowMs(), withPose)
                        }
                    emit(CameraFeedEvent.Frame(observation))
                    frameNumber++
                    // Frame n is due at n / fps from the segment's start, so measuring a frame does not
                    // slow playback below the index's fps (brief §11: 30 frames per second).
                    delay((startMs + frameNumber * MS_PER_SECOND / fps - clock.nowMs()).coerceAtLeast(0))
                }
            }
        }.flowOn(dispatcher)

    override suspend fun takePhoto(): PhotoResult {
        if (recordsCaptures && !set.isBatch) return PhotoResult.Failed
        val frame = shownFrame.value ?: return PhotoResult.Failed
        return PhotoResult.Taken(photos.put(frame.bitmap))
    }

    override suspend fun analyzeStill(photo: PhotoRef): CaptureObservation? = stills.analyzeStill(photo)

    private companion object {
        const val MS_PER_SECOND = 1000L
    }
}
