package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureBodyPart
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.contracts.kernel.CaptureShapeFamily
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** One camera step end to end on a fake clock: the brief's timing and the sim-testable C-cases. */
class CaptureCameraSessionTest {
    private val anywayMs = CaptureRules.Timing.ANYWAY_DELAY_MS.toLong()
    private val guideMs = CaptureRules.Timing.GUIDE_HINT_MS.toLong()

    /** Camera ready at 0, then a frame every evaluation interval. Unlock = 1 + N passes; capture = ring after. */
    private val firstFrameMs = EVALUATION_MS
    private val unlockMs = firstFrameMs + CaptureRules.Lock.UNLOCK_AFTER_PASSING_EVALUATIONS * EVALUATION_MS
    private val autoCaptureMs = unlockMs + CaptureRules.Lock.RING_FILL_MS

    private class Harness(
        context: CameraContext = TOP_FLAT,
        isScreenReaderOn: Boolean = false,
        isSpeechOn: Boolean = false,
    ) {
        val clock = FakeClock()
        val session = CaptureCameraSession(context, clock, isScreenReaderOn, isSpeechOn)
        val effects = mutableListOf<Pair<Long, CaptureEffect>>()
        val snapshot: CameraSnapshot get() = session.snapshot

        fun record(produced: List<CaptureEffect>) {
            effects += produced.map { clock.now to it }
        }

        fun ready() = record(session.cameraReady())

        /** One frame per evaluation interval until [untilMs] (inclusive). */
        fun playUntil(
            untilMs: Long,
            frameAt: (Long) -> CaptureObservation = { frame(it) },
        ) {
            while (clock.now + EVALUATION_MS <= untilMs) {
                clock.advance(EVALUATION_MS)
                record(session.submit(frameAt(clock.now)))
            }
        }

        fun tickAt(ms: Long) {
            clock.now = ms
            record(session.tick())
        }

        fun timeOf(effect: CaptureEffect): Long? = effects.firstOrNull { it.second == effect }?.first

        fun spoken(): List<Pair<Long, CaptureHint>> =
            effects.mapNotNull { (at, effect) -> (effect as? CaptureEffect.Speak)?.let { at to it.hint } }
    }

    @Test
    fun `C1 a steady flat top unlocks, fills the ring and auto-captures`() {
        val harness = Harness().apply { ready() }
        assertEquals(LockPhase.WARMING_UP, harness.snapshot.phase)
        assertEquals(CaptureHint.GUIDE, harness.snapshot.hint)

        harness.playUntil(autoCaptureMs)

        assertEquals(unlockMs, harness.timeOf(CaptureEffect.Haptic(HapticKind.UNLOCK)))
        assertTrue(unlockMs <= 3_000)
        assertEquals(autoCaptureMs, harness.timeOf(CaptureEffect.RequestCapture(CaptureTrigger.AUTO)))
        assertEquals(ShutterState.CAPTURING, harness.snapshot.shutter)
        assertEquals(CaptureHint.CAPTURING, harness.snapshot.hint)
    }

    @Test
    fun `the ring shows progress while unlocked`() {
        val harness = Harness().apply { ready() }

        harness.playUntil(unlockMs + CaptureRules.Lock.RING_FILL_MS / 2)

        assertEquals(ShutterState.UNLOCKED, harness.snapshot.shutter)
        assertEquals(0.5, harness.snapshot.ringProgress, 1e-9)
    }

    @Test
    fun `a single capture ends the step`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(autoCaptureMs)

        harness.record(harness.session.captureFinished())

