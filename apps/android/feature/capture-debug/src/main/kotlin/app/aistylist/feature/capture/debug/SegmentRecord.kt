package app.aistylist.feature.capture.debug

import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CaptureTrigger
import app.aistylist.feature.capture.domain.LockPhase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** What the results log keeps of one camera state: the lock phase, hint, shutter and anyway button. */
data class StepState(
    val phase: LockPhase,
    val hint: String?,
    val shutter: String,
    val isAnywayVisible: Boolean,
    val lockReason: String?,
) {
    companion object {
        fun of(snapshot: CameraSnapshot): StepState =
            StepState(
                phase = snapshot.phase,
                hint = snapshot.hint?.value,
                shutter = snapshot.shutter.name.lowercase(),
                isAnywayVisible = snapshot.isAnywayVisible,
                lockReason = snapshot.lockReason?.value,
            )
    }
}

/**
 * One segment's line in `capture-results.jsonl` (capture brief §11): the set, every state change with
 * its time from the segment's first frame, the first unlock, when "Take photo anyway" showed, the
 * captures and the final state. The recipes compare it with the segment's `expected` file.
 */
class SegmentRecord(
    private val set: FrameSet,
    private val segmentIndex: Int,
    private val startMs: Long,
    private val clock: String,
    private val detector: BoxSource,
    private val pose: PoseSource,
) {
    private val events = JSONArray()
    private val captures = JSONArray()
    private var last: StepState? = null
    private var firstUnlockMs: Long? = null
    private var anywayAtMs: Long? = null
    private var hintAtUnlock: String? = null
    private val hintsSeen = LinkedHashSet<String>()

    /** Records [state] at [nowMs] if it differs from the last one. */
    fun onState(
        state: StepState,
        nowMs: Long,
    ) {
        if (state == last) return
        val previous = last
        last = state
        val t = nowMs - startMs
        if (previous == null && state.isAnywayVisible) anywayAtMs = 0
        if (state.isAnywayVisible && previous?.isAnywayVisible == false) anywayAtMs = anywayAtMs ?: t
        if (state.phase == LockPhase.UNLOCKED && firstUnlockMs == null) {
            firstUnlockMs = t
            hintAtUnlock = state.hint
        }
        state.hint?.let(hintsSeen::add)
        events.put(
            JSONObject()
                .put("tMs", t)
                .put("phase", state.phase.wire)
                .put("hint", state.hint ?: JSONObject.NULL)
                .put("shutter", state.shutter)
                .put("anyway", state.isAnywayVisible),
        )
    }

    fun onCapture(
        trigger: CaptureTrigger,
        nowMs: Long,
    ) {
        captures.put(JSONObject().put("tMs", nowMs - startMs).put("trigger", trigger.name.lowercase()))
    }

    fun toJson(): JSONObject {
        val segment = set.segments[segmentIndex]
        val final = last
        return JSONObject()
            .put("platform", "android")
            .put("clock", clock)
            .put("setId", set.id)
            .put("family", set.family.value)
            .put("mode", set.mode.value)
            .put("kind", set.kind)
            .put("variant", set.variant)
            .put("segment", segmentIndex)
            .put("expected", segment.expected)
            .put("detector", detector.id)
            .put("pose", pose.id)
            .put("events", events)
            .put("firstUnlockMs", firstUnlockMs ?: JSONObject.NULL)
            .put("hintAtUnlock", hintAtUnlock ?: JSONObject.NULL)
            .put("anywayAtMs", anywayAtMs ?: JSONObject.NULL)
            .put("hintsSeen", JSONArray(hintsSeen.toList()))
            .put("captures", captures)
            .put("finalPhase", final?.phase?.wire ?: JSONObject.NULL)
            .put("finalHint", final?.hint ?: JSONObject.NULL)
            .put("finalShutter", final?.shutter ?: JSONObject.NULL)
            .put("finalLockReason", final?.lockReason ?: JSONObject.NULL)
    }
}

/** The lock phase as the results log writes it. */
val LockPhase.wire: String get() = name.lowercase().replace('_', '-')

/** The harness's output files, in the app's external files folder (`adb pull` needs no `run-as`). */
class ResultsFiles(
    private val dir: File,
) {
    val results: File get() = File(dir, RESULTS)

    /** Written when a sweep has finished every set: the recipe waits for it. */
    val done: File get() = File(dir, DONE)

    val probe: File get() = File(dir, PROBE)

    /** Starts a fresh results file (a new sweep or a new frame-set launch). */
    fun reset() {
        dir.mkdirs()
        results.delete()
        done.delete()
    }

    fun append(line: JSONObject) {
        dir.mkdirs()
        results.appendText(line.toString() + "\n")
    }

    companion object {
        const val RESULTS: String = "capture-results.jsonl"
        const val DONE: String = "capture-results.done"
        const val PROBE: String = "capture-probe.json"
    }
}
