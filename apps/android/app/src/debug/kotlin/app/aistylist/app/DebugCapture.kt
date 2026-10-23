package app.aistylist.app

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import app.aistylist.app.capture.CaptureDebugHooks
import app.aistylist.app.capture.CaptureServices
import app.aistylist.feature.capture.CaptureUiState
import app.aistylist.feature.capture.CaptureViewModel
import app.aistylist.feature.capture.camera.SystemCaptureClock
import app.aistylist.feature.capture.debug.CaptureDebugPanel
import app.aistylist.feature.capture.debug.CaptureHarness
import app.aistylist.feature.capture.debug.CaptureHarnessArgs
import app.aistylist.feature.capture.debug.CaptureSweepScreen

/**
 * The `debug` build's capture camera: Home's "Add item" (capture brief Q-F) and the test-frame
 * harness from `:feature:capture-debug` (§11), driven by the launch extras. `preview` and `release`
 * declare the same object with neither.
 */
internal object DebugCapture {
    const val HAS_HOME_ENTRY: Boolean = true

    fun hooks(
        context: Context,
        intent: Intent,
    ): CaptureDebugHooks =
        HarnessHooks(CaptureHarness(context, CaptureHarnessArgs.from(intent.extras), SystemCaptureClock))
}

private class HarnessHooks(
    private val harness: CaptureHarness,
) : CaptureDebugHooks {
    override val opensSweepAtLaunch: Boolean get() = harness.args.isSweep

    override val screenReaderAtLaunch: Boolean get() = harness.args.isScreenReader

    override fun wrap(real: CaptureServices): CaptureServices {
        val camera = harness.wrap(real.source, real.camera, real.photos)
        return CaptureServices(camera, camera, real.photos, real.permission, real.optInStore, real.clock)
    }

    override fun startFlow(viewModel: CaptureViewModel) = harness.startFlow(viewModel)

    @Composable
    override fun Panel(
        state: CaptureUiState,
        spokenLog: List<String>,
        isScreenReaderForced: Boolean,
        onScreenReaderForced: (Boolean) -> Unit,
    ) = CaptureDebugPanel(harness, state, spokenLog, isScreenReaderForced, onScreenReaderForced)

    @Composable
    override fun Sweep(onDone: () -> Unit) = CaptureSweepScreen(harness, onDone)
}
