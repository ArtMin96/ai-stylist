package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureRules

/** What took the photo (capture brief §4). */
enum class CaptureTrigger { AUTO, MANUAL, HARDWARE, ANYWAY }

/** Vibration kinds: the unlock and the capture (capture brief §6). */
enum class HapticKind { UNLOCK, CAPTURE }

/** One-shot outputs of a camera step. */
sealed interface CaptureEffect {
    /** Take the photo now. The adapter answers with `captureFinished` or `captureFailed`. */
    data class RequestCapture(
        val trigger: CaptureTrigger,
    ) : CaptureEffect

    data class Haptic(
        val kind: HapticKind,
    ) : CaptureEffect

    /** Speak [hint]'s spoken text (capture brief §6); already gated by the speech rules (§5, Q-B). */
    data class Speak(
        val hint: CaptureHint,
    ) : CaptureEffect
}

/** The shutter lock state machine of capture brief §4. Immutable; each input returns the next state. */
sealed interface LockState {
    /** Not started, or in the background. */
    data object Idle : LockState

    /** Camera ready, no evaluation yet. Locked. */
    data object WarmingUp : LockState

    /**
     * Locked. [hint] is the last failing blocking check's hint (null before the first failure);
     * [passStreak] counts consecutive passing evaluations towards the unlock, each of a distinct mask:
     * [lastPassingMaskMs] is the mask of the last one counted (null without mask times).
     */
    data class Locked(
        val hint: CaptureHint?,
        val passStreak: Int = 0,
        val lastPassingMaskMs: Long? = null,
    ) : LockState

    /**
     * Manual shutter on; the ring fills with the time between consecutive evaluations that end in a
     * pass, counted from the unlock. A failing evaluation adds nothing (pause, no reset).
     */
    data class Unlocked(
        val lastEvaluationAtMs: Long,
        val ringFilledMs: Long = 0,
        val passingEvaluations: Int = 0,
        val failStreak: Int = 0,
    ) : LockState {
        val ringProgress: Double get() = (ringFilledMs.toDouble() / CaptureRules.Lock.RING_FILL_MS).coerceAtMost(1.0)

        val isRingFull: Boolean
            get() =
                ringFilledMs >= CaptureRules.Lock.RING_FILL_MS &&
                    passingEvaluations >= CaptureRules.Lock.RING_MIN_EVALUATIONS
    }

    /** Photo requested; every input but its result is ignored. [capturedBox] seeds the batch cooldown. */
    data class Capturing(
        val trigger: CaptureTrigger,
        val capturedBox: NormalizedRect?,
    ) : LockState

    /** Batch only, after a capture: locked until the next item appears or the user taps "Next item". */
    data class Cooldown(
        val capturedBox: NormalizedRect?,
        val noItemStreak: Int = 0,
        val newItemStreak: Int = 0,
    ) : LockState
}

/** A next state and the effects the transition produced. */
data class LockStep(
    val state: LockState,
    val effects: List<CaptureEffect> = emptyList(),
)

/** The states in which "Take photo anyway" (and a shutter tap standing in for it) can capture. */
internal val LockState.acceptsAnyway: Boolean
    get() = this is LockState.WarmingUp || this is LockState.Locked || this is LockState.Unlocked

/**
 * Applies one evaluated frame taken at [nowMs]. [maskTimestampMs] is the time of the mask the report
 * read (null: a fresh detector result on every evaluation, the box path).
 */
fun LockState.onEvaluation(
    report: CheckReport,
    nowMs: Long,
    maskTimestampMs: Long? = null,
): LockStep =
    when (this) {
        LockState.Idle, is LockState.Capturing -> LockStep(this)

        // The first evaluation leaves warming-up: locked, or already counting when it passes.
        LockState.WarmingUp -> LockState.Locked(hint = null).afterEvaluation(report, nowMs, maskTimestampMs)

        is LockState.Locked -> afterEvaluation(report, nowMs, maskTimestampMs)

        is LockState.Unlocked -> afterEvaluation(report, nowMs)

        is LockState.Cooldown -> LockStep(afterEvaluation(report))
    }

/**
 * The on-screen shutter ([CaptureTrigger.MANUAL]) or a volume key ([CaptureTrigger.HARDWARE]).
 * Captures when unlocked; while locked it is ignored unless "Take photo anyway" is visible, then
 * it acts as that button.
 */
fun LockState.onShutter(
    trigger: CaptureTrigger,
    isAnywayVisible: Boolean,
    itemBox: NormalizedRect?,
): LockStep =
    when {
        this is LockState.Unlocked -> startCapture(trigger, itemBox)
        acceptsAnyway && isAnywayVisible -> startCapture(CaptureTrigger.ANYWAY, itemBox)
        else -> LockStep(this)
    }

