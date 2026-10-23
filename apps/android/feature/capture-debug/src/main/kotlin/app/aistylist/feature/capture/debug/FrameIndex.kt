package app.aistylist.feature.capture.debug

import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import org.json.JSONObject
import java.io.File

/**
 * One played image: [frames] frames at the index's fps. A jittered segment moves frame `n` by
 * `offsets[n % offsets.size]`, the generator's checked path (each within ±[jitter] of the frame);
 * empty [offsets] mean no movement. [tiltDegrees] is the phone's tilt during the segment (the tilt
 * hint, flat mode); null means no phone sensors, as on the emulator.
 */
data class FrameSegment(
    val frame: String,
    val box: String,
    val keypoints: String?,
    val expected: String,
    val frames: Int,
    val jitter: Double,
    val offsets: List<FrameOffset> = emptyList(),
    val tiltDegrees: Double? = null,
    /** The generator's Vision foreground mask (`frame.mask.png`: 0 background, 255 foreground). */
    val mask: String? = null,
    /** Two or more instances only: the label PNG (0 background, 1 the largest, 2 the next, …). */
    val instances: String? = null,
)

/** One frame set of `artifacts/capture-camera/frames/index.json` (tools/capture-frames/README.md). */
data class FrameSet(
    val id: String,
    val family: CaptureShapeFamily,
    val mode: CaptureMode,
    /** `single`, `sweep` or `batch`. */
    val kind: String,
    val variant: String,
    val segments: List<FrameSegment>,
) {
    val isBatch: Boolean get() = kind == "batch"
}

/** The frames folder: [root] holds `index.json` and every path in it. */
class FrameIndex(
    val root: File,
    val fps: Int,
    val sets: List<FrameSet>,
) {
    fun file(path: String): File = File(root, path)

    fun set(id: String): FrameSet? = sets.firstOrNull { it.id == id }

    companion object {
        const val INDEX_FILE: String = "index.json"

        /** Reads [root]/index.json; null when it is missing or not the layout this harness knows. */
        fun load(root: File): FrameIndex? {
            val file = File(root, INDEX_FILE)
            if (!file.isFile) return null
            val json = JSONObject(file.readText())
            val fps = json.getJSONObject("playback").getInt("fps")
            val sets = json.getJSONArray("sets")
            return FrameIndex(root, fps, (0 until sets.length()).mapNotNull { parseSet(sets.getJSONObject(it)) })
        }

        /** The segment's `offsets`: `[dx, dy]` pairs, shares of the frame. */
        private fun parseOffsets(segment: JSONObject): List<FrameOffset> {
            val offsets = segment.optJSONArray("offsets") ?: return emptyList()
            return (0 until offsets.length()).map { index ->
                val pair = offsets.getJSONArray(index)
                FrameOffset(dx = pair.getDouble(0), dy = pair.getDouble(1))
            }
        }

        private fun parseSet(json: JSONObject): FrameSet? {
            val family = CaptureShapeFamily.fromValue(json.getString("family")) ?: return null
            val mode = CaptureMode.fromValue(json.getString("mode")) ?: return null
            val segments = json.getJSONArray("segments")
            return FrameSet(
                id = json.getString("id"),
                family = family,
                mode = mode,
                kind = json.getString("kind"),
                variant = json.optString("variant"),
                segments =
                    (0 until segments.length()).map { index ->
                        val segment = segments.getJSONObject(index)
                        FrameSegment(
                            frame = segment.getString("frame"),
                            box = segment.getString("box"),
                            keypoints = segment.optString("keypoints").takeIf { it.isNotEmpty() },
                            expected = segment.getString("expected"),
                            frames = segment.getInt("frames"),
                            jitter = segment.optDouble("jitter", 0.0),
                            offsets = parseOffsets(segment),
                            tiltDegrees = segment.optDouble("tiltDegrees").takeUnless { it.isNaN() },
                            mask = segment.optString("mask").takeIf { it.isNotEmpty() },
                            instances = segment.optString("instances").takeIf { it.isNotEmpty() },
                        )
                    },
            )
        }
    }
}
