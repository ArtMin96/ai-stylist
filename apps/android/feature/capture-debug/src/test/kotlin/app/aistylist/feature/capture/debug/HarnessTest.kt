package app.aistylist.feature.capture.debug

import android.os.Bundle
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CaptureTrigger
import app.aistylist.feature.capture.domain.LockPhase
import app.aistylist.feature.capture.domain.NormalizedRect
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

// A synthetic index in the generator's layout (tools/capture-frames/README.md); no real frames.
private const val INDEX =
    """
    {
      "playback": { "fps": 30, "gapFrames": 30, "segmentFrames": 180 },
      "sets": [
        {
          "id": "top-flat-01-jitter", "family": "top", "mode": "flat", "kind": "single", "variant": "jitter",
          "segments": [
            { "frame": "top/a/frame.png", "box": "top/a/frame.box.json", "expected": "top/a/expected.json",
              "frames": 180, "jitter": 0.06, "jitterSeed": 7 }
          ]
        },
        {
          "id": "top-worn-whole", "family": "top", "mode": "worn", "kind": "single", "variant": "whole",
          "segments": [
            { "frame": "top/w/frame.png", "box": "top/w/frame.box.json", "keypoints": "top/w/frame.keypoints.json",
              "expected": "top/w/expected.json", "frames": 180, "jitter": 0, "jitterSeed": 1 }
          ]
        },
        { "id": "hat-flat-01-good", "family": "hat", "mode": "flat", "kind": "single", "segments": [] }
      ]
    }
    """

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class HarnessTest {
    @get:Rule
    val folder = TemporaryFolder()

    @Test
    fun `launch extras select the frame set, the screen-reader flag, the sweep and the sources`() {
        val extras =
            Bundle().apply {
                putString(CaptureHarnessArgs.FRAME_SET, "top-flat-01-good")
                putString(CaptureHarnessArgs.SCREEN_READER, "1")
                putString(CaptureHarnessArgs.BOXES, "live")
                putString(CaptureHarnessArgs.DEBUG_PANEL, "0")
            }

        val args = CaptureHarnessArgs.from(extras)

        assertEquals("top-flat-01-good", args.frameSetId)
        assertTrue(args.isScreenReader)
        assertFalse(args.isSweep)
        assertEquals(BoxSource.LIVE, args.boxes)
        assertEquals(PoseSource.AUTO, args.pose)
        assertFalse(args.showsPanel)
        assertEquals(CaptureHarnessArgs(), CaptureHarnessArgs.from(null))
    }

    @Test
    fun `the index reads every set it knows and skips unknown families`() {
        folder.newFile(FrameIndex.INDEX_FILE).writeText(INDEX)

        val index = requireNotNull(FrameIndex.load(folder.root))

        assertEquals(30, index.fps)
        assertEquals(listOf("top-flat-01-jitter", "top-worn-whole"), index.sets.map { it.id })
        val worn = requireNotNull(index.set("top-worn-whole"))
        assertEquals(CaptureMode.WORN, worn.mode)
        assertEquals("top/w/frame.keypoints.json", worn.segments.single().keypoints)
        assertNull(
            index
                .set("top-flat-01-jitter")
                ?.segments
                ?.single()
                ?.keypoints,
        )
        assertNull(FrameIndex.load(folder.newFolder("empty")))
    }

    @Test
    fun `jitter is repeatable per frame and stays within its share`() {
        folder.newFile(FrameIndex.INDEX_FILE).writeText(INDEX)
        val index = requireNotNull(FrameIndex.load(folder.root))
        val analyzer = FrameAnalyzer(index, BoxSource.STORED, PoseSource.KEYPOINTS)
        val jittered =
            index.sets
                .first()
                .segments
                .single()
        val steady = index.sets[1].segments.single()

        val offsets = (0 until 30).map { analyzer.offset(jittered, it) }

        assertEquals(offsets, (0 until 30).map { analyzer.offset(jittered, it) })
        assertTrue(offsets.all { kotlin.math.abs(it.dx) <= 0.06 && kotlin.math.abs(it.dy) <= 0.06 })
        assertTrue(offsets.distinct().size > 1)
        assertEquals(FrameOffset.NONE, analyzer.offset(steady, 5))
    }

    @Test
    fun `a moved box keeps its size`() {
        val moved = NormalizedRect(0.2, 0.2, 0.6, 0.5).moved(FrameOffset(0.1, -0.1))

        assertEquals(0.3, moved.left, 1e-9)
        assertEquals(0.1, moved.top, 1e-9)
        assertEquals(0.4, moved.width, 1e-9)
    }

    @Test
    fun `a segment record logs state changes, the first unlock, anyway and captures`() {
        folder.newFile(FrameIndex.INDEX_FILE).writeText(INDEX)
        val set = requireNotNull(FrameIndex.load(folder.root)).sets.first()
        val record =
            SegmentRecord(
                set,
                0,
                startMs = 1_000,
                clock = "virtual",
                detector = BoxSource.STORED,
                pose = PoseSource.KEYPOINTS,
            )
        val step = CameraContext(CaptureShapeFamily.TOP, CaptureMode.FLAT)

        fun snapshot(
            phase: LockPhase,
            hint: CaptureHint,
            anyway: Boolean = false,
        ) = StepState.of(CameraSnapshot(step, phase, 0.0, hint, hint.lockReason, anyway, null))

        record.onState(snapshot(LockPhase.WARMING_UP, CaptureHint.GUIDE), 1_000)
        record.onState(snapshot(LockPhase.WARMING_UP, CaptureHint.GUIDE), 1_050)
        record.onState(snapshot(LockPhase.LOCKED, CaptureHint.NOT_STEADY), 2_500)
        record.onState(snapshot(LockPhase.LOCKED, CaptureHint.NOT_STEADY, anyway = true), 11_000)
        record.onState(snapshot(LockPhase.UNLOCKED, CaptureHint.READY, anyway = true), 11_300)
        record.onCapture(CaptureTrigger.AUTO, 12_300)
        val json = record.toJson()

        assertEquals(4, json.getJSONArray("events").length())
        assertEquals(10_000L, json.getLong("anywayAtMs"))
        assertEquals(10_300L, json.getLong("firstUnlockMs"))
        assertEquals("cap-hint-ready", json.getString("hintAtUnlock"))
        assertEquals("auto", json.getJSONArray("captures").getJSONObject(0).getString("trigger"))
        assertEquals("unlocked", json.getString("finalPhase"))
        assertEquals("top-flat-01-jitter", json.getString("setId"))
        assertEquals("stored-box", json.getString("detector"))
        assertEquals(JSONObject.NULL, json.get("finalLockReason"))
    }
}
