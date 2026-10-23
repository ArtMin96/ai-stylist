package app.aistylist.app.capture

import android.content.Context
import app.aistylist.feature.capture.camera.CameraPermissionGate
import app.aistylist.feature.capture.camera.CameraXObservationSource
import app.aistylist.feature.capture.camera.CaptureCameraView
import app.aistylist.feature.capture.camera.CapturePhotoStore
import app.aistylist.feature.capture.camera.SharedPreferencesWornOptInStore
import app.aistylist.feature.capture.camera.SystemCaptureClock
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureObservationSource
import app.aistylist.feature.capture.domain.WornOptInStore
import app.aistylist.feature.capture.ui.CaptureRouteDependencies

/**
 * The guided capture camera's adapters, built once by the composition root: the CameraX source (also
 * the preview and torch), the in-memory photo store, the permission gate, the on-device opt-in store
 * and the clock. A debug harness may replace [source] and [camera] with its test-frame source.
 */
class CaptureServices(
    val source: CaptureObservationSource,
    val camera: CaptureCameraView,
    val photos: CapturePhotoStore,
    val permission: CameraPermissionGate,
    val optInStore: WornOptInStore,
    val clock: CaptureClock,
) {
    val routeDependencies: CaptureRouteDependencies get() = CaptureRouteDependencies(camera, photos, permission)

    companion object {
        fun create(context: Context): CaptureServices {
            val appContext = context.applicationContext
            val photos = CapturePhotoStore(appContext)
            val permission = CameraPermissionGate(appContext)
            val camera = CameraXObservationSource(appContext, photos, permission, SystemCaptureClock)
            return CaptureServices(
                source = camera,
                camera = camera,
                photos = photos,
                permission = permission,
                optInStore = SharedPreferencesWornOptInStore(appContext),
                clock = SystemCaptureClock,
            )
        }
    }
}
