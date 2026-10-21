package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.contracts.kernel.CaptureShapeFamily
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AnywayTimerTest {
    private val delay = CaptureRules.Timing.ANYWAY_DELAY_MS.toLong()

    @Test
    fun `hidden one millisecond before the delay, shown at the delay`() {
        val timer = AnywayTimer().restart(nowMs = 1_000)

        assertFalse(timer.update(nowMs = 1_000 + delay - 1, isForced = false).isShown)
        assertTrue(timer.update(nowMs = 1_000 + delay, isForced = false).isShown)
    }

    @Test
    fun `once shown it stays, even when the force goes away`() {
        val shown = AnywayTimer().restart(0).update(nowMs = 0, isForced = true)

        assertTrue(shown.update(nowMs = 1, isForced = false).isShown)
    }

    @Test
    fun `a screen reader or the pose fallback shows it at once`() {
        assertTrue(AnywayTimer().restart(0).update(nowMs = 0, isForced = true).isShown)
    }

    @Test
    fun `restart hides it and counts again`() {
        val restarted = AnywayTimer().restart(0).update(delay, isForced = false).restart(delay)

        assertFalse(restarted.isShown)
        assertFalse(restarted.update(2 * delay - 1, isForced = false).isShown)
        assertTrue(restarted.update(2 * delay, isForced = false).isShown)
    }

    @Test
    fun `a stopped timer never shows`() {
        assertFalse(AnywayTimer().update(nowMs = 10 * delay, isForced = true).isShown)
    }

    @Test
    fun `the reason line follows the lock reason`() {
        val bottomsWorn = CameraContext(CaptureShapeFamily.SHORT_BOTTOM, CaptureMode.WORN)

        assertEquals(AnywayReason.NoItemSurfaceTip, anywayReasonFor(CaptureHint.NO_ITEM, TOP_FLAT))
        assertEquals(AnywayReason.Hint(CaptureHint.NOT_STEADY), anywayReasonFor(CaptureHint.NOT_STEADY, TOP_FLAT))
        assertEquals(
            AnywayReason.Hint(CaptureHint.BODY_HIPS_KNEES),
            anywayReasonFor(CaptureHint.BODY_HIPS_KNEES, bottomsWorn),
        )
        assertNull(anywayReasonFor(null, TOP_FLAT))
    }

    @Test
    fun `cut off in flat mode suggests hanger mode only where the family offers it (C11)`() {
        val topHanger = CameraContext(CaptureShapeFamily.TOP, CaptureMode.HANGER)
        val shoes = CameraContext(CaptureShapeFamily.SHOES, CaptureMode.FLAT)

        assertEquals(AnywayReason.TryHangerMode, anywayReasonFor(CaptureHint.CUT_OFF_MULTIPLE, TOP_FLAT))
        assertEquals(AnywayReason.TryHangerMode, anywayReasonFor(CaptureHint.CUT_OFF_TOP, TOP_FLAT))
        assertEquals(AnywayReason.Hint(CaptureHint.CUT_OFF_TOP), anywayReasonFor(CaptureHint.CUT_OFF_TOP, topHanger))
        assertEquals(AnywayReason.Hint(CaptureHint.CUT_OFF_LEFT), anywayReasonFor(CaptureHint.CUT_OFF_LEFT, shoes))
    }

    @Test
    fun `the guide test ID names the family, mode and step`() {
        assertEquals("cap-guide-top-flat", TOP_FLAT.guideTestTag)
        assertEquals(
            "cap-guide-shoes-flat-pair",
            CameraContext(CaptureShapeFamily.SHOES, CaptureMode.FLAT, CaptureSide.PAIR).guideTestTag,
        )
        assertEquals(
            "cap-guide-long-bottom-hanger-back",
            CameraContext(CaptureShapeFamily.LONG_BOTTOM, CaptureMode.HANGER, CaptureSide.BACK).guideTestTag,
        )
    }
}
