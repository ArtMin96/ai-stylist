package app.aistylist.feature.capture.camera

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import kotlinx.coroutines.flow.StateFlow

/**
 * What the camera screen shows and controls besides the observations: the live picture (CameraX, or
 * the debug test frames) and the torch, on phones that have one.
 */
interface CaptureCameraView {
    /** True only while a camera with a flash unit is open. */
    val hasTorch: StateFlow<Boolean>

    val isTorchOn: StateFlow<Boolean>

    fun setTorch(isOn: Boolean)

    /** The live picture, filling [modifier]'s bounds (centre-cropped). */
    @Composable
    fun Preview(modifier: Modifier)
}
