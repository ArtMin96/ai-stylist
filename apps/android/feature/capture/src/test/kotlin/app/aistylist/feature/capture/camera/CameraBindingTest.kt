package app.aistylist.feature.capture.camera

import app.aistylist.feature.capture.domain.CameraUnavailableReason
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Binding the camera's use cases (regression): a phone that cannot run preview, analysis and capture
 * together makes CameraX throw from `bindToLifecycle`; the step must show the no-camera screen (with
 * import) instead of crashing the app.
 */
class CameraBindingTest {
    @Test
    fun `a successful bind leaves the camera available`() {
        var bound = false

        val reason = bindOrUnavailable { bound = true }

        assertNull(reason)
        assertEquals(true, bound)
    }

    @Test
    fun `an unsupported use-case combination reads as no camera instead of crashing`() {
        val reason = bindOrUnavailable { throw IllegalArgumentException("No supported surface combination") }

        assertEquals(CameraUnavailableReason.NO_CAMERA, reason)
    }

    @Test
    fun `a camera that cannot open reads as no camera instead of crashing`() {
        val reason = bindOrUnavailable { throw IllegalStateException("camera closed") }

        assertEquals(CameraUnavailableReason.NO_CAMERA, reason)
    }
}
