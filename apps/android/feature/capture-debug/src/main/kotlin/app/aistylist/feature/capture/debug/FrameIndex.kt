package app.aistylist.feature.capture.debug

import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import org.json.JSONObject
import java.io.File

/** One played image: [frames] frames at the index's fps, moved by up to [jitter] of the frame each frame. */
data class FrameSegment(
    val frame: String,
    val box: String,
    val keypoints: String?,
    val expected: String,
    val frames: Int,
    val jitter: Double,
    val jitterSeed: Long,
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
                            jitterSeed = segment.optLong("jitterSeed", 0L),
                        )
                    },
            )
        }
    }
}
