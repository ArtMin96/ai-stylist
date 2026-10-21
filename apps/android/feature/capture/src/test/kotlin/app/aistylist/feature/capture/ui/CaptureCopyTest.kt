package app.aistylist.feature.capture.ui

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CaptureSide
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** The brief's copy (§6) reaches the screen: every hint, guide and spoken line resolves verbatim. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class CaptureCopyTest {
    private val context = RuntimeEnvironment.getApplication()
    private val topFlat = CameraContext(CaptureShapeFamily.TOP, CaptureMode.FLAT)

    @Test
    fun `every hint has shown and spoken text in every family and mode`() {
        CaptureShapeFamily.entries.forEach { family ->
            family.modes.forEach { mode ->
                CaptureHint.entries.forEach { hint ->
                    val step = CameraContext(family, mode)
                    assertTrue(context.getString(hint.shownText(step)).isNotBlank())
                    assertTrue(context.getString(hint.spokenText(step)).isNotBlank())
                }
            }
        }
    }

    @Test
    fun `shown and spoken hints use the brief's words`() {
        assertEquals("Point the camera at the item", context.getString(CaptureHint.NO_ITEM.shownText(topFlat)))
        assertEquals(
            "No item found. Point the camera at the item.",
            context.getString(CaptureHint.NO_ITEM.spokenText(topFlat)),
        )
        assertEquals("Keep still…", context.getString(CaptureHint.READY.shownText(topFlat)))
        assertEquals("Ready. Keep still.", context.getString(CaptureHint.READY.spokenText(topFlat)))
        assertEquals(
            "Move back. The left side is cut off.",
            context.getString(CaptureHint.CUT_OFF_LEFT.spokenText(topFlat)),
        )
    }

    @Test
    fun `the guide follows the family, the mode and the step`() {
        fun guide(
            family: CaptureShapeFamily,
            mode: CaptureMode,
            side: CaptureSide = CaptureSide.FRONT,
        ) = context.getString(CaptureHint.GUIDE.shownText(CameraContext(family, mode, side)))

        assertEquals("Lay it flat, sleeves out", guide(CaptureShapeFamily.TOP, CaptureMode.FLAT))
        assertEquals("Hang it by the waist", guide(CaptureShapeFamily.LONG_BOTTOM, CaptureMode.HANGER))
        assertEquals("Stand back so the whole jacket fits", guide(CaptureShapeFamily.OUTERWEAR, CaptureMode.WORN))
        assertEquals("Turn it over. Back side up.", guide(CaptureShapeFamily.TOP, CaptureMode.FLAT, CaptureSide.BACK))
        assertEquals("Both shoes, side by side", guide(CaptureShapeFamily.SHOES, CaptureMode.FLAT, CaptureSide.PAIR))
        assertEquals("Turn it around.", guide(CaptureShapeFamily.BAG, CaptureMode.FLAT, CaptureSide.BACK))
        assertEquals("Turn it over.", guide(CaptureShapeFamily.SMALL_ITEM, CaptureMode.FLAT, CaptureSide.BACK))
    }

    @Test
    fun `every step has a guide outline`() {
        CaptureShapeFamily.entries.forEach { family ->
            family.modes.forEach { mode ->
                assertTrue(CameraContext(family, mode).guidePath.isNotBlank())
            }
        }
    }
}