        assertEquals(LockPhase.IDLE, harness.snapshot.phase)
        assertFalse(harness.snapshot.isAnywayVisible)
    }

    @Test
    fun `a failed capture locks again`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(autoCaptureMs)

        harness.record(harness.session.captureFailed())

        assertEquals(LockPhase.LOCKED, harness.snapshot.phase)
    }

    @Test
    fun `evaluations run at most once per interval`() {
        val harness = Harness().apply { ready() }
        val half = EVALUATION_MS / 2

        fun framesEveryHalfIntervalUntil(untilMs: Long) {
            while (harness.clock.now + half <= untilMs) {
                harness.clock.advance(half)
                harness.record(harness.session.submit(frame(harness.clock.now)))
            }
        }

        // Evaluated at half, then once per interval: the passes land one interval apart, not half.
        val unlockAt = half + CaptureRules.Lock.UNLOCK_AFTER_PASSING_EVALUATIONS * EVALUATION_MS
        framesEveryHalfIntervalUntil(unlockAt - half)
        assertEquals(LockPhase.LOCKED, harness.snapshot.phase)
        framesEveryHalfIntervalUntil(unlockAt)
        assertEquals(LockPhase.UNLOCKED, harness.snapshot.phase)
    }

    @Test
    fun `C8 no item, locked, then anyway at the delay with the surface tip`() {
        val harness = Harness().apply { ready() }

        harness.playUntil(anywayMs - EVALUATION_MS) { frame(it, box = null) }
        harness.tickAt(anywayMs - 1)
        assertFalse(harness.snapshot.isAnywayVisible)
        assertEquals(CaptureHint.NO_ITEM, harness.snapshot.hint)

        harness.tickAt(anywayMs)
        assertTrue(harness.snapshot.isAnywayVisible)
        assertEquals(AnywayReason.NoItemSurfaceTip, harness.snapshot.anywayReason)
        assertTrue(harness.snapshot.isHardwareShutterEnabled)
    }

    @Test
    fun `anyway captures with the anyway trigger`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(anywayMs) { frame(it, box = null) }

        harness.record(harness.session.anywayTapped())

        assertEquals(anywayMs, harness.timeOf(CaptureEffect.RequestCapture(CaptureTrigger.ANYWAY)))
    }

    @Test
    fun `C11 a coat too big locks cut-off-multiple and suggests hanger mode`() {
        val coat = NormalizedRect(0.0, 0.0, 1.0, 1.0)
        val harness = Harness(CameraContext(CaptureShapeFamily.OUTERWEAR, CaptureMode.FLAT)).apply { ready() }

        harness.playUntil(anywayMs) { frame(it, box = coat) }

        assertEquals(CaptureHint.CUT_OFF_MULTIPLE, harness.snapshot.hint)
        assertEquals(AnywayReason.TryHangerMode, harness.snapshot.anywayReason)
    }

    @Test
    fun `C14 shaky hands never unlock and anyway shows at the delay`() {
        val harness = Harness().apply { ready() }
        val jitter = 2 * CaptureRules.Steady.MAX_CENTRE_SHIFT

        harness.playUntil(anywayMs) { time ->
            val shift = if ((time / EVALUATION_MS) % 2 == 0L) jitter else 0.0
            frame(time, box = GOOD_BOX.copy(left = GOOD_BOX.left + shift, right = GOOD_BOX.right + shift))
        }

        assertNull(harness.timeOf(CaptureEffect.Haptic(HapticKind.UNLOCK)))
        assertEquals(CaptureHint.NOT_STEADY, harness.snapshot.hint)
        assertTrue(harness.snapshot.isAnywayVisible)
        assertEquals(AnywayReason.Hint(CaptureHint.NOT_STEADY), harness.snapshot.anywayReason)
    }

    @Test
    fun `C32 a partly covered item never unlocks and anyway shows the covered hint`() {
        val occluder = squareBox(areaShare = 0.04)
        val harness = Harness().apply { ready() }

        harness.playUntil(anywayMs) { frame(it).copy(itemBoxes = listOf(GOOD_BOX, occluder)) }

        assertNull(harness.timeOf(CaptureEffect.Haptic(HapticKind.UNLOCK)))
        assertEquals(LockPhase.LOCKED, harness.snapshot.phase)
        assertEquals(CaptureHint.COVERED, harness.snapshot.hint)
        assertTrue(harness.snapshot.isAnywayVisible)
        assertEquals(AnywayReason.Hint(CaptureHint.COVERED), harness.snapshot.anywayReason)
    }

    @Test
    fun `C13 a dim room hints too dark and the shutter still unlocks`() {
        val dim = LightSample(meanLuma = CaptureRules.Light.TOO_DARK_BELOW_MEAN_LUMA - 15, clippedShare = 0.0)
        val harness = Harness().apply { ready() }

        // The guide (shown at 0) gives way once it has been visible the minimum time.
        harness.playUntil(CaptureRules.Timing.HINT_MIN_VISIBLE_MS.toLong()) { frame(it, light = dim) }

        assertEquals(LockPhase.UNLOCKED, harness.snapshot.phase)
        assertEquals(CaptureHint.TOO_DARK, harness.snapshot.hint)
    }

    @Test
    fun `C15 two items side by side do not lock`() {
        val left = NormalizedRect(0.05, 0.3, 0.45, 0.8)
        val right = NormalizedRect(0.55, 0.3, 0.95, 0.8)
        val harness = Harness(CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.FLAT)).apply { ready() }

        harness.playUntil(unlockMs) { frame(it).copy(itemBoxes = listOf(left, right)) }

        assertEquals(LockPhase.UNLOCKED, harness.snapshot.phase)
    }

    @Test
    fun `C5 a ring-sized small item unlocks and a smaller one says move closer`() {
        val context = CameraContext(CaptureShapeFamily.SMALL_ITEM, CaptureMode.FLAT)
        val minimum = CaptureShapeFamily.SMALL_ITEM.minAreaShare
        val ring = Harness(context).apply { ready() }
        val tiny = Harness(context).apply { ready() }

        ring.playUntil(unlockMs) { frame(it, box = squareBox(minimum + SHARE_STEP)) }
        tiny.playUntil(guideMs + EVALUATION_MS) { frame(it, box = squareBox(minimum - SHARE_STEP)) }

        assertEquals(LockPhase.UNLOCKED, ring.snapshot.phase)
        assertEquals(LockPhase.LOCKED, tiny.snapshot.phase)
        assertEquals(CaptureHint.TOO_SMALL, tiny.snapshot.hint)
    }

    @Test
    fun `a mode change relocks but does not restart the anyway timer`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(anywayMs / 2) { frame(it, box = null) }

        harness.record(harness.session.modeChanged(CaptureMode.HANGER))
        assertEquals(LockPhase.LOCKED, harness.snapshot.phase)
        assertEquals(CaptureMode.HANGER, harness.session.context.mode)
        harness.playUntil(anywayMs) { frame(it, box = null) }

        assertTrue(harness.snapshot.isAnywayVisible)
    }

    @Test
    fun `C24 background stops everything, foreground warms up and restarts the anyway timer`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(anywayMs / 2) { frame(it, box = null) }

        harness.session.backgrounded()
        assertEquals(LockPhase.IDLE, harness.snapshot.phase)
        harness.clock.advance(1_000)
        val back = harness.clock.now
        harness.record(harness.session.foregrounded())

        assertEquals(LockPhase.WARMING_UP, harness.snapshot.phase)
        harness.playUntil(back + anywayMs - EVALUATION_MS) { frame(it, box = null) }
        harness.tickAt(back + anywayMs - 1)
        assertFalse(harness.snapshot.isAnywayVisible)
        harness.tickAt(back + anywayMs)
        assertTrue(harness.snapshot.isAnywayVisible)
    }

    @Test
    fun `frames in the background are ignored`() {
        val harness = Harness().apply { ready() }
        harness.session.backgrounded()

        harness.playUntil(autoCaptureMs)

        assertEquals(LockPhase.IDLE, harness.snapshot.phase)
        assertEquals(emptyList<Pair<Long, CaptureEffect>>(), harness.effects)
    }

    @Test
    fun `C25 with a screen reader anyway shows at once and the shutter acts as anyway`() {
        val harness = Harness(isScreenReaderOn = true).apply { ready() }

        assertTrue(harness.snapshot.isAnywayVisible)
        assertTrue(harness.snapshot.isHardwareShutterEnabled)
        harness.record(harness.session.shutterTapped())

        assertEquals(0L, harness.timeOf(CaptureEffect.RequestCapture(CaptureTrigger.ANYWAY)))
    }

    @Test
    fun `turning a screen reader on mid-step shows anyway at once`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(1_000) { frame(it, box = null) }

        harness.record(harness.session.screenReaderChanged(isOn = true))

        assertTrue(harness.snapshot.isAnywayVisible)
        assertEquals(AnywayReason.NoItemSurfaceTip, harness.snapshot.anywayReason)
    }

    @Test
    fun `C26 volume keys act as the shutter only when unlocked or anyway is visible`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(firstFrameMs)
        assertFalse(harness.snapshot.isHardwareShutterEnabled)
        harness.record(harness.session.hardwareShutter())
        assertEquals(emptyList<Pair<Long, CaptureEffect>>(), harness.effects)

        harness.playUntil(unlockMs)
        assertTrue(harness.snapshot.isHardwareShutterEnabled)
        harness.record(harness.session.hardwareShutter())

        assertEquals(unlockMs, harness.timeOf(CaptureEffect.RequestCapture(CaptureTrigger.HARDWARE)))
    }

    @Test
    fun `without a screen reader or the speaker toggle nothing is spoken`() {
        val harness = Harness().apply { ready() }

        harness.playUntil(anywayMs) { frame(it, box = null) }

        assertEquals(emptyList<Pair<Long, CaptureHint>>(), harness.spoken())
    }

    @Test
    fun `with a screen reader each shown hint is spoken once, outside the gap`() {
        val harness = Harness(isScreenReaderOn = true).apply { ready() }

        harness.playUntil(anywayMs) { frame(it, box = null) }

        // No hint is proposed during the guide time, so no-item holds from the guide time on.
        val noItemShownAt = guideMs + (CaptureRules.Timing.HINT_HOLD_EVALUATIONS - 1) * EVALUATION_MS
        assertEquals(listOf(0L to CaptureHint.GUIDE, noItemShownAt to CaptureHint.NO_ITEM), harness.spoken())
    }

    @Test
    fun `a hint shown inside the speech gap waits, and the latest one wins`() {
        val harness = Harness(isScreenReaderOn = true).apply { ready() }

        // "Ready" (at the unlock) and "Taking photo" (at the capture) both land inside the gap after the guide.
        harness.playUntil(autoCaptureMs)
        harness.tickAt(CaptureRules.Timing.SPEECH_MIN_GAP_MS.toLong())

        assertTrue(autoCaptureMs < CaptureRules.Timing.SPEECH_MIN_GAP_MS)
        assertEquals(
            listOf(0L to CaptureHint.GUIDE, CaptureRules.Timing.SPEECH_MIN_GAP_MS.toLong() to CaptureHint.CAPTURING),
            harness.spoken(),
        )
    }

    @Test
    fun `the unlock shows ready at once, or the advisory tip when there is one`() {
        val plain = Harness().apply { ready() }
        val dim = Harness().apply { ready() }
        val dark = LightSample(meanLuma = CaptureRules.Light.TOO_DARK_BELOW_MEAN_LUMA - 15, clippedShare = 0.0)

        plain.playUntil(unlockMs)
        dim.playUntil(unlockMs) { frame(it, light = dark) }

        assertEquals(CaptureHint.READY, plain.snapshot.hint)
        // The unlock ends the guide at once (brief §5), as on iOS; the tip wins over "ready" (C13).
        assertEquals(CaptureHint.TOO_DARK, dim.snapshot.hint)
        assertNull(plain.snapshot.anywayReason)
    }

    @Test
    fun `a failed capture shows the hint from before the capture again`() {
        val harness = Harness().apply { ready() }
        harness.playUntil(autoCaptureMs)

        harness.record(harness.session.captureFailed())

        assertEquals(CaptureHint.READY, harness.snapshot.hint)
    }

    @Test
    fun `the speaker toggle turns speech on and off for anyone`() {
        val on = Harness(isSpeechOn = true).apply { ready() }
        val off = Harness(isSpeechOn = true)
        off.session.speechToggled(isOn = false)
        off.ready()

        assertEquals(listOf(0L to CaptureHint.GUIDE), on.spoken())
        assertEquals(emptyList<Pair<Long, CaptureHint>>(), off.spoken())
    }

    @Test
    fun `C3 worn mode with a missing hip locks with the body hint and anyway follows`() {
        val noHip = fullBody().withPart(CaptureBodyPart.LEFT_HIP, null)
        val harness = Harness(TOP_WORN).apply { ready() }

        harness.playUntil(anywayMs) { frame(it, pose = noHip) }

        assertNull(harness.timeOf(CaptureEffect.Haptic(HapticKind.UNLOCK)))
        assertEquals(CaptureHint.BODY_SHOULDERS_HIPS, harness.snapshot.hint)
        assertEquals(AnywayReason.Hint(CaptureHint.BODY_SHOULDERS_HIPS), harness.snapshot.anywayReason)
    }

    @Test
    fun `C3 worn mode with the whole body unlocks even when the item touches the edges`() {
        val mirror = NormalizedRect(0.0, 0.0, 1.0, 1.0)
        val harness = Harness(TOP_WORN).apply { ready() }

        harness.playUntil(unlockMs) { frame(it, box = mirror, pose = fullBody()) }

        assertEquals(LockPhase.UNLOCKED, harness.snapshot.phase)
    }

    @Test
    fun `pose model unavailable in worn mode, no body lock and anyway at once`() {
        val harness = Harness(TOP_WORN).apply { ready() }

        harness.playUntil(firstFrameMs) { frame(it, pose = null) }
        assertTrue(harness.snapshot.isAnywayVisible)
        harness.playUntil(unlockMs) { frame(it, pose = null) }

        assertEquals(LockPhase.UNLOCKED, harness.snapshot.phase)
    }

    @Test
    fun `C20 batch cools down after a capture until the item leaves, and restarts the anyway timer`() {
        val batch = CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.FLAT, kind = CaptureFlowKind.BATCH)
        val harness = Harness(batch).apply { ready() }
        harness.playUntil(autoCaptureMs)
        val savedAt = autoCaptureMs + EVALUATION_MS
        harness.clock.now = savedAt
        harness.record(harness.session.captureFinished())
        assertEquals(LockPhase.COOLDOWN, harness.snapshot.phase)

        harness.playUntil(savedAt + 5 * EVALUATION_MS)
        assertEquals(LockPhase.COOLDOWN, harness.snapshot.phase)
        val exitAt = harness.clock.now + CaptureRules.Batch.COOLDOWN_EXIT_EVALUATIONS * EVALUATION_MS
        harness.playUntil(exitAt) { frame(it, box = null) }
        assertEquals(LockPhase.LOCKED, harness.snapshot.phase)

        // The anyway timer restarts when the cooldown ends.
        harness.tickAt(exitAt + anywayMs - 1)
        assertFalse(harness.snapshot.isAnywayVisible)
        harness.tickAt(exitAt + anywayMs)
        assertTrue(harness.snapshot.isAnywayVisible)
    }

    @Test
    fun `batch next item ends the cooldown at once`() {
        val batch = CameraContext(CaptureShapeFamily.GENERIC, CaptureMode.FLAT, kind = CaptureFlowKind.BATCH)
        val harness = Harness(batch).apply { ready() }
        harness.playUntil(autoCaptureMs)
        harness.record(harness.session.captureFinished())

        harness.record(harness.session.nextItemTapped())

        assertEquals(LockPhase.LOCKED, harness.snapshot.phase)
    }

    @Test
    fun `with no frame after the guide time it says it is looking for the item`() {
        val harness = Harness().apply { ready() }

        harness.tickAt(guideMs - 1)
        assertEquals(CaptureHint.GUIDE, harness.snapshot.hint)
        harness.tickAt(guideMs)

        assertEquals(CaptureHint.WARMING_UP, harness.snapshot.hint)
        assertEquals(LockPhase.WARMING_UP, harness.snapshot.phase)
    }
}
