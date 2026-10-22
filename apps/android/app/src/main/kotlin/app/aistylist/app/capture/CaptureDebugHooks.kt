package app.aistylist.app.capture

import androidx.compose.runtime.Composable
import app.aistylist.feature.capture.CaptureUiState
import app.aistylist.feature.capture.CaptureViewModel

/**
 * The capture camera's debug harness as the app shell sees it (capture brief §11). Only the `debug`
 * build has one (`DebugCapture` per build type, like the design-system catalog); `preview` and
 * `release` have none and never see `:feature:capture-debug`.
 */
internal interface CaptureDebugHooks {
    /** The launch asked for a sweep over every frame set (`captureSweep=1`). */
    val opensSweepAtLaunch: Boolean

    /** The debug screen-reader flag at launch (`captureScreenReader=1`). */
    val screenReaderAtLaunch: Boolean

    /** [real] wrapped so a frame set can stand in for the camera. */
    fun wrap(real: CaptureServices): CaptureServices

    /** Opens a fresh flow on the picker; the selected frame set plays at the next camera step. */
    fun startFlow(viewModel: CaptureViewModel)

    /** The debug panel over the capture screens. */
    @Composable
    fun Panel(
        state: CaptureUiState,
        spokenLog: List<String>,
        isScreenReaderForced: Boolean,
        onScreenReaderForced: (Boolean) -> Unit,
    )

    /** The sweep: every frame set through the lock machine, results to `capture-results.jsonl`. */
    @Composable
    fun Sweep(onDone: () -> Unit)
}
