package app.aistylist.feature.capture.debug

import android.graphics.Bitmap
import android.graphics.Color
import org.junit.Assert.assertEquals
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
}
