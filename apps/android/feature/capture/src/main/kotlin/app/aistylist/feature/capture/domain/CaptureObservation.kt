package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureBodyPart

/**
 * One analysed camera frame, or an imported still, as the observation source measured it. Raw
 * values only: [evaluateLiveChecks] and [evaluateImportChecks] apply every threshold.
 */
data class CaptureObservation(
    /** When the frame was analysed, on the session's [CaptureClock]. */
    val timestampMs: Long,
    /** Every tracked item box (ML Kit object detection); empty when no item was found. */
    val itemBoxes: List<NormalizedRect>,
    /** Variance of the 3×3 Laplacian on luma inside [itemBox] (capture brief §3); 0 without an item. */
    val sharpness: Double,
    val light: LightSample,
    /** Phone sensors; null without them (emulator, tablet, an imported still). */
    val device: DeviceSample? = null,
    /**
     * Pose landmarks, worn mode only. Null when the pose model did not run, failed to load or
     * errored: the "model available" flag, which turns on the doc-10 fallback in worn mode.
     */
    val pose: PoseSample? = null,
) {
    /** The item the rules judge: the largest box. Several items never lock (brief Q15). */
    val itemBox: NormalizedRect? get() = itemBoxes.maxByOrNull { it.areaShare }

    /** Item box area ÷ frame area; 0 without an item. */
    val areaShare: Double get() = itemBox?.areaShare ?: 0.0
}

/** Whole-frame light: mean luma (0–255) and the share of pixels at or above the clipped luma. */
data class LightSample(
    val meanLuma: Double,
    val clippedShare: Double,
)

/**
 * Phone motion: linear acceleration magnitude (accelerometer minus low-pass gravity) and the angle
 * between gravity and the phone's back axis.
 */
data class DeviceSample(
    val linearAccelerationMps2: Double,
    val tiltDegrees: Double,
)

/** One pose result. An empty map means no person was found, so every part is missing. */
data class PoseSample(
    val landmarks: Map<CaptureBodyPart, PoseLandmark>,
)

/** ML Kit `PoseLandmark`: its position in the analysis frame and `getInFrameLikelihood()` (0–1). */
data class PoseLandmark(
    val position: NormalizedPoint,
    val inFrameLikelihood: Double,
)
