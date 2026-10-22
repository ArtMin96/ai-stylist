package app.aistylist.feature.capture.debug

import android.graphics.Bitmap
import android.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

// One plain grey frame with no item (stored boxes: none), in the generator's layout; no real frames.
private const val EMPTY_INDEX =
    """
    {
      "playback": { "fps": 30, "gapFrames": 30, "segmentFrames": 180 },
      "sets": [
        {
          "id": "top-flat-empty", "family": "top", "mode": "flat", "kind": "single", "variant": "empty",
          "segments": [
            { "frame": "empty/frame.png", "box": "empty/frame.box.json", "expected": "empty/expected.json",
              "frames": 30, "jitter": 0, "jitterSeed": 1 }
          ]
        }
      ]
    }
    """

// One drawn checkered square on grey with its stored mask (a synthetic item, no real frames).
private const val SQUARE_INDEX =
    """
    {
      "playback": { "fps": 30, "gapFrames": 30, "segmentFrames": 180 },
      "sets": [
        {
          "id": "top-flat-square-good", "family": "generic", "mode": "flat", "kind": "single", "variant": "good",
          "segments": [
            { "frame": "square/frame.png", "box": "square/frame.box.json", "mask": "square/frame.mask.png",
              "expected": "square/expected.json", "frames": 60, "jitter": 0, "jitterSeed": 1 }
          ]
        }
      ]
    }
    """

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SweepRunnerTest {
    @get:Rule
    val folder = TemporaryFolder()

    private fun emptySet(): Pair<FrameIndex, FrameSet> {
        folder.newFile(FrameIndex.INDEX_FILE).writeText(EMPTY_INDEX)
        val dir = File(folder.root, "empty").apply { mkdirs() }
        File(dir, "frame.box.json").writeText("""{ "objects": [] }""")
        val bitmap = Bitmap.createBitmap(48, 64, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.GRAY) }
        File(dir, "frame.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val index = requireNotNull(FrameIndex.load(folder.root))
        return index to index.sets.single()
    }

    @Test
    fun `with the screen-reader flag a locked set shows Take photo anyway at once`() {
        val (index, set) = emptySet()
        FrameAnalyzer(index, BoxSource.STORED, PoseSource.KEYPOINTS).use { analyzer ->
            val line = SweepRunner(index, analyzer, isScreenReader = true).run(set).single().toJson()

            assertEquals(0L, line.getLong("anywayAtMs"))
        }
    }

    @Test
    fun `without it Take photo anyway waits for the anyway delay`() {
        val (index, set) = emptySet()
        FrameAnalyzer(index, BoxSource.STORED, PoseSource.KEYPOINTS).use { analyzer ->
            val line = SweepRunner(index, analyzer).run(set).single().toJson()

            assertEquals(10_000L, line.getLong("anywayAtMs"))
        }
    }

    private fun squareSet(): Pair<FrameIndex, FrameSet> {
        folder.newFile(FrameIndex.INDEX_FILE).writeText(SQUARE_INDEX)
        val dir = File(folder.root, "square").apply { mkdirs() }
        File(dir, "frame.box.json").writeText("""{ "objects": [] }""")
        val frame = Bitmap.createBitmap(SIDE_W, SIDE_H, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.GRAY) }
        val mask = Bitmap.createBitmap(SIDE_W, SIDE_H, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.BLACK) }
        for (y in SQUARE_FROM until SQUARE_TO) {
            for (x in SQUARE_FROM until SQUARE_TO) {
                frame.setPixel(x, y, if ((x / CHECK + y / CHECK) % 2 == 0) Color.BLACK else Color.WHITE)
                mask.setPixel(x, y, Color.WHITE)
            }
        }
        File(dir, "frame.png").outputStream().use { frame.compress(Bitmap.CompressFormat.PNG, 100, it) }
        File(dir, "frame.mask.png").outputStream().use { mask.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val index = requireNotNull(FrameIndex.load(folder.root))
        return index to index.sets.single()
    }

    @Test
    fun `stored masks at the live cadence unlock a still item and score its outline`() {
        val (index, set) = squareSet()
        FrameAnalyzer(index, BoxSource.STORED, PoseSource.KEYPOINTS, MaskSource.STORED).use { analyzer ->
            val line = SweepRunner(index, analyzer, maskCadenceMs = CADENCE_MS).run(set).single().toJson()

            assertEquals(CADENCE_MS, line.getInt("maskCadenceMs"))
            assertTrue(line.getLong("firstUnlockMs") <= MAX_UNLOCK_MS)
            assertTrue(line.getInt("outlineUpdates") >= 1)
            assertTrue(line.getBoolean("outlinePresentAtEnd"))
            assertTrue(line.getDouble("outlineIouMin") >= MIN_OUTLINE_IOU)
        }
    }

    private companion object {
        const val SIDE_W = 48
        const val SIDE_H = 64
        const val SQUARE_FROM = 12
        const val SQUARE_TO = 36
        const val CHECK = 3
        const val CADENCE_MS = 250
        const val MAX_UNLOCK_MS = 3_000L
        const val MIN_OUTLINE_IOU = 0.9
    }
}
