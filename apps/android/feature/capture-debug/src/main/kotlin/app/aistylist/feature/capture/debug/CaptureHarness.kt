package app.aistylist.feature.capture.debug

import android.content.Context
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.feature.capture.CaptureViewModel
import app.aistylist.feature.capture.camera.CaptureCameraView
import app.aistylist.feature.capture.camera.CapturePhotoStore
import app.aistylist.feature.capture.camera.LiteRtGarmentSegmenter
import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureObservationSource
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import java.io.File

/**
 * The capture camera's debug harness (capture brief §11), `debug` builds only: frame sets in place of
 * the camera, the screen-reader flag, the results log and the sweep. The app shell builds one per
 * activity from the launch extras ([CaptureHarnessArgs]).
 *
 * Frames are read from [framesDir]: by default `capture-frames/` in the app's external files folder,
 * where `apps/android/tools/capture-frames.sh push` copies `artifacts/capture-camera/frames/`.
 */
class CaptureHarness(
    private val context: Context,
    val args: CaptureHarnessArgs,
    private val clock: CaptureClock,
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default,
) {
    private val filesDir: File = context.getExternalFilesDir(null) ?: context.filesDir
    val framesDir: File = args.framesDir ?: File(filesDir, FRAMES_FOLDER)
    val files: ResultsFiles = ResultsFiles(filesDir)

    init {
        // A sweep launch starts from no results, so nothing waits on an old `capture-results.done`.
        if (args.isSweep) files.reset()
    }

    /** The frames index, read on first use; null when no frames were pushed. */
    val index: FrameIndex? by lazy { FrameIndex.load(framesDir) }

    val analysis: HarnessAnalysis? by lazy {
        index?.let { HarnessAnalysis(it, args, files, dispatcher) { LiteRtGarmentSegmenter.load(context) } }
    }

    private var camera: HarnessCamera? = null
    private var photos: CapturePhotoStore? = null
    private var viewModel: CaptureViewModel? = null
    private var recorder: InteractiveRecorder? = null

    /** The selected frame set; null while the real camera runs. */
    val selectedSet: FrameSet? get() = camera?.frames?.value?.set

    /** The camera port and view with frame sets standing in when picked. */
    fun wrap(
        source: CaptureObservationSource,
        view: CaptureCameraView,
        photoStore: CapturePhotoStore,
    ): HarnessCamera {
        val wrapped = HarnessCamera(source, view)
        camera = wrapped
        photos = photoStore
        args.frameSetId?.let(::select)
        return wrapped
    }

    /** Plays [setId] (or the real camera for null) from the next camera step on; false when unknown. */
    fun select(setId: String?): Boolean {
        val target = camera ?: return false
        if (setId == null) {
            target.frames.value = null
            return true
        }
        val currentIndex = index ?: return false
        val set = currentIndex.set(setId) ?: return false
        val shared = analysis ?: return false
        val store = photos ?: return false
        target.frames.value =
            FrameSetSource(
                set,
                shared,
                currentIndex.fps,
                clock,
                store,
                stills = target,
                dispatcher = dispatcher,
                playback =
                    RealTimePlayback(
                        recordsCaptures = args.recordsCaptures,
                        holdFirstFrameMs = args.holdFirstFrameMs,
                        holdCaptureMs = args.holdCaptureMs,
                    ),
            )
        return true
    }

    /**
     * A fresh flow from Home's "Add item": the picker, as on iOS; the selected set plays at whichever
     * camera step the user opens, so the shared e2e/capture flows walk the same screens on both apps.
     */
    fun startFlow(target: CaptureViewModel) {
        viewModel = target
        target.onOpened()
        files.reset()
    }

    /** Picks [setId] and restarts the flow on its camera step (the debug panel's set list). */
    fun play(setId: String?) {
        if (!select(setId)) return
        viewModel?.let(::openSet)
    }

    /** A fresh flow straight on the selected set's camera step (its family and mode, or batch). */
    private fun openSet(target: CaptureViewModel) {
        target.onOpened()
        val set = selectedSet ?: return
        if (set.isBatch) {
            target.onBatchPicked()
        } else {
            target.onFamilyPicked(set.family)
            if (set.mode != CaptureMode.FLAT) target.onModeSelected(set.mode)
        }
        files.reset()
    }

    /** The interactive results log: one line per segment of the set on screen, on the real clock. */
    fun record(snapshot: CameraSnapshot?) {
        val source = camera?.frames?.value
        val frame = source?.shown?.value
        if (source == null || frame == null || snapshot == null) {
            recorder?.flush(files)
            recorder = null
            return
        }
        val probe = analysis?.probe
        val current =
            recorder?.takeIf { it.matches(source.set, frame.segmentIndex) }
                ?: InteractiveRecorder(
                    SegmentRecord(
                        source.set,
                        frame.segmentIndex,
                        frame.segmentStartMs,
                        clock = "real",
                        detector = probe?.boxes ?: BoxSource.AUTO,
                        pose = probe?.pose ?: PoseSource.AUTO,
                        masks = MaskPlay(args.masks),
                        drawnBefore = snapshot.outline,
                    ),
                    source.set,
                    frame.segmentIndex,
                ).also {
                    recorder?.flush(files)
                    recorder = it
                }
        current.record.onState(StepState.of(snapshot), clock.nowMs())
        current.record.onOutline(snapshot.outline, frame.reference, frame.offset, clock.nowMs())
    }

    private class InteractiveRecorder(
        val record: SegmentRecord,
        private val set: FrameSet,
        private val segmentIndex: Int,
    ) {
        fun matches(
            other: FrameSet,
            index: Int,
        ): Boolean = other.id == set.id && index == segmentIndex

        fun flush(files: ResultsFiles) = files.append(record.toJson())
    }

    companion object {
        const val FRAMES_FOLDER: String = "capture-frames"
    }
}
