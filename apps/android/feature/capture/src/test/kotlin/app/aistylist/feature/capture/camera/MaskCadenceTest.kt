package app.aistylist.feature.capture.camera

import app.aistylist.contracts.kernel.CaptureRules
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MaskCadenceTest {
    private val interval = CaptureRules.Ios.MASK_INTERVAL_MS.toLong()

    @Test
    fun `the first frame starts a run`() {
        assertTrue(MaskCadence().tryStart(nowMs = 0, isHot = false))
    }

    @Test
    fun `one run in flight at a time`() {
        val cadence = MaskCadence()
        cadence.tryStart(0, isHot = false)

        assertFalse(cadence.tryStart(interval * 3, isHot = false))
        cadence.finish()
        assertTrue(cadence.tryStart(interval * 3, isHot = false))
    }

    @Test
    fun `runs start at most every mask interval`() {
        val cadence = MaskCadence()
        cadence.tryStart(0, isHot = false)
        cadence.finish()

        assertFalse(cadence.tryStart(interval - 1, isHot = false))
        assertTrue(cadence.tryStart(interval, isHot = false))
    }

    @Test
    fun `a hot phone runs once a second`() {
        val cadence = MaskCadence()
        cadence.tryStart(0, isHot = true)
        cadence.finish()

        assertFalse(cadence.tryStart(MaskCadence.HOT_INTERVAL_MS - 1, isHot = true))
        assertTrue(cadence.tryStart(MaskCadence.HOT_INTERVAL_MS, isHot = true))
    }
}
