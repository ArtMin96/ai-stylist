package app.aistylist.feature.capture.analysis

import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.domain.CaptureObservation
import app.aistylist.feature.capture.domain.DeviceSample
import app.aistylist.feature.capture.domain.MaskObservation
import app.aistylist.feature.capture.domain.NormalizedRect
import app.aistylist.feature.capture.domain.PoseSample

/**
 * One observation from a measured frame: [plane] in its source orientation (turned clockwise by
 * [rotationDegrees] to be upright), the detector's [boxes] already upright and normalised, or the
 * segmenter's [mask] (newest, possibly from an earlier frame). Light is measured on the whole frame,
 * sharpness inside the judged item's box on this frame (capture brief §3).
 */
fun measureObservation(
    timestampMs: Long,
    plane: LumaPlane,
    rotationDegrees: Int,
    boxes: List<NormalizedRect>,
    device: DeviceSample? = null,
    pose: PoseSample? = null,
    mask: MaskObservation? = null,
): CaptureObservation {
    val item = if (mask != null) mask.foundItem?.box else boxes.maxByOrNull { it.areaShare }
    val sharpness =
        item?.let {
            plane.scaledToLongSide(CaptureRules.Steady.SHARPNESS_LONG_SIDE_PX).rotated(rotationDegrees).sharpness(it)
        } ?: 0.0
    return CaptureObservation(
        timestampMs = timestampMs,
        itemBoxes = boxes,
        sharpness = sharpness,
        light = plane.light(),
        device = device,
        pose = pose,
        mask = mask,
    )
}
