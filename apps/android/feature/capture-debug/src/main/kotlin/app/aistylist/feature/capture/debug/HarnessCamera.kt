package app.aistylist.feature.capture.debug

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aistylist.feature.capture.camera.CaptureCameraView
import app.aistylist.feature.capture.domain.CameraFeedEvent
import app.aistylist.feature.capture.domain.CaptureObservation
import app.aistylist.feature.capture.domain.CaptureObservationSource
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.PhotoResult
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlin.math.max

/**
 * The camera as the debug build sees it: the real CameraX source, or a frame set standing in for it
 * through the same port. Picking a set (or the camera) restarts the feed, so the step warms up again.
 */
class HarnessCamera(
    private val real: CaptureObservationSource,
    private val realView: CaptureCameraView,
) : CaptureObservationSource,
    CaptureCameraView {
    val frames = MutableStateFlow<FrameSetSource?>(null)

    override val hasTorch: StateFlow<Boolean> get() = realView.hasTorch
    override val isTorchOn: StateFlow<Boolean> get() = realView.isTorchOn

    override fun setTorch(isOn: Boolean) = realView.setTorch(isOn)

    @OptIn(ExperimentalCoroutinesApi::class) // flatMapLatest: a new source replaces the running feed.
    override fun feed(poseDetection: StateFlow<Boolean>): Flow<CameraFeedEvent> =
        frames.flatMapLatest { source -> source?.feed(poseDetection) ?: real.feed(poseDetection) }

    override suspend fun takePhoto(): PhotoResult = (frames.value ?: real).takePhoto()

    override suspend fun analyzeStill(photo: PhotoRef): CaptureObservation? = real.analyzeStill(photo)

    @Composable
    override fun Preview(modifier: Modifier) {
        val source by frames.collectAsStateWithLifecycle()
        val current = source
        if (current == null) realView.Preview(modifier) else FramePreview(current, modifier)
    }
}

/** The frame on screen, centre-cropped like the camera preview and moved by its jitter. */
@Composable
private fun FramePreview(
    source: FrameSetSource,
    modifier: Modifier = Modifier,
) {
    val shown by source.shown.collectAsStateWithLifecycle()
    val frame = shown ?: return
    val image = frame.bitmap.asImageBitmap()
    Canvas(modifier = modifier) {
        val scale = max(size.width / image.width, size.height / image.height)
        val width = image.width * scale
        val height = image.height * scale
        withTransform({
            translate(
                (size.width - width) / 2 + (frame.offset.dx * width).toFloat(),
                (size.height - height) / 2 + (frame.offset.dy * height).toFloat(),
            )
        }) {
            drawImage(image, dstOffset = IntOffset.Zero, dstSize = IntSize(width.toInt(), height.toInt()))
        }
    }
}
