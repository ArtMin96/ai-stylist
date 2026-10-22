package app.aistylist.feature.capture.debug

import android.os.Bundle
import app.aistylist.contracts.kernel.CaptureRules
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
 * real time a capture is recorded and the camera carries on, as in a sweep),
 * `captureHoldFirstFrameMs=<ms>` and `captureHoldCaptureMs=<ms>` (real time: the first frame comes
 * that late and each photo takes that long, so warming up and capturing can be screenshot), and for runs by hand
 * `captureFramesDir=<path>`, `captureBoxes=auto|live|stored`, `capturePose=auto|live|keypoints`,
 * `captureMasks=stored|live|none` (default stored), `captureCovered=components|mlkit` (live masks),
 * `captureMaskCadenceMs=<ms>` (sweeps: a new mask every 250 ms by default, reused in between, as on
 * the phone; 0 gives every frame a fresh mask),
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
    /** Sweeps: how often a new mask is taken (0: on every frame). */
    val maskCadenceMs: Int = 0,
    /** Real time only: the first frame comes this late (warming up stays on screen); 0 is off. */
    val holdFirstFrameMs: Long = 0,
    /** Real time only: each photo takes this long (capturing stays on screen); 0 is off. */
    val holdCaptureMs: Long = 0,
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
        const val MASK_CADENCE_MS: String = "captureMaskCadenceMs"
        const val HOLD_FIRST_FRAME_MS: String = "captureHoldFirstFrameMs"
        const val HOLD_CAPTURE_MS: String = "captureHoldCaptureMs"

        fun from(extras: Bundle?): CaptureHarnessArgs {
            if (extras == null) return CaptureHarnessArgs()
            val isSweep = extras.getString(SWEEP) == "1"
            return CaptureHarnessArgs(
                frameSetId = extras.getString(FRAME_SET)?.takeIf { it.isNotBlank() },
                isScreenReader = extras.getString(SCREEN_READER) == "1",
                isSweep = isSweep,
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
                masks = maskSource(extras.getString(MASKS)),
                covered =
                    if (extras.getString(COVERED) ==
                        "mlkit"
                    ) {
                        CoveredSource.OBJECT_BOXES
                    } else {
                        CoveredSource.COMPONENTS
                    },
                maskCadenceMs = maskCadence(extras.getString(MASK_CADENCE_MS), isSweep),
                holdFirstFrameMs = holdMs(extras.getString(HOLD_FIRST_FRAME_MS)),
                holdCaptureMs = holdMs(extras.getString(HOLD_CAPTURE_MS)),
            )
        }

        /** A whole number of milliseconds over 0, else 0 (off). */
        private fun holdMs(value: String?): Long = value?.toLongOrNull()?.coerceAtLeast(0) ?: 0

        private fun maskSource(value: String?): MaskSource =
            when (value) {
                "live" -> MaskSource.LIVE
                "none" -> MaskSource.NONE
                else -> MaskSource.STORED
            }

        /** A sweep plays the live mask cadence unless told otherwise; an interactive run a fresh mask per frame. */
        private fun maskCadence(
            value: String?,
            isSweep: Boolean,
        ): Int = value?.toIntOrNull() ?: if (isSweep) CaptureRules.Mask.INTERVAL_MS else 0
    }
}
