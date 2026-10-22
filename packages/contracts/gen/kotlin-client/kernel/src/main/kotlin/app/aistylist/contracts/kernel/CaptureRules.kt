// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.
// Source: packages/shared-kernel/registry/capture-rules.json
package app.aistylist.contracts.kernel

/** How the item is photographed (capture brief §2). */
enum class CaptureMode(val value: String) {
    FLAT("flat"),
    HANGER("hanger"),
    WORN("worn");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): CaptureMode? = entries.firstOrNull { it.value == value }
    }
}

/** Blocking check that keeps the shutter locked, highest priority first (capture brief §4). */
enum class CaptureLockReason(val value: String) {
    NO_ITEM("no-item"),
    CUT_OFF("cut-off"),
    BODY_PARTS_MISSING("body-parts-missing"),
    COVERED("covered"),
    TOO_SMALL("too-small"),
    NOT_STEADY("not-steady");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): CaptureLockReason? = entries.firstOrNull { it.value == value }
    }
}

/** Body keypoint read by the worn-mode body check (capture brief §3). */
enum class CaptureBodyPart(val value: String) {
    LEFT_SHOULDER("leftShoulder"),
    RIGHT_SHOULDER("rightShoulder"),
    LEFT_HIP("leftHip"),
    RIGHT_HIP("rightHip"),
    LEFT_KNEE("leftKnee"),
    RIGHT_KNEE("rightKnee"),
    LEFT_ANKLE("leftAnkle"),
    RIGHT_ANKLE("rightAnkle");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): CaptureBodyPart? = entries.firstOrNull { it.value == value }
    }
}

/** Hint class: blocking (shutter locked), advisory (never locks) or status. */
enum class CaptureHintKind(val value: String) {
    BLOCKING("blocking"),
    ADVISORY("advisory"),
    STATUS("status");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): CaptureHintKind? = entries.firstOrNull { it.value == value }
    }
}

/** Hint key, also the hint label test ID, in priority order (capture brief §6). */
enum class CaptureHint(val value: String, val kind: CaptureHintKind, val lockReason: CaptureLockReason?) {
    WARMING_UP("cap-hint-warming-up", CaptureHintKind.BLOCKING, null),
    NO_ITEM("cap-hint-no-item", CaptureHintKind.BLOCKING, CaptureLockReason.NO_ITEM),
    CUT_OFF_MULTIPLE("cap-hint-cut-off-multiple", CaptureHintKind.BLOCKING, CaptureLockReason.CUT_OFF),
    CUT_OFF_TOP("cap-hint-cut-off-top", CaptureHintKind.BLOCKING, CaptureLockReason.CUT_OFF),
    CUT_OFF_BOTTOM("cap-hint-cut-off-bottom", CaptureHintKind.BLOCKING, CaptureLockReason.CUT_OFF),
    CUT_OFF_LEFT("cap-hint-cut-off-left", CaptureHintKind.BLOCKING, CaptureLockReason.CUT_OFF),
    CUT_OFF_RIGHT("cap-hint-cut-off-right", CaptureHintKind.BLOCKING, CaptureLockReason.CUT_OFF),
    BODY_SHOULDERS_HIPS("cap-hint-body-shoulders-hips", CaptureHintKind.BLOCKING, CaptureLockReason.BODY_PARTS_MISSING),
    BODY_HIPS_ANKLES("cap-hint-body-hips-ankles", CaptureHintKind.BLOCKING, CaptureLockReason.BODY_PARTS_MISSING),
    BODY_HIPS_KNEES("cap-hint-body-hips-knees", CaptureHintKind.BLOCKING, CaptureLockReason.BODY_PARTS_MISSING),
    BODY_SHOULDERS_KNEES("cap-hint-body-shoulders-knees", CaptureHintKind.BLOCKING, CaptureLockReason.BODY_PARTS_MISSING),
    COVERED("cap-hint-covered", CaptureHintKind.BLOCKING, CaptureLockReason.COVERED),
    TOO_SMALL("cap-hint-too-small", CaptureHintKind.BLOCKING, CaptureLockReason.TOO_SMALL),
    NOT_STEADY("cap-hint-not-steady", CaptureHintKind.BLOCKING, CaptureLockReason.NOT_STEADY),
    TOO_DARK("cap-hint-too-dark", CaptureHintKind.ADVISORY, null),
    TOO_BRIGHT("cap-hint-too-bright", CaptureHintKind.ADVISORY, null),
    TILT("cap-hint-tilt", CaptureHintKind.ADVISORY, null),
    GUIDE("cap-hint-guide", CaptureHintKind.STATUS, null),
    READY("cap-hint-ready", CaptureHintKind.STATUS, null),
    CAPTURING("cap-hint-capturing", CaptureHintKind.STATUS, null),
    NEXT_ITEM("cap-hint-next-item", CaptureHintKind.STATUS, null);

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): CaptureHint? = entries.firstOrNull { it.value == value }
    }
}

