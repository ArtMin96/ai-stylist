package app.aistylist.feature.capture.debug

import app.aistylist.feature.capture.domain.AnywayReason
import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CaptureTrigger
import app.aistylist.feature.capture.domain.LiveOutline
import app.aistylist.feature.capture.domain.LockPhase
import app.aistylist.feature.capture.domain.NormalizedPoint
import app.aistylist.feature.capture.domain.centredOutline
import app.aistylist.feature.capture.domain.polygonIou
import app.aistylist.feature.capture.domain.polygonMaskIou
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * What the results log keeps of one camera state: the lock phase, hint, shutter and anyway button,
 * and the anyway reason line while the button shows.
 */
data class StepState(
    val phase: LockPhase,
    val hint: String?,
    val shutter: String,
    val isAnywayVisible: Boolean,
    val lockReason: String?,
    val anywayReason: String? = null,
) {
    companion object {
        fun of(snapshot: CameraSnapshot): StepState =
            StepState(
                phase = snapshot.phase,
                hint = snapshot.hint?.value,
                shutter = snapshot.shutter.name.lowercase(),
                isAnywayVisible = snapshot.isAnywayVisible,
                lockReason = snapshot.lockReason?.value,
                anywayReason = snapshot.anywayReason?.wire,
            )
    }
}

/** The reason line as the results log writes it: `surface-tip`, `try-hanger-mode` or the hint's test ID. */
val AnywayReason.wire: String
    get() =
        when (this) {
            AnywayReason.NoItemSurfaceTip -> "surface-tip"
            AnywayReason.TryHangerMode -> "try-hanger-mode"
            is AnywayReason.Hint -> hint.value
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
    private val masks: MaskPlay = MaskPlay(),
    /** The outline already drawn when the segment starts: it belongs to the previous segment's mask. */
    drawnBefore: LiveOutline? = null,
) {
    private val outline = OutlineScores(drawnBefore)
    private var outlineFirstMs: Long? = null
    private var outlinePresentAtEnd = false

    private val events = JSONArray()
    private val captures = JSONArray()
    private var last: StepState? = null
    private var firstUnlockMs: Long? = null
    private var anywayAtMs: Long? = null
    private var hintAtUnlock: String? = null
    private var anywayReason: String? = null
    private val hintsSeen = LinkedHashSet<String>()

    /**
     * Records [state] at [nowMs] if it differs from the last one. The anyway reason is kept apart (the
     * last one seen), so a reason change alone adds no event.
     */
    fun onState(
        state: StepState,
        nowMs: Long,
    ) {
        state.anywayReason?.let { anywayReason = it }
        val visible = state.copy(anywayReason = null)
        if (visible == last) return
        val previous = last
        last = visible
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

    /**
     * The drawn outline after a frame at [nowMs]: each new one is scored against the stored item mask
     * ([reference], the frame moved by [offset]).
     */
    fun onOutline(
        drawn: LiveOutline?,
        reference: OutlineReference?,
        offset: FrameOffset,
        nowMs: Long,
    ) {
        outlinePresentAtEnd = drawn != null
        if (drawn == null || !outline.isNew(drawn)) return
        if (outlineFirstMs == null) outlineFirstMs = nowMs - startMs
        outline.add(drawn, reference, offset)
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
            .put("masks", masks.source.id)
            .put("maskCadenceMs", masks.cadenceMs)
            .put("outlineFirstMs", outlineFirstMs ?: JSONObject.NULL)
            .put("outlinePresentAtEnd", outlinePresentAtEnd)
            .also(outline::write)
            .put("pose", pose.id)
            .put("events", events)
            .put("firstUnlockMs", firstUnlockMs ?: JSONObject.NULL)
            .put("hintAtUnlock", hintAtUnlock ?: JSONObject.NULL)
            .put("anywayAtMs", anywayAtMs ?: JSONObject.NULL)
            .put("anywayReason", anywayReason ?: JSONObject.NULL)
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

    /** Live-mask runs only: one line per image the LiteRT segmenter ran on (latency, IoU). */
    val segmenter: File get() = File(dir, SEGMENTER)

    /** Starts a fresh results file (a new sweep or a new frame-set launch). */
    fun reset() {
        dir.mkdirs()
        results.delete()
        done.delete()
        segmenter.delete()
    }

    fun appendSegmenter(line: JSONObject) {
        dir.mkdirs()
        segmenter.appendText(line.toString() + "\n")
    }

    fun append(line: JSONObject) {
        dir.mkdirs()
        results.appendText(line.toString() + "\n")
    }

    companion object {
        const val RESULTS: String = "capture-results.jsonl"
        const val DONE: String = "capture-results.done"
        const val PROBE: String = "capture-probe.json"
        const val SEGMENTER: String = "capture-segmenter.jsonl"
    }
}

/** How masks were played: their source and cadence (`captureMaskCadenceMs`; 0 = a fresh mask on every frame). */
data class MaskPlay(
    val source: MaskSource = MaskSource.NONE,
    val cadenceMs: Int = 0,
)

/** The stored item mask a drawn outline is scored against: one mask per stored instance. */
class OutlineReference(
    val width: Int,
    val height: Int,
    val instances: List<BooleanArray>,
)

/**
 * The live outline's scores over one segment, as iOS logs them: updates and snaps, the IoU of each
 * drawn outline with the stored item mask (best instance, raw mask), and the centroid-aligned IoU of
 * each blended outline with the one before it (snaps excluded). An outline still drawn from the
 * previous segment is the comparison base only, never scored.
 */
private class OutlineScores(
    private var last: LiveOutline?,
) {
    private var updates = 0
    private var snaps = 0
    private val ious = ArrayList<Double>()
    private val stabilities = ArrayList<Double>()

    fun isNew(drawn: LiveOutline): Boolean = drawn != last

    fun add(
        drawn: LiveOutline,
        reference: OutlineReference?,
        offset: FrameOffset,
    ) {
        updates++
        val previous = last
        if (previous != null) {
            if (drawn.snapCount != previous.snapCount) {
                snaps++
            } else {
                stabilities += polygonIou(centredOutline(drawn.points), centredOutline(previous.points))
            }
        }
        if (reference != null) {
            // The stored mask is unmoved: move the outline back by the frame's jitter instead.
            val unmoved = drawn.points.map { NormalizedPoint(it.x - offset.dx, it.y - offset.dy) }
            reference.instances
                .maxOfOrNull { polygonMaskIou(unmoved, reference.width, reference.height, it) }
                ?.let(ious::add)
        }
        last = drawn
    }

    fun write(json: JSONObject) {
        json
            .put("outlineUpdates", updates)
            .put("outlineSnaps", snaps)
            .put("outlineIouMedian", median(ious) ?: JSONObject.NULL)
            .put("outlineIouMin", ious.minOrNull() ?: JSONObject.NULL)
            .put("outlineStabilityMedian", median(stabilities) ?: JSONObject.NULL)
            .put("outlineStabilityMin", stabilities.minOrNull() ?: JSONObject.NULL)
    }

    private fun median(values: List<Double>): Double? {
        if (values.isEmpty()) return null
        val sorted = values.sorted()
        val middle = sorted.size / 2
        return if (sorted.size % 2 == 1) sorted[middle] else (sorted[middle - 1] + sorted[middle]) / 2
    }
}
