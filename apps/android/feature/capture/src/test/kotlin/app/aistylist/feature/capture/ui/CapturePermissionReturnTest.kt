package app.aistylist.feature.capture.ui

import android.Manifest
import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.feature.capture.CaptureViewModel
import app.aistylist.feature.capture.FakeObservationSource
import app.aistylist.feature.capture.FakeWornOptInStore
import app.aistylist.feature.capture.camera.CameraPermissionGate
import app.aistylist.feature.capture.camera.CaptureCameraView
import app.aistylist.feature.capture.camera.CapturePhotoStore
import app.aistylist.feature.capture.domain.CameraFeedEvent
import app.aistylist.feature.capture.domain.CameraUnavailableReason
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureScreen
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** C23: access granted in Settings brings the user back to the camera step (Robolectric, whole route). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37], qualifiers = "w390dp-h844dp")
class CapturePermissionReturnTest {
    @get:Rule
    val compose = createComposeRule()

    private val context = RuntimeEnvironment.getApplication()
    private val owner = TestLifecycleOwner()
    private val source =
        FakeObservationSource(CaptureClock { SystemClock.uptimeMillis() }).apply {
            script = { emit(CameraFeedEvent.Unavailable(CameraUnavailableReason.PERMISSION_DENIED)) }
        }
    private val viewModel = CaptureViewModel(source, FakeWornOptInStore(), CaptureClock { SystemClock.uptimeMillis() })

    @Test
    fun `access granted in Settings returns to the camera step`() {
        shadowOf(context).denyPermissions(Manifest.permission.CAMERA)
        val gate = CameraPermissionGate(context).apply { onResult(isGranted = false) }
        compose.setContent {
            CompositionLocalProvider(LocalLifecycleOwner provides owner) {
                AppTheme {
                    CaptureRoute(
                        viewModel = viewModel,
                        dependencies = CaptureRouteDependencies(NoCameraView, CapturePhotoStore(context), gate),
                        onClosed = {},
                    )
                }
            }
        }
        compose.runOnIdle { viewModel.onFamilyPicked(CaptureShapeFamily.TOP) }
        compose.waitForIdle()
        assertEquals(CaptureScreen.PermissionDenied::class, viewModel.uiState.value.flow.screen::class)

        // The user opens Settings (the app stops), grants the camera and comes back (the app starts).
        compose.runOnIdle { owner.registry.currentState = Lifecycle.State.CREATED }
        shadowOf(context).grantPermissions(Manifest.permission.CAMERA)
        source.script = {
            emit(CameraFeedEvent.Ready)
            awaitCancellation()
        }
        compose.runOnIdle { owner.registry.currentState = Lifecycle.State.RESUMED }
        compose.waitForIdle()

        val screen = viewModel.uiState.value.flow.screen
        assertEquals(CaptureScreen.Camera::class, screen::class)
        assertEquals(CaptureShapeFamily.TOP, (screen as CaptureScreen.Camera).context.family)
        compose.runOnIdle { viewModel.onClose() }
    }

    private class TestLifecycleOwner : LifecycleOwner {
        val registry: LifecycleRegistry =
            LifecycleRegistry.createUnsafe(this).apply { currentState = Lifecycle.State.RESUMED }
        override val lifecycle: Lifecycle get() = registry
    }

    /** No camera hardware in the test: the route only needs a preview slot and no torch. */
    private object NoCameraView : CaptureCameraView {
        override val hasTorch: StateFlow<Boolean> = MutableStateFlow(false)
        override val isTorchOn: StateFlow<Boolean> = MutableStateFlow(false)

        override fun setTorch(isOn: Boolean) = Unit

        @Composable
        override fun Preview(modifier: Modifier) = Unit
    }
}