/** Shape family picked before capture (capture brief §2); not a closet taxonomy id. */
enum class CaptureShapeFamily(val value: String, val minAreaShare: Double, val modes: List<CaptureMode>, val wornRequiredParts: List<CaptureBodyPart>, val wornHint: CaptureHint?) {
    TOP("top", 0.2, listOf(CaptureMode.FLAT, CaptureMode.HANGER, CaptureMode.WORN), listOf(CaptureBodyPart.LEFT_SHOULDER, CaptureBodyPart.RIGHT_SHOULDER, CaptureBodyPart.LEFT_HIP, CaptureBodyPart.RIGHT_HIP), CaptureHint.BODY_SHOULDERS_HIPS),
    LONG_BOTTOM("long-bottom", 0.15, listOf(CaptureMode.FLAT, CaptureMode.HANGER, CaptureMode.WORN), listOf(CaptureBodyPart.LEFT_HIP, CaptureBodyPart.RIGHT_HIP, CaptureBodyPart.LEFT_ANKLE, CaptureBodyPart.RIGHT_ANKLE), CaptureHint.BODY_HIPS_ANKLES),
    SHORT_BOTTOM("short-bottom", 0.12, listOf(CaptureMode.FLAT, CaptureMode.HANGER, CaptureMode.WORN), listOf(CaptureBodyPart.LEFT_HIP, CaptureBodyPart.RIGHT_HIP, CaptureBodyPart.LEFT_KNEE, CaptureBodyPart.RIGHT_KNEE), CaptureHint.BODY_HIPS_KNEES),
    ONE_PIECE("one-piece", 0.18, listOf(CaptureMode.FLAT, CaptureMode.HANGER, CaptureMode.WORN), listOf(CaptureBodyPart.LEFT_SHOULDER, CaptureBodyPart.RIGHT_SHOULDER, CaptureBodyPart.LEFT_KNEE, CaptureBodyPart.RIGHT_KNEE), CaptureHint.BODY_SHOULDERS_KNEES),
    OUTERWEAR("outerwear", 0.2, listOf(CaptureMode.FLAT, CaptureMode.HANGER, CaptureMode.WORN), listOf(CaptureBodyPart.LEFT_SHOULDER, CaptureBodyPart.RIGHT_SHOULDER, CaptureBodyPart.LEFT_HIP, CaptureBodyPart.RIGHT_HIP), CaptureHint.BODY_SHOULDERS_HIPS),
    SHOES("shoes", 0.06, listOf(CaptureMode.FLAT), listOf(), null),
    BAG("bag", 0.08, listOf(CaptureMode.FLAT, CaptureMode.HANGER), listOf(), null),
    SMALL_ITEM("small-item", 0.015, listOf(CaptureMode.FLAT), listOf(), null),
    GENERIC("generic", 0.08, listOf(CaptureMode.FLAT, CaptureMode.HANGER, CaptureMode.WORN), listOf(), null);

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): CaptureShapeFamily? = entries.firstOrNull { it.value == value }
    }
}

/** Live-check thresholds, counts and timings (capture brief §3-§5). MS = milliseconds. */
object CaptureRules {
    const val EDGE_BAND_SHARE: Double = 0.02

    object Evaluation {
        const val INTERVAL_MS: Int = 100
    }

    object AnalysisFrame {
        const val WIDTH_PX: Int = 640
        const val HEIGHT_PX: Int = 480
    }

    object Steady {
        const val MAX_CENTRE_SHIFT: Double = 0.02
        const val MAX_AREA_CHANGE_SHARE: Double = 0.08
        const val MIN_SHARPNESS: Double = 12.0
        const val SHARPNESS_LONG_SIDE_PX: Int = 320
        const val LAPLACIAN_KERNEL_PX: Int = 3
    }

    object Light {
        const val TOO_DARK_BELOW_MEAN_LUMA: Double = 45.0
        const val TOO_BRIGHT_ABOVE_MEAN_LUMA: Double = 215.0
        const val CLIPPED_MIN_LUMA: Double = 250.0
        const val TOO_BRIGHT_ABOVE_CLIPPED_SHARE: Double = 0.25
    }

    object Tilt {
        const val HINT_ABOVE_DEGREES: Double = 20.0
        const val CLEAR_BELOW_DEGREES: Double = 15.0
    }

    object Covered {
        const val ABOVE_OVERLAP_SHARE: Double = 0.5
        const val MIN_OTHER_BOX_AREA_SHARE: Double = 0.005
    }

    object Lock {
        const val UNLOCK_AFTER_PASSING_EVALUATIONS: Int = 3
        const val RELOCK_AFTER_FAILING_EVALUATIONS: Int = 3
        const val RING_FILL_MS: Int = 500
        const val RING_MIN_EVALUATIONS: Int = 3
    }

    object Batch {
        const val COOLDOWN_EXIT_EVALUATIONS: Int = 3
        const val NEW_ITEM_BELOW_IOU: Double = 0.5
    }

    object Timing {
        const val ANYWAY_DELAY_MS: Int = 10000
        const val GUIDE_HINT_MS: Int = 1500
        const val HINT_HOLD_EVALUATIONS: Int = 2
        const val HINT_MIN_VISIBLE_MS: Int = 1000
        const val SPEECH_MIN_GAP_MS: Int = 1500
        const val SPEECH_REPEAT_WINDOW_MS: Int = 5000
    }

    object Worn {
        const val MIN_AREA_SHARE: Double = 0.25
        const val KEYPOINT_MIN_COORDINATE: Double = 0.02
        const val KEYPOINT_MAX_COORDINATE: Double = 0.98
    }

    object Ios {
        const val MASK_INTERVAL_MS: Int = 250
        const val POSE_INTERVAL_MS: Int = 250
        const val MIN_INSTANCE_AREA_SHARE: Double = 0.005
        const val CUT_OFF_ABOVE_EDGE_CONTACT_SHARE: Double = 0.04
        const val HANGER_TOP_CUT_OFF_ABOVE_EDGE_CONTACT_SHARE: Double = 0.1
        const val MAX_USER_ACCELERATION_G: Double = 0.08
        const val MAX_ROTATION_RATE_RAD_PER_S: Double = 0.5
        const val MIN_KEYPOINT_CONFIDENCE: Double = 0.3
    }

    object Android {
        const val MAX_LINEAR_ACCELERATION_MPS2: Double = 0.8
        const val GRAVITY_LOW_PASS_ALPHA: Double = 0.8
        const val MIN_KEYPOINT_IN_FRAME_LIKELIHOOD: Double = 0.5
    }
}
