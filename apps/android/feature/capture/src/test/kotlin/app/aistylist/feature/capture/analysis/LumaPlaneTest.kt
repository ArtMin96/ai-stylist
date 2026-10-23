package app.aistylist.feature.capture.analysis

import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.domain.NormalizedRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Synthetic planes only: flat fields, stripes and single marked pixels.

/** Stripes wide enough to survive the average down to the sharpness size. */
private const val STRIPE = 4

class LumaPlaneTest {
    private val whole = NormalizedRect(0.0, 0.0, 1.0, 1.0)

    private fun plane(
        width: Int,
        height: Int,
        value: (x: Int, y: Int) -> Float,
    ) = LumaPlane(width, height, FloatArray(width * height) { i -> value(i % width, i / width) })

    @Test
    fun `light is the mean luma and the share of clipped pixels`() {
        val clippedLuma = CaptureRules.Light.CLIPPED_MIN_LUMA.toFloat()
        val light = plane(4, 1) { x, _ -> if (x == 0) clippedLuma else 0f }.light()

        assertEquals(clippedLuma / 4.0, light.meanLuma, 1e-6)
        assertEquals(0.25, light.clippedShare, 1e-9)
    }

    @Test
    fun `a flat field has no sharpness and stripes have plenty`() {
        val flat = plane(320, 240) { _, _ -> 128f }
        val stripes = plane(320, 240) { x, _ -> if (x % 2 == 0) 0f else 255f }

        assertEquals(0.0, flat.sharpness(whole), 1e-9)
        assertTrue(stripes.sharpness(whole) > CaptureRules.Steady.MIN_SHARPNESS)
    }

    @Test
    fun `sharpness is measured inside the box only`() {
        // Stripes on the left half, flat on the right.
        val half = plane(320, 240) { x, _ -> if (x < 160 && x % 2 == 0) 255f else 0f }

        assertEquals(0.0, half.sharpness(NormalizedRect(0.6, 0.1, 0.9, 0.9)), 1e-9)
        assertTrue(half.sharpness(NormalizedRect(0.1, 0.1, 0.4, 0.9)) > 0.0)
    }

    @Test
    fun `a plane larger than the sharpness size is averaged down to it`() {
        val big = plane(640, 480) { _, _ -> 10f }.scaledToLongSide(CaptureRules.Steady.SHARPNESS_LONG_SIDE_PX)

        assertEquals(320, big.width)
        assertEquals(240, big.height)
        assertEquals(10f, big.at(100, 100))
    }

    @Test
    fun `turning a landscape sensor frame clockwise makes it portrait, top-left to top-right`() {
        val sensor = plane(3, 2) { x, y -> if (x == 0 && y == 0) 1f else 0f }

        val upright = sensor.rotated(90)

        assertEquals(2, upright.width)
        assertEquals(3, upright.height)
        assertEquals(1f, upright.at(1, 0))
        assertEquals(1f, sensor.rotated(270).at(0, 2))
        assertEquals(1f, sensor.rotated(180).at(2, 1))
    }

    @Test
    fun `a sensor box maps into the upright frame for every rotation`() {
        // A box at the sensor's top-left quarter of a 400 x 300 frame.
        fun mapped(degrees: Int) = uprightBox(0f, 0f, 200f, 150f, 400, 300, degrees)

        assertEquals(NormalizedRect(0.0, 0.0, 0.5, 0.5), mapped(0))
        assertEquals(NormalizedRect(0.5, 0.0, 1.0, 0.5), mapped(90))
        assertEquals(NormalizedRect(0.5, 0.5, 1.0, 1.0), mapped(180))
        assertEquals(NormalizedRect(0.0, 0.5, 0.5, 1.0), mapped(270))
    }

    @Test
    fun `boxes reaching past an edge are clipped to the frame`() {
        assertEquals(NormalizedRect(0.0, 0.2, 0.3, 1.0), NormalizedRect(-0.1, 0.2, 0.3, 1.2).clamped())
    }

    @Test
    fun `a camera Y plane honours its row and pixel strides`() {
        // Two rows of two pixels, row stride 3 (one padding byte), pixel stride 1.
        val bytes = byteArrayOf(10, 20, 0, 30, (200).toByte(), 0)

        val plane = LumaPlane.fromYPlane(width = 2, height = 2, bytes = bytes, rowStride = 3, pixelStride = 1)

        assertEquals(200f, plane.at(1, 1))
        assertEquals(30f, plane.at(0, 1))
    }

    @Test
    fun `bitmap pixels become Rec 601 luma`() {
        val white = 0xFFFFFFFF.toInt()
        val pureGreen = 0xFF00FF00.toInt()

        val plane = LumaPlane.fromArgb(2, 1, intArrayOf(white, pureGreen))

        assertEquals(255f, plane.at(0, 0), 0.01f)
        assertEquals(0.587f * 255, plane.at(1, 0), 0.01f)
    }

    @Test
    fun `an observation judges the largest box and measures the whole frame's light`() {
        val sensor = plane(640, 480) { x, _ -> if (x / STRIPE % 2 == 0) 0f else 255f }
        val small = NormalizedRect(0.0, 0.0, 0.1, 0.1)
        val large = NormalizedRect(0.2, 0.2, 0.8, 0.8)

        val observation = measureObservation(42, sensor, rotationDegrees = 90, boxes = listOf(small, large))

        assertEquals(large, observation.itemBox)
        assertEquals(127.5, observation.light.meanLuma, 1e-3)
        assertTrue(observation.sharpness > 0.0)
        assertEquals(42L, observation.timestampMs)
    }
}
