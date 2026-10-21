package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LockMachineTest {
    private val unlockAfter = CaptureRules.Lock.UNLOCK_AFTER_PASSING_EVALUATIONS
    private val relockAfter = CaptureRules.Lock.RELOCK_AFTER_FAILING_EVALUATIONS
    private val ringMs = CaptureRules.Lock.RING_FILL_MS.toLong()
    private val cooldownExit = CaptureRules.Batch.COOLDOWN_EXIT_EVALUATIONS

    /** Feeds [reports] one per evaluation interval after [startMs]; returns the last step and every effect. */
    private fun LockState.evaluateAll(
        reports: List<CheckReport>,
        startMs: Long = 0,
        stepMs: Long = EVALUATION_MS,
    ): Pair<LockState, List<CaptureEffect>> {
        var state = this
        val effects = mutableListOf<CaptureEffect>()
        reports.forEachIndexed { index, report ->
            val step = state.onEvaluation(report, startMs + (index + 1) * stepMs)
            state = step.state
            effects += step.effects
        }
        return state to effects
    }

    private fun passes(count: Int) = List(count) { report() }

    private fun fails(
        count: Int,
        hint: CaptureHint = CaptureHint.NOT_STEADY,
    ) = List(count) { report(hint) }

    private fun unlocked(atMs: Long = 0) = LockState.Unlocked(lastEvaluationAtMs = atMs)

    @Test
    fun `the first evaluation leaves warming-up locked with its reason`() {
        val (state, _) = LockState.WarmingUp.evaluateAll(fails(1, CaptureHint.NO_ITEM))

        assertEquals(LockState.Locked(CaptureHint.NO_ITEM), state)
    }

    @Test
    fun `a passing first evaluation leaves warming-up already counting`() {
        val (state, _) = LockState.WarmingUp.evaluateAll(passes(1))

        assertEquals(LockState.Locked(hint = null, passStreak = 1), state)
    }

    @Test
    fun `unlocks after the passing-evaluation count, with the unlock haptic`() {
        val (before, quiet) = LockState.Locked(CaptureHint.NOT_STEADY).evaluateAll(passes(unlockAfter - 1))
        val (after, effects) = LockState.Locked(CaptureHint.NOT_STEADY).evaluateAll(passes(unlockAfter))

        assertTrue(before is LockState.Locked)
        assertEquals(emptyList<CaptureEffect>(), quiet)
        assertTrue(after is LockState.Unlocked)
        assertEquals(listOf(CaptureEffect.Haptic(HapticKind.UNLOCK)), effects)
    }

    @Test
    fun `a failing evaluation restarts the unlock count`() {
        val (state, _) =
            LockState.Locked(null).evaluateAll(passes(unlockAfter - 1) + fails(1) + passes(unlockAfter - 1))

        assertEquals(LockState.Locked(hint = CaptureHint.NOT_STEADY, passStreak = unlockAfter - 1), state)
    }

    @Test
    fun `the ring fills with passing time and is not full one interval early`() {
        val evaluationsToFill = (ringMs / EVALUATION_MS).toInt()

        val (almost, noCapture) = unlocked().evaluateAll(passes(evaluationsToFill - 1))
        val (_, captured) = unlocked().evaluateAll(passes(evaluationsToFill))

        assertTrue(almost is LockState.Unlocked)
        assertEquals((ringMs - EVALUATION_MS).toDouble() / ringMs, (almost as LockState.Unlocked).ringProgress, 1e-9)
        assertEquals(emptyList<CaptureEffect>(), noCapture)
        assertEquals(
            listOf(CaptureEffect.Haptic(HapticKind.CAPTURE), CaptureEffect.RequestCapture(CaptureTrigger.AUTO)),
            captured,
        )
    }

    @Test
    fun `a full ring still needs the minimum number of evaluations`() {
        val slowPhone = ringMs + 1

        val (state, effects) =
            unlocked().evaluateAll(
                passes(CaptureRules.Lock.RING_MIN_EVALUATIONS - 1),
                stepMs = slowPhone,
            )
        val (captured, _) = unlocked().evaluateAll(passes(CaptureRules.Lock.RING_MIN_EVALUATIONS), stepMs = slowPhone)

        assertTrue(state is LockState.Unlocked)
        assertEquals(emptyList<CaptureEffect>(), effects)
        assertEquals(LockState.Capturing(CaptureTrigger.AUTO, GOOD_BOX), captured)
    }

    @Test
    fun `one failing evaluation pauses the ring without resetting it`() {
        val (state, _) = unlocked().evaluateAll(passes(2) + fails(1) + passes(1))

        // Two intervals before the pause, none for the failing one, one after it.
        assertEquals(3 * EVALUATION_MS, (state as LockState.Unlocked).ringFilledMs)
    }

    @Test
    fun `failing evaluations below the relock count keep the shutter unlocked`() {
        val (state, _) = unlocked().evaluateAll(fails(relockAfter - 1) + passes(1))

        assertTrue(state is LockState.Unlocked)
        assertEquals(0, (state as LockState.Unlocked).failStreak)
    }

    @Test
    fun `the relock count of failing evaluations relocks with the reason, ring reset, no haptic`() {
        val (state, effects) = unlocked().evaluateAll(passes(2) + fails(relockAfter, CaptureHint.TOO_SMALL))

        assertEquals(LockState.Locked(CaptureHint.TOO_SMALL), state)
        assertEquals(emptyList<CaptureEffect>(), effects)
    }

    @Test
    fun `the shutter captures when unlocked, with its trigger`() {
        val manual = unlocked().onShutter(CaptureTrigger.MANUAL, isAnywayVisible = false, itemBox = GOOD_BOX)
        val hardware = unlocked().onShutter(CaptureTrigger.HARDWARE, isAnywayVisible = false, itemBox = GOOD_BOX)

        assertEquals(LockState.Capturing(CaptureTrigger.MANUAL, GOOD_BOX), manual.state)
        assertEquals(CaptureEffect.RequestCapture(CaptureTrigger.HARDWARE), hardware.effects.last())
    }

    @Test
    fun `the shutter is ignored while locked unless anyway is visible, then it acts as anyway`() {
        val locked = LockState.Locked(CaptureHint.NO_ITEM)

        val ignored = locked.onShutter(CaptureTrigger.MANUAL, isAnywayVisible = false, itemBox = null)
        val anyway = locked.onShutter(CaptureTrigger.HARDWARE, isAnywayVisible = true, itemBox = null)

        assertEquals(LockStep(locked), ignored)
        assertEquals(LockState.Capturing(CaptureTrigger.ANYWAY, null), anyway.state)
    }

    @Test
    fun `anyway captures from warming-up, locked or unlocked only when visible`() {
        listOf(LockState.WarmingUp, LockState.Locked(null), unlocked()).forEach { state ->
            assertEquals(state, state.onAnyway(isAnywayVisible = false, itemBox = null).state)
            assertEquals(
                LockState.Capturing(CaptureTrigger.ANYWAY, null),
                state.onAnyway(isAnywayVisible = true, itemBox = null).state,
            )
        }
    }

    @Test
    fun `capturing ignores evaluations, the shutter and anyway`() {
        val capturing = LockState.Capturing(CaptureTrigger.AUTO, GOOD_BOX)

        assertEquals(capturing, capturing.evaluateAll(passes(5) + fails(5)).first)
        assertEquals(
            capturing,
            capturing.onShutter(CaptureTrigger.MANUAL, isAnywayVisible = true, itemBox = null).state,
        )
        assertEquals(capturing, capturing.onAnyway(isAnywayVisible = true, itemBox = null).state)
    }

    @Test
    fun `a finished capture leaves the camera in single flow and cools down in batch`() {
        val capturing = LockState.Capturing(CaptureTrigger.AUTO, GOOD_BOX)

        assertEquals(LockState.Idle, capturing.onCaptureFinished(CaptureFlowKind.SINGLE))
        assertEquals(LockState.Cooldown(GOOD_BOX), capturing.onCaptureFinished(CaptureFlowKind.BATCH))
    }

    @Test
    fun `a failed capture returns to locked`() {
        val capturing = LockState.Capturing(CaptureTrigger.MANUAL, null)

        assertEquals(LockState.Locked(CaptureHint.TOO_SMALL), capturing.onCaptureFailed(CaptureHint.TOO_SMALL))
    }

    @Test
    fun `cooldown ends after the exit count of no-item evaluations, not one fewer`() {
        val cooldown = LockState.Cooldown(GOOD_BOX)

        val (still, _) = cooldown.evaluateAll(List(cooldownExit - 1) { noItemReport() })
        val (ended, _) = cooldown.evaluateAll(List(cooldownExit) { noItemReport() })

        assertTrue(still is LockState.Cooldown)
        assertEquals(LockState.Locked(CaptureHint.NO_ITEM), ended)
    }

    @Test
    fun `cooldown ends after the exit count of boxes overlapping the captured one below the IoU`() {
        val cooldown = LockState.Cooldown(GOOD_BOX)
        val elsewhere = NormalizedRect(left = 0.5, top = 0.2, right = 1.0, bottom = 0.8)
        assertTrue(elsewhere.intersectionOverUnion(GOOD_BOX) < CaptureRules.Batch.NEW_ITEM_BELOW_IOU)

        val (ended, _) = cooldown.evaluateAll(List(cooldownExit) { report(box = elsewhere) })

        assertTrue(ended is LockState.Locked)
    }

    @Test
    fun `the same item at or above the IoU keeps the cooldown`() {
        val (state, _) = LockState.Cooldown(GOOD_BOX).evaluateAll(List(10) { report(box = GOOD_BOX) })

        assertEquals(LockState.Cooldown(GOOD_BOX), state)
    }

    @Test
    fun `IoU just below the new-item threshold counts as a new item and just above does not`() {
        val threshold = CaptureRules.Batch.NEW_ITEM_BELOW_IOU
        val captured = NormalizedRect(0.0, 0.0, 0.5, 0.5)

        // Two equal boxes offset horizontally overlap by IoU = (1 - d) / (1 + d), d = shift ÷ width.
        fun shiftedFor(iou: Double): NormalizedRect {
            val shift = 0.5 * (1 - iou) / (1 + iou)
            return captured.copy(left = shift, right = 0.5 + shift)
        }

        val justBelow = report(box = shiftedFor(threshold - SHARE_STEP))
        val justAbove = report(box = shiftedFor(threshold + SHARE_STEP))

        val (newItem, _) = LockState.Cooldown(captured).evaluateAll(List(cooldownExit) { justBelow })
        val (sameItem, _) = LockState.Cooldown(captured).evaluateAll(List(cooldownExit) { justAbove })

        assertTrue(newItem is LockState.Locked)
        assertTrue(sameItem is LockState.Cooldown)
    }

    @Test
    fun `no-item and new-box evaluations count in separate streaks`() {
        val elsewhere = NormalizedRect(left = 0.5, top = 0.2, right = 1.0, bottom = 0.8)

        val (state, _) =
            LockState.Cooldown(GOOD_BOX).evaluateAll(listOf(noItemReport(), report(box = elsewhere), noItemReport()))

        assertTrue(state is LockState.Cooldown)
    }

    @Test
    fun `next item ends the cooldown at once`() {
        assertEquals(LockState.Locked(null), LockState.Cooldown(GOOD_BOX).onNextItem())
        assertEquals(unlocked(), unlocked().onNextItem())
    }

    @Test
    fun `a mode change resets the counters to locked`() {
        assertEquals(LockState.Locked(null), unlocked().evaluateAll(passes(4)).first.onModeChanged())
        assertEquals(LockState.Locked(null), LockState.Locked(CaptureHint.TOO_SMALL, passStreak = 2).onModeChanged())
        assertEquals(LockState.WarmingUp, LockState.WarmingUp.onModeChanged())
    }
}
