package app.aistylist.feature.capture.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first

/** The runtime camera permission as the capture flow sees it (C23). */
enum class CameraPermission { NOT_ASKED, GRANTED, DENIED }

/**
 * Shared by the camera source, which waits for an answer before it opens the camera, and the
 * capture screen, which asks the system and reports the answer through [onResult].
 */
class CameraPermissionGate(
    private val context: Context,
) {
    private val state = MutableStateFlow(current())
    val permission: StateFlow<CameraPermission> = state.asStateFlow()

    /** Re-reads the system state (e.g. back from Settings); a missing grant becomes "ask again". */
    fun refresh() {
        state.value = current()
    }

    fun onResult(isGranted: Boolean) {
        state.value = if (isGranted) CameraPermission.GRANTED else CameraPermission.DENIED
    }

    /** Suspends until the user answered (or the grant already exists); true when granted. */
    suspend fun awaitAnswer(): Boolean = state.first { it != CameraPermission.NOT_ASKED } == CameraPermission.GRANTED

    private fun current(): CameraPermission =
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            CameraPermission.GRANTED
        } else {
            CameraPermission.NOT_ASKED
        }
}
