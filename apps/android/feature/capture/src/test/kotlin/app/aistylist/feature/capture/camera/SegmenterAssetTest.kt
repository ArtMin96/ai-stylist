package app.aistylist.feature.capture.camera

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.util.Locale

/**
 * The committed garment segmenter is the one `tools/capture-segmenter/convert.sh` built: its bytes
 * hash to the recorded sha256, and its licence notice ships beside it.
 */
class SegmenterAssetTest {
    private val dir = File("src/main/assets/capture-segmenter")

    @Test
    fun `the model matches its recorded sha256`() {
        val model = File(dir, LiteRtGarmentSegmenter.MODEL_ASSET.substringAfterLast('/'))
        val recorded = File(dir, "${model.name}.sha256").readText().trim().substringBefore(' ')

        val actual =
            MessageDigest
                .getInstance(
                    "SHA-256",
                ).digest(model.readBytes())
                .joinToString("") { "%02x".format(Locale.ROOT, it) }

        assertEquals(recorded, actual)
    }

    @Test
    fun `the licence notice names both licences and the source hash`() {
        val notice = File(dir, "NOTICE.txt").readText()

        assertTrue(notice.contains("Apache License 2.0"))
        assertTrue(notice.contains("MIT License"))
        assertTrue(notice.contains("309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8"))
    }
}
