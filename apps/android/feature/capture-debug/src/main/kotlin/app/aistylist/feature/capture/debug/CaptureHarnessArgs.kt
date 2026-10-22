package app.aistylist.feature.capture.debug

import android.os.Bundle
import java.io.File

/** Where item boxes come from in the harness (capture brief §11, harness step 6.5). */
enum class BoxSource(
    val id: String,
) {
    /** Probe ML Kit (recorded in `capture-probe.json`), then play the stored boxes ([DetectorProbe]). */
    AUTO("auto"),

    /** ML Kit object detection on every test frame. */
    LIVE("mlkit-live"),

    /** The `frame.box.json` boxes the generator stored. */
    STORED("stored-box"),
}

/** Where the garment mask comes from (the rules read the item from it, as on the phone). */
enum class MaskSource(
    val id: String,
) {
    /** The generator's stored mask (`frame.instances.png`, else `frame.mask.png`): the scored sweep. */
    STORED("stored-mask"),

    /** The real LiteRT segmenter on each frame PNG: the live-model sweep. */
    LIVE("litert-live"),

    /** No mask: the ML Kit box path, the camera's fallback when the segmenter cannot load. */
    NONE("boxes"),
}

/** Where the covered rule's other-object boxes come from with a live mask (C32 measurement). */
enum class CoveredSource(
    val id: String,
) {
    /** The mask's other connected components. */
    COMPONENTS("mask-components"),

    /** ML Kit object boxes, without the one that matches the item best. */
    OBJECT_BOXES("mlkit-boxes"),
}

/** Where worn-mode keypoints come from: the live pose model, or the generator's keypoint files. */
enum class PoseSource(
    val id: String,
) {
    AUTO("auto"),
    LIVE("mlkit-live"),
    KEYPOINTS("keypoint-file"),
}

/**
 * The harness launch options, from intent extras (`adb shell am start -e <name> <value>`):
 * `captureFrameSet=<set id>`, `captureScreenReader=1`, `captureSweep=1`, `captureRecordOnly=1` (in
 * real time a capture is recorded and the camera carries on, as in a sweep), and for runs by hand
 * `captureFramesDir=<path>`, `captureBoxes=auto|live|stored`, `capturePose=auto|live|keypoints`,
 * `captureMasks=stored|live|none` (default stored), `captureCovered=components|mlkit` (live masks),
 * `captureSweepFilter=<set id prefix>` and `captureDebugPanel=0` (hide the panel for screenshots).
 */
data class CaptureHarnessArgs(
    val frameSetId: String? = null,
    val isScreenReader: Boolean = false,
    val isSweep: Boolean = false,
    val framesDir: File? = null,
    val boxes: BoxSource = BoxSource.AUTO,
    val pose: PoseSource = PoseSource.AUTO,
    val sweepFilter: String? = null,
    val showsPanel: Boolean = true,
    val recordsCaptures: Boolean = false,
    val masks: MaskSource = MaskSource.STORED,
    val covered: CoveredSource = CoveredSource.COMPONENTS,
) {
    companion object {
        const val FRAME_SET: String = "captureFrameSet"
        const val SCREEN_READER: String = "captureScreenReader"
        const val SWEEP: String = "captureSweep"
        const val FRAMES_DIR: String = "captureFramesDir"
        const val BOXES: String = "captureBoxes"
        const val POSE: String = "capturePose"
        const val SWEEP_FILTER: String = "captureSweepFilter"
        const val DEBUG_PANEL: String = "captureDebugPanel"
        const val RECORD_ONLY: String = "captureRecordOnly"
        const val MASKS: String = "captureMasks"
        const val COVERED: String = "captureCovered"

        fun from(extras: Bundle?): CaptureHarnessArgs {
            if (extras == null) return CaptureHarnessArgs()
            return CaptureHarnessArgs(
                frameSetId = extras.getString(FRAME_SET)?.takeIf { it.isNotBlank() },
                isScreenReader = extras.getString(SCREEN_READER) == "1",
                isSweep = extras.getString(SWEEP) == "1",
                framesDir = extras.getString(FRAMES_DIR)?.let(::File),
                boxes =
                    when (extras.getString(BOXES)) {
                        "live" -> BoxSource.LIVE
                        "stored" -> BoxSource.STORED
                        else -> BoxSource.AUTO
                    },
                pose =
                    when (extras.getString(POSE)) {
                        "live" -> PoseSource.LIVE
                        "keypoints" -> PoseSource.KEYPOINTS
                        else -> PoseSource.AUTO
                    },
                sweepFilter = extras.getString(SWEEP_FILTER)?.takeIf { it.isNotBlank() },
                showsPanel = extras.getString(DEBUG_PANEL) != "0",
                recordsCaptures = extras.getString(RECORD_ONLY) == "1",
                masks =
                    when (extras.getString(MASKS)) {
                        "live" -> MaskSource.LIVE
                        "none" -> MaskSource.NONE
                        else -> MaskSource.STORED
                    },
                covered =
                    if (extras.getString(COVERED) ==
                        "mlkit"
                    ) {
                        CoveredSource.OBJECT_BOXES
                    } else {
                        CoveredSource.COMPONENTS
                    },
            )
        }
    }
}
