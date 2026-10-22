package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureBodyPart
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.contracts.kernel.CaptureShapeFamily
import kotlin.math.sqrt

// Synthetic frames only: boxes, light and keypoints are made-up numbers, never from a real photo.

/** How far "just below" and "just above" a share or coordinate threshold sit. */
internal const val SHARE_STEP = 0.001

/** How far "just below" and "just above" a luma, sharpness, motion or angle threshold sit. */
internal const val VALUE_STEP = 0.1

/** The evaluation interval as a Long, for clock arithmetic. */
internal val EVALUATION_MS: Long = CaptureRules.Evaluation.INTERVAL_MS.toLong()

/** Centred, clear of every edge band, larger than every family's (and worn mode's) minimum. */
internal val GOOD_BOX = NormalizedRect(left = 0.2, top = 0.2, right = 0.8, bottom = 0.8)

internal val GOOD_LIGHT = LightSample(meanLuma = 128.0, clippedShare = 0.0)

internal val STILL_PHONE = DeviceSample(linearAccelerationMps2 = 0.1, tiltDegrees = 5.0)

internal const val SHARP = 40.0

internal val TOP_FLAT = CameraContext(CaptureShapeFamily.TOP, CaptureMode.FLAT)

internal val TOP_WORN = CameraContext(CaptureShapeFamily.TOP, CaptureMode.WORN)

/** A square box of [areaShare] centred on ([centerX], [centerY]). */
internal fun squareBox(
    areaShare: Double,
    centerX: Double = 0.5,
    centerY: Double = 0.5,
): NormalizedRect {
    val half = sqrt(areaShare) / 2
    return NormalizedRect(centerX - half, centerY - half, centerX + half, centerY + half)
}

internal fun frame(
    timestampMs: Long = 0,
    box: NormalizedRect? = GOOD_BOX,
    sharpness: Double = SHARP,
    light: LightSample = GOOD_LIGHT,
    device: DeviceSample? = null,
    pose: PoseSample? = null,
): CaptureObservation = CaptureObservation(timestampMs, listOfNotNull(box), sharpness, light, device, pose)

/** Every keypoint well inside the frame, clearly visible. */
internal fun fullBody(): PoseSample =
    PoseSample(
        CaptureBodyPart.entries.associateWith { part ->
            PoseLandmark(NormalizedPoint(x = if (part.value.startsWith("left")) 0.4 else 0.6, y = 0.5), 0.9)
        },
    )

internal fun PoseSample.withPart(
    part: CaptureBodyPart,
    landmark: PoseLandmark?,
): PoseSample = PoseSample(if (landmark == null) landmarks - part else landmarks + (part to landmark))

/** A report as the rules would produce it: passing, or failing with [blockingHint]. */
internal fun report(
    blockingHint: CaptureHint? = null,
    box: NormalizedRect? = GOOD_BOX,
): CheckReport =
    CheckReport(
        outcomes = emptyMap(),
        blockingHint = blockingHint,
        advisoryHint = null,
        itemBox = box,
        isTiltHintOn = false,
        isPoseFallback = false,
    )

internal fun noItemReport(): CheckReport = report(CaptureHint.NO_ITEM, box = null)

/** A clock the test moves by hand. */
internal class FakeClock(
    var now: Long = 0,
) : CaptureClock {
    override fun nowMs(): Long = now

    fun advance(ms: Long) {
        now += ms
    }
}

/** A mask-path frame: the segmenter's item [box] (null: empty mask) from the mask analysed at [maskAtMs]. */
internal fun maskFrame(
    timestampMs: Long,
    maskAtMs: Long = timestampMs,
    box: NormalizedRect? = GOOD_BOX,
    edgeContact: EdgeContact = EdgeContact(),
    maskAreaShare: Double = box?.areaShare ?: 0.0,
    otherBoxes: List<NormalizedRect> = emptyList(),
    device: DeviceSample? = null,
): CaptureObservation =
    CaptureObservation(
        timestampMs = timestampMs,
        itemBoxes = emptyList(),
        sharpness = SHARP,
        light = GOOD_LIGHT,
        device = device,
        mask =
            MaskObservation(
                timestampMs = maskAtMs,
                item = box?.let { MaskMeasure(it, maskAreaShare, edgeContact) },
                instanceCount = if (box == null) 0 else 1 + otherBoxes.size,
                otherBoxes = otherBoxes,
                outlineCandidates = emptyList(),
            ),
    )
