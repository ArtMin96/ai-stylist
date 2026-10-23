package app.aistylist.feature.capture.camera

import app.aistylist.feature.capture.domain.CameraUnavailableReason

/**
 * Binds the camera's use cases with [bind]. A phone that cannot run preview, analysis and capture
 * together (CameraX `bindToLifecycle` throws [IllegalArgumentException]), or a camera that cannot open
 * ([IllegalStateException]), reads as [CameraUnavailableReason.NO_CAMERA]: the step shows the
 * no-camera screen with import instead of crashing the app. Null when the bind succeeded.
 */
internal inline fun bindOrUnavailable(bind: () -> Unit): CameraUnavailableReason? =
    try {
        bind()
        null
    } catch (_: IllegalArgumentException) {
        CameraUnavailableReason.NO_CAMERA
    } catch (_: IllegalStateException) {
        CameraUnavailableReason.NO_CAMERA
    }