/** "Take photo anyway": captures whenever the button is visible and the camera is not busy. */
fun LockState.onAnyway(
    isAnywayVisible: Boolean,
    itemBox: NormalizedRect?,
): LockStep = if (acceptsAnyway && isAnywayVisible) startCapture(CaptureTrigger.ANYWAY, itemBox) else LockStep(this)

/** The photo was taken: single capture leaves the camera; batch cools down on the captured box. */
fun LockState.onCaptureFinished(kind: CaptureFlowKind): LockState {
    val capturing = this as? LockState.Capturing ?: return this
    return if (kind == CaptureFlowKind.BATCH) LockState.Cooldown(capturing.capturedBox) else LockState.Idle
}

/** The camera could not take the photo: back to locked on [lastHint] (the last blocking hint), counters reset. */
fun LockState.onCaptureFailed(lastHint: CaptureHint?): LockState =
    if (this is LockState.Capturing) LockState.Locked(lastHint) else this

/** A mode switch resets the counters to locked (capture brief §4). */
fun LockState.onModeChanged(): LockState =
    when (this) {
        is LockState.Locked, is LockState.Unlocked, is LockState.Cooldown -> LockState.Locked(hint = null)
        else -> this
    }

/** "Next item" (batch) ends the cooldown at once. */
fun LockState.onNextItem(): LockState = if (this is LockState.Cooldown) LockState.Locked(hint = null) else this

/**
 * No detector result for `evaluation.staleFeedAfterMs` (an interruption, a stalled detector): back to
 * warming up with every counter reset, so a frozen preview never keeps the shutter unlocked or
 * counting. Capturing, cooldown and idle are unaffected. Mirrors iOS `ShutterLock.feedStalled`.
 */
fun LockState.onFeedStalled(): LockState =
    if (this is LockState.Locked || this is LockState.Unlocked) LockState.WarmingUp else this

private fun startCapture(
    trigger: CaptureTrigger,
    itemBox: NormalizedRect?,
): LockStep =
    LockStep(
        LockState.Capturing(trigger, itemBox),
        listOf(CaptureEffect.Haptic(HapticKind.CAPTURE), CaptureEffect.RequestCapture(trigger)),
    )

private fun LockState.Locked.afterEvaluation(
    report: CheckReport,
    nowMs: Long,
    maskTimestampMs: Long?,
): LockStep {
    if (!report.passes) return LockStep(LockState.Locked(report.blockingHint))
    // A pass that reads the same mask as the last counted one adds no evidence (a mask every 250 ms,
    // evaluations every 100 ms): the streak holds, so an unlock needs that many distinct masks, never
    // one chance-still mask read three times (the iOS ShutterLock rule).
    if (maskTimestampMs != null && maskTimestampMs == lastPassingMaskMs) return LockStep(this)
    val streak = passStreak + 1
    return if (streak >= CaptureRules.Lock.UNLOCK_AFTER_PASSING_EVALUATIONS) {
        LockStep(LockState.Unlocked(lastEvaluationAtMs = nowMs), listOf(CaptureEffect.Haptic(HapticKind.UNLOCK)))
    } else {
        LockStep(copy(passStreak = streak, lastPassingMaskMs = maskTimestampMs))
    }
}

private fun LockState.Unlocked.afterEvaluation(
    report: CheckReport,
    nowMs: Long,
): LockStep {
    if (!report.passes) {
        val fails = failStreak + 1
        // Relocking resets the ring and has no haptic.
        return if (fails >= CaptureRules.Lock.RELOCK_AFTER_FAILING_EVALUATIONS) {
            LockStep(LockState.Locked(report.blockingHint))
        } else {
            LockStep(copy(failStreak = fails, lastEvaluationAtMs = nowMs))
        }
    }
    val next =
        copy(
            ringFilledMs = ringFilledMs + (nowMs - lastEvaluationAtMs),
            passingEvaluations = passingEvaluations + 1,
            failStreak = 0,
            lastEvaluationAtMs = nowMs,
        )
    return if (next.isRingFull) startCapture(CaptureTrigger.AUTO, report.itemBox) else LockStep(next)
}

/**
 * Leaves the cooldown after consecutive no-item evaluations, or consecutive evaluations whose box
 * overlaps the captured box below the new-item IoU. The two streaks count separately.
 */
private fun LockState.Cooldown.afterEvaluation(report: CheckReport): LockState {
    val box = report.itemBox
    val noItem = if (box == null) noItemStreak + 1 else 0
    val isNewItem =
        box != null &&
            (capturedBox == null || box.intersectionOverUnion(capturedBox) < CaptureRules.Batch.NEW_ITEM_BELOW_IOU)
    val newItem = if (isNewItem) newItemStreak + 1 else 0
    val exits =
        noItem >= CaptureRules.Batch.COOLDOWN_EXIT_EVALUATIONS ||
            newItem >= CaptureRules.Batch.COOLDOWN_EXIT_EVALUATIONS
    return if (exits) LockState.Locked(report.blockingHint) else LockState.Cooldown(capturedBox, noItem, newItem)
}
