package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureLockReason
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules

/**
 * "Take photo anyway" (capture brief §5): shows after the anyway delay of foreground time since
 * [startedAtMs], or at once when forced (screen reader, pose-model fallback). Once shown it stays
 * until [restart]. A null [startedAtMs] means stopped (idle or background).
 */
data class AnywayTimer(
    val startedAtMs: Long? = null,
    val isShown: Boolean = false,
) {
    /** Starts counting again from [nowMs], hidden: camera ready, back step, batch capture, foreground. */
    fun restart(nowMs: Long): AnywayTimer = AnywayTimer(startedAtMs = nowMs)

    /** Shows the button when its time has come or [isForced]; never hides it. */
    fun update(
        nowMs: Long,
        isForced: Boolean,
    ): AnywayTimer {
        val start = startedAtMs ?: return this
        if (isShown) return this
        val isDue = isForced || nowMs - start >= CaptureRules.Timing.ANYWAY_DELAY_MS
        return if (isDue) copy(isShown = true) else this
    }
}

/** The line above "Take photo anyway" (`cap-anyway-reason`, capture brief §6). */
sealed interface AnywayReason {
    /** "No item found. A plain surface in a different colour helps." (C8, C9). */
    data object NoItemSurfaceTip : AnywayReason

    /** "Too big to fit? Try hanger mode." (C11). */
    data object TryHangerMode : AnywayReason

    /** The blocking hint's own text. */
    data class Hint(
        val hint: CaptureHint,
    ) : AnywayReason
}

/**
 * The reason line for the current lock [hint] of a [context] step; null when nothing blocks (also
 * while unlocked). "Try hanger mode" only where the family offers hanger mode.
 */
fun anywayReasonFor(
    hint: CaptureHint?,
    context: CameraContext,
): AnywayReason? {
    val canTryHanger = context.mode == CaptureMode.FLAT && CaptureMode.HANGER in context.family.modes
    return when {
        hint == null -> null
        hint.lockReason == CaptureLockReason.NO_ITEM -> AnywayReason.NoItemSurfaceTip
        hint.lockReason == CaptureLockReason.CUT_OFF && canTryHanger -> AnywayReason.TryHangerMode
        else -> AnywayReason.Hint(hint)
    }
}
