package app.aistylist.feature.capture

import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CaptureFlowState

/** Everything the capture screens render. Immutable; produced only by [CaptureViewModel]. */
data class CaptureUiState(
    val flow: CaptureFlowState = CaptureFlowState(),
    /** The live camera step; null on every other screen. */
    val camera: CameraSnapshot? = null,
    /** Spoken hints and "Take photo anyway" from the start (capture brief §8). */
    val isScreenReaderOn: Boolean = false,
    /** The speaker button (`cap-camera-speech`, Q-B): speech for anyone without a screen reader. */
    val isSpeechOn: Boolean = false,
)
