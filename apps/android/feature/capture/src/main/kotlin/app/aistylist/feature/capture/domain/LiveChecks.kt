package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureLockReason
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.contracts.kernel.CaptureShapeFamily
import kotlin.math.abs

/** The live checks of capture brief §3, in the priority order of §6. */
enum class CaptureCheck { ITEM_FOUND, CUT_OFF, BODY_PARTS, SIZE, STEADY, TOO_DARK, TOO_BRIGHT, TILT }

/** One check's result. [SKIPPED]: the check does not apply to this frame, mode or device. */
enum class CheckOutcome { PASSED, FAILED, SKIPPED }

/** Every check's result for one frame, and the hints they produce. */
data class CheckReport(
    val outcomes: Map<CaptureCheck, CheckOutcome>,
    /** The highest-priority failing blocking check's hint; null when the frame passes. */
    val blockingHint: CaptureHint?,
    /** The highest-priority advisory hint (never locks); it shows only when nothing blocks. */
    val advisoryHint: CaptureHint?,
    /** The judged item box (the largest), kept for steadiness and the batch cooldown. */
    val itemBox: NormalizedRect?,
    /** The tilt hint after hysteresis; feed it back as `wasTiltHintOn` on the next frame. */
    val isTiltHintOn: Boolean,
    /** Worn mode needs body parts, but the pose model is unavailable (doc-10 fallback). */
    val isPoseFallback: Boolean,
) {
    /** No blocking check failed: the frame counts towards unlocking the shutter. */
    val passes: Boolean get() = blockingHint == null

    val lockReason: CaptureLockReason? get() = blockingHint?.lockReason
}

/**
 * Evaluates one live camera frame for [context]. [previous] is the last evaluated frame (null on the
 * first, so a first frame with an item never passes "steady"); [wasTiltHintOn] is the previous
 * report's [CheckReport.isTiltHintOn].
 */
fun evaluateLiveChecks(
    observation: CaptureObservation,
    previous: CaptureObservation?,
    context: CameraContext,
    wasTiltHintOn: Boolean = false,
): CheckReport {
    val box = observation.itemBox
    val isWorn = context.mode == CaptureMode.WORN
    val tiltOn = isTiltHintOn(observation.device, context.mode, wasTiltHintOn)
    val findings =
        linkedMapOf(
            CaptureCheck.ITEM_FOUND to itemFound(box),
            CaptureCheck.CUT_OFF to if (isWorn) SKIPPED else cutOff(box),
            CaptureCheck.BODY_PARTS to
                if (isWorn && box != null) bodyParts(observation.pose, context.family) else SKIPPED,
            CaptureCheck.SIZE to size(box, minAreaShare(context)),
            CaptureCheck.STEADY to steady(box, previous?.itemBox, observation),
            CaptureCheck.TOO_DARK to tooDark(observation.light),
            CaptureCheck.TOO_BRIGHT to tooBright(observation.light),
            CaptureCheck.TILT to tilt(observation.device, context.mode, tiltOn),
        )
    return CheckReport(
        outcomes = findings.mapValues { it.value.outcome },
        blockingHint = findings.values.firstOrNull { it.blocks }?.hint,
        advisoryHint = findings.values.firstOrNull { !it.blocks && it.hint != null }?.hint,
        itemBox = box,
        isTiltHintOn = tiltOn,
        isPoseFallback = isWorn && observation.pose == null && context.family.wornRequiredParts.isNotEmpty(),
    )
}

/**
 * Checks an imported still once (capture brief §7, Q17): item found, cut off, too small, too dark
 * and too bright; no steadiness, tilt or body check. Returns every failing check's hint as a tip,
 * in priority order; empty when the still passes. An import is never refused.
 */
fun evaluateImportChecks(
    observation: CaptureObservation,
    family: CaptureShapeFamily = CaptureShapeFamily.GENERIC,
): List<CaptureHint> {
    val box = observation.itemBox
    return listOf(
        itemFound(box),
        cutOff(box),
        size(box, family.minAreaShare),
        tooDark(observation.light),
        tooBright(observation.light),
    ).mapNotNull { it.hint }
}

/** A check's outcome, its hint, and whether that hint locks the shutter. */
private data class Finding(
    val outcome: CheckOutcome,
    val hint: CaptureHint? = null,
    val blocks: Boolean = false,
)

private val PASSED = Finding(CheckOutcome.PASSED)
private val SKIPPED = Finding(CheckOutcome.SKIPPED)

private fun blocking(hint: CaptureHint) = Finding(CheckOutcome.FAILED, hint, blocks = true)

private fun advisory(hint: CaptureHint) = Finding(CheckOutcome.FAILED, hint)

/** The far edge of the normalised frame. */
private const val FRAME_EXTENT = 1.0

private fun itemFound(box: NormalizedRect?): Finding = if (box == null) blocking(CaptureHint.NO_ITEM) else PASSED

/**
 * Android cut-off (capture brief §3): any box edge inside the edge band. The band is the outer
 * [CaptureRules.EDGE_BAND_SHARE] of each dimension, so an edge exactly on its inner line is outside
 * it (the same boundary the keypoint rule uses). One edge names it; two or more say "multiple".
 */
