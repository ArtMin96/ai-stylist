package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HintPresenterTest {
    private val guideMs = CaptureRules.Timing.GUIDE_HINT_MS.toLong()
    private val minVisibleMs = CaptureRules.Timing.HINT_MIN_VISIBLE_MS.toLong()
    private val hold = CaptureRules.Timing.HINT_HOLD_EVALUATIONS
    private val gapMs = CaptureRules.Timing.SPEECH_MIN_GAP_MS.toLong()
    private val repeatMs = CaptureRules.Timing.SPEECH_REPEAT_WINDOW_MS.toLong()

    /** Proposes [hint] on [count] evaluations, the last one at [lastAtMs]. */
    private fun HintPresenter.propose(
        hint: CaptureHint?,
        count: Int,
        lastAtMs: Long,
        isUnlocked: Boolean = false,
    ): HintPresenter {
        var presenter = this
        repeat(count) { index ->
            presenter = presenter.onEvaluation(hint, isUnlocked, lastAtMs - (count - 1 - index) * EVALUATION_MS)
        }
        return presenter
    }

    @Test
    fun `camera ready shows the family guide`() {
        assertEquals(CaptureHint.GUIDE, HintPresenter.start(nowMs = 0).shown)
    }

    @Test
    fun `the guide holds for the guide time even when a hint held long enough`() {
        val presenter = HintPresenter.start(0).propose(CaptureHint.NO_ITEM, count = 5, lastAtMs = guideMs - 1)

        assertEquals(CaptureHint.GUIDE, presenter.shown)
    }

    @Test
    fun `no hint is proposed during the guide time, so the hold count starts after it`() {
        val start = HintPresenter.start(0)
        // Proposals inside the guide time do not count towards the hold.
        val countedInside = start.propose(CaptureHint.NO_ITEM, count = hold, lastAtMs = guideMs)
        val heldAfter =
            start.propose(
                CaptureHint.NO_ITEM,
                count = hold,
                lastAtMs = guideMs + (hold - 1) * EVALUATION_MS,
            )

        assertEquals(CaptureHint.GUIDE, countedInside.shown)
        assertEquals(CaptureHint.NO_ITEM, heldAfter.shown)
    }

    @Test
    fun `status hints replace at once, even during the guide time`() {
        listOf(CaptureHint.READY, CaptureHint.CAPTURING, CaptureHint.NEXT_ITEM).forEach { status ->
            val presenter = HintPresenter.start(0).onEvaluation(status, isUnlocked = false, nowMs = EVALUATION_MS)

            assertEquals(status, presenter.shown)
        }
    }

    @Test
    fun `a hint seen on one evaluation fewer than the hold count does not replace`() {
        val shown = HintPresenter().showNow(CaptureHint.NO_ITEM, nowMs = 0)

        val presenter = shown.propose(CaptureHint.TOO_SMALL, count = hold - 1, lastAtMs = 10 * minVisibleMs)

        assertEquals(CaptureHint.NO_ITEM, presenter.shown)
    }

    @Test
    fun `an interrupted hint starts counting again`() {
        val shown = HintPresenter().showNow(CaptureHint.NO_ITEM, nowMs = 0)

        val presenter =
            shown
                .onEvaluation(CaptureHint.TOO_SMALL, isUnlocked = false, nowMs = 5_000)
                .onEvaluation(CaptureHint.NOT_STEADY, isUnlocked = false, nowMs = 5_100)
                .onEvaluation(CaptureHint.TOO_SMALL, isUnlocked = false, nowMs = 5_200)

        assertEquals(CaptureHint.NO_ITEM, presenter.shown)
    }

    @Test
    fun `the shown hint must stay the minimum time before a held hint replaces it`() {
        val shown = HintPresenter().showNow(CaptureHint.NO_ITEM, nowMs = 0)

        val tooSoon = shown.propose(CaptureHint.TOO_SMALL, count = hold, lastAtMs = minVisibleMs - 1)
        val inTime = shown.propose(CaptureHint.TOO_SMALL, count = hold, lastAtMs = minVisibleMs)

        assertEquals(CaptureHint.NO_ITEM, tooSoon.shown)
        assertEquals(CaptureHint.TOO_SMALL, inTime.shown)
    }

    @Test
    fun `unlocking ends the guide time early`() {
        val start = HintPresenter.start(nowMs = 0)

        val presenter = start.propose(CaptureHint.TOO_DARK, count = hold, lastAtMs = minVisibleMs, isUnlocked = true)

        assertTrue(minVisibleMs < guideMs)
        assertEquals(CaptureHint.TOO_DARK, presenter.shown)
    }

    @Test
    fun `with no evaluation after the guide time it shows warming up`() {
        val start = HintPresenter.start(0)

        assertEquals(CaptureHint.GUIDE, start.onTick(guideMs - 1, hasEvaluated = false).shown)
        assertEquals(CaptureHint.WARMING_UP, start.onTick(guideMs, hasEvaluated = false).shown)
        assertEquals(CaptureHint.GUIDE, start.onTick(guideMs, hasEvaluated = true).shown)
    }

    @Test
    fun `showNow replaces at once`() {
        val presenter = HintPresenter.start(0).showNow(CaptureHint.CAPTURING, nowMs = 1)

        assertEquals(CaptureHint.CAPTURING, presenter.shown)
    }

    /** A gate that spoke [hint] at 0. */
    private fun spoke(hint: CaptureHint): SpeechGate = SpeechGate().onHintShown(SpeechKey(hint)).release(0).gate

    @Test
    fun `a hint shown inside the gap waits and is spoken when the gap is over`() {
        val waiting = spoke(CaptureHint.NO_ITEM).onHintShown(SpeechKey(CaptureHint.TOO_SMALL))

        assertNull(waiting.release(gapMs - 1).spoken)
        assertEquals(SpeechKey(CaptureHint.TOO_SMALL), waiting.release(gapMs).spoken)
    }

    @Test
    fun `while waiting, the latest hint wins`() {
        val waiting =
            spoke(CaptureHint.NO_ITEM)
                .onHintShown(SpeechKey(CaptureHint.TOO_SMALL))
                .onHintShown(SpeechKey(CaptureHint.NOT_STEADY))

        assertEquals(SpeechKey(CaptureHint.NOT_STEADY), waiting.release(gapMs).spoken)
    }

    @Test
    fun `the same key is not spoken again within the repeat window`() {
        val again = spoke(CaptureHint.NO_ITEM).onHintShown(SpeechKey(CaptureHint.NO_ITEM))

        val dropped = again.release(repeatMs - 1)
        assertNull(dropped.spoken)
        assertNull(dropped.gate.pending)
        assertEquals(SpeechKey(CaptureHint.NO_ITEM), again.release(repeatMs).spoken)
    }

    @Test
    fun `the guide of another step is a different key`() {
        val hanger = CameraContext(TOP_FLAT.family, CaptureMode.HANGER)
        val flatSpoken = SpeechGate().onHintShown(SpeechKey(CaptureHint.GUIDE, TOP_FLAT)).release(0).gate

        val gate = flatSpoken.onHintShown(SpeechKey(CaptureHint.GUIDE, hanger))

        assertEquals(SpeechKey(CaptureHint.GUIDE, hanger), gate.release(gapMs).spoken)
    }

    @Test
    fun `looking for the item is never spoken`() {
        val gate = SpeechGate().onHintShown(SpeechKey(CaptureHint.WARMING_UP))

        assertNull(gate.release(0).spoken)
    }
}
