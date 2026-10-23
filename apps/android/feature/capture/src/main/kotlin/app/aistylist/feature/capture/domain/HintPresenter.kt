package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureHintKind
import app.aistylist.contracts.kernel.CaptureRules

/**
 * Which hint the label shows (capture brief §5). The family guide shows first; during the guide
 * time no check hint is proposed, unless the shutter unlocks earlier. Status hints (ready,
 * capturing, next item) and "Looking for the item…" replace the shown hint at once. A check hint
 * replaces it only when it held for the hold count of consecutive evaluations and the shown one
 * has been visible for the minimum time.
 */
data class HintPresenter(
    val shown: CaptureHint? = null,
    val shownAtMs: Long = 0,
    val pending: CaptureHint? = null,
    val pendingEvaluations: Int = 0,
    val guideUntilMs: Long? = null,
) {
    /** One evaluation proposed [candidate] (null: no new hint, keep the shown one). */
    fun onEvaluation(
        candidate: CaptureHint?,
        isUnlocked: Boolean,
        nowMs: Long,
    ): HintPresenter {
        val guideUntil = if (isUnlocked) null else guideUntilMs
        if (candidate == null || candidate == shown) {
            return copy(pending = null, pendingEvaluations = 0, guideUntilMs = guideUntil)
        }
        if (candidate.replacesAtOnce) return showNow(candidate, nowMs)
        if (guideUntil != null && nowMs < guideUntil) return copy(pending = null, pendingEvaluations = 0)
        val held = if (candidate == pending) pendingEvaluations + 1 else 1
        val canReplace =
            held >= CaptureRules.Timing.HINT_HOLD_EVALUATIONS &&
                nowMs - shownAtMs >= CaptureRules.Timing.HINT_MIN_VISIBLE_MS
        return if (canReplace) {
            showNow(candidate, nowMs)
        } else {
            copy(pending = candidate, pendingEvaluations = held, guideUntilMs = guideUntil)
        }
    }

    /** Time passed with no evaluation: once the guide time is over, "Looking for the item…" until one. */
    fun onTick(
        nowMs: Long,
        hasEvaluated: Boolean,
    ): HintPresenter {
        val guideUntil = guideUntilMs ?: return this
        val isGuideOver = shown == CaptureHint.GUIDE && nowMs >= guideUntil
        return if (isGuideOver && !hasEvaluated) showNow(CaptureHint.WARMING_UP, nowMs) else this
    }

    fun showNow(
        hint: CaptureHint,
        nowMs: Long,
    ): HintPresenter = if (hint == shown) this else HintPresenter(shown = hint, shownAtMs = nowMs)

    companion object {
        /** Camera ready (or back from the background): the family guide, protected for the guide time. */
        fun start(nowMs: Long): HintPresenter =
            HintPresenter(
                shown = CaptureHint.GUIDE,
                shownAtMs = nowMs,
                guideUntilMs = nowMs + CaptureRules.Timing.GUIDE_HINT_MS,
            )
    }
}

private val CaptureHint.replacesAtOnce: Boolean
    get() = kind == CaptureHintKind.STATUS || this == CaptureHint.WARMING_UP

/** What the no-repeat window compares: the hint, plus the camera step for the guide (its text follows the step). */
data class SpeechKey(
    val hint: CaptureHint,
    val guide: CameraContext? = null,
)

/**
 * Speech rules (capture brief §5). A hint shown inside the minimum gap waits, and the latest one
 * wins; the same key is not spoken again within the repeat window (dropped, not delayed).
 * "Looking for the item…" is never spoken (§6). Whether speech is on at all (screen reader or the
 * speaker toggle, Q-B) is the session's call.
 */
data class SpeechGate(
    val lastSpokenAtMs: Long? = null,
    val lastSpokenAtByKey: Map<SpeechKey, Long> = emptyMap(),
    val pending: SpeechKey? = null,
) {
    /** The label changed to [key]: it replaces any utterance still waiting. */
    fun onHintShown(key: SpeechKey): SpeechGate = copy(pending = key.takeUnless { it.hint == CaptureHint.WARMING_UP })

    /** Speaks the waiting utterance once the gap is over; returns what to say, if anything. */
    fun release(nowMs: Long): SpeechRelease {
        val key = pending ?: return SpeechRelease(this, spoken = null)
        val isGapOver = lastSpokenAtMs?.let { nowMs - it >= CaptureRules.Timing.SPEECH_MIN_GAP_MS } ?: true
        if (!isGapOver) return SpeechRelease(this, spoken = null)
        val isRepeat =
            lastSpokenAtByKey[key]?.let { nowMs - it < CaptureRules.Timing.SPEECH_REPEAT_WINDOW_MS } ?: false
        if (isRepeat) return SpeechRelease(copy(pending = null), spoken = null)
        val gate = SpeechGate(lastSpokenAtMs = nowMs, lastSpokenAtByKey = lastSpokenAtByKey + (key to nowMs))
        return SpeechRelease(gate, spoken = key)
    }

    /** Speech is off: nothing waits. */
    fun cleared(): SpeechGate = copy(pending = null)
}

data class SpeechRelease(
    val gate: SpeechGate,
    val spoken: SpeechKey?,
)