private fun cutOff(box: NormalizedRect?): Finding {
    box ?: return SKIPPED
    val band = CaptureRules.EDGE_BAND_SHARE
    val touched =
        listOfNotNull(
            CaptureHint.CUT_OFF_TOP.takeIf { box.top < band },
            CaptureHint.CUT_OFF_BOTTOM.takeIf { box.bottom > FRAME_EXTENT - band },
            CaptureHint.CUT_OFF_LEFT.takeIf { box.left < band },
            CaptureHint.CUT_OFF_RIGHT.takeIf { box.right > FRAME_EXTENT - band },
        )
    return when (touched.size) {
        0 -> PASSED
        1 -> blocking(touched.single())
        else -> blocking(CaptureHint.CUT_OFF_MULTIPLE)
    }
}

/**
 * Worn-mode body check (capture brief §3, Q-A b): every required part of the family is present.
 * No required parts (`generic`): no check. Pose model unavailable: no lock, the family's body hint
 * stays as a tip (doc-10 fallback).
 */
private fun bodyParts(
    pose: PoseSample?,
    family: CaptureShapeFamily,
): Finding {
    val hint = family.wornHint
    if (hint == null || family.wornRequiredParts.isEmpty()) return SKIPPED
    pose ?: return Finding(CheckOutcome.SKIPPED, hint)
    val allPresent = family.wornRequiredParts.all { part -> pose.landmarks[part]?.isPresent() == true }
    return if (allPresent) PASSED else blocking(hint)
}

/** Android keypoint presence: in-frame likelihood and a position inside the frame minus the edge band. */
private fun PoseLandmark.isPresent(): Boolean {
    val inside = CaptureRules.Worn.KEYPOINT_MIN_COORDINATE..CaptureRules.Worn.KEYPOINT_MAX_COORDINATE
    return inFrameLikelihood >= CaptureRules.Android.MIN_KEYPOINT_IN_FRAME_LIKELIHOOD &&
        position.x in inside &&
        position.y in inside
}

private fun minAreaShare(context: CameraContext): Double =
    if (context.mode == CaptureMode.WORN) CaptureRules.Worn.MIN_AREA_SHARE else context.family.minAreaShare

private fun size(
    box: NormalizedRect?,
    minAreaShare: Double,
): Finding {
    box ?: return SKIPPED
    return if (box.areaShare < minAreaShare) blocking(CaptureHint.TOO_SMALL) else PASSED
}

/** Steady = the box held still since the last evaluation, the item is sharp, and the phone is still. */
private fun steady(
    box: NormalizedRect?,
    previousBox: NormalizedRect?,
    observation: CaptureObservation,
): Finding {
    box ?: return SKIPPED
    val isSteady =
        previousBox != null &&
            isBoxStill(box, previousBox) &&
            observation.sharpness >= CaptureRules.Steady.MIN_SHARPNESS &&
            isPhoneStill(observation.device)
    return if (isSteady) PASSED else blocking(CaptureHint.NOT_STEADY)
}

private fun isBoxStill(
    box: NormalizedRect,
    previous: NormalizedRect,
): Boolean {
    if (previous.areaShare <= 0.0) return false
    val areaChange = abs(box.areaShare - previous.areaShare) / previous.areaShare
    return abs(box.centerX - previous.centerX) <= CaptureRules.Steady.MAX_CENTRE_SHIFT &&
        abs(box.centerY - previous.centerY) <= CaptureRules.Steady.MAX_CENTRE_SHIFT &&
        areaChange <= CaptureRules.Steady.MAX_AREA_CHANGE_SHARE
}

/** No sensors (emulator, tablet): the device-motion part does not apply. */
private fun isPhoneStill(device: DeviceSample?): Boolean =
    device == null || device.linearAccelerationMps2 <= CaptureRules.Android.MAX_LINEAR_ACCELERATION_MPS2

private fun tooDark(light: LightSample): Finding =
    if (light.meanLuma < CaptureRules.Light.TOO_DARK_BELOW_MEAN_LUMA) advisory(CaptureHint.TOO_DARK) else PASSED

private fun tooBright(light: LightSample): Finding {
    val isBright =
        light.meanLuma > CaptureRules.Light.TOO_BRIGHT_ABOVE_MEAN_LUMA ||
            light.clippedShare > CaptureRules.Light.TOO_BRIGHT_ABOVE_CLIPPED_SHARE
    return if (isBright) advisory(CaptureHint.TOO_BRIGHT) else PASSED
}

/** Tilt hint with hysteresis: on above the hint angle, off again only below the clear angle. Flat mode, phones only. */
private fun isTiltHintOn(
    device: DeviceSample?,
    mode: CaptureMode,
    wasOn: Boolean,
): Boolean {
    if (mode != CaptureMode.FLAT || device == null) return false
    return if (wasOn) {
        device.tiltDegrees >= CaptureRules.Tilt.CLEAR_BELOW_DEGREES
    } else {
        device.tiltDegrees > CaptureRules.Tilt.HINT_ABOVE_DEGREES
    }
}

private fun tilt(
    device: DeviceSample?,
    mode: CaptureMode,
    isOn: Boolean,
): Finding =
    when {
        mode != CaptureMode.FLAT || device == null -> SKIPPED
        isOn -> advisory(CaptureHint.TILT)
        else -> PASSED
    }
