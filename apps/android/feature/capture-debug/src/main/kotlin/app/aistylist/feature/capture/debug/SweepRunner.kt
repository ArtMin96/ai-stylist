package app.aistylist.feature.capture.debug

import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CaptureCameraSession
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureEffect
import app.aistylist.feature.capture.domain.CaptureFlowKind
import kotlin.math.max

/**
 * The sweep (`captureSweep=1`, capture brief §11): every frame set through the same analysis and the
 * same camera session (live checks, lock machine, timers, hints) on a virtual clock, so 500 sets take
 * minutes, not hours. Frames arrive at the index's fps and the session ticks at the evaluation
 * interval, as on screen. A capture is recorded, not shown, and the camera carries on. The last
 * segment plays until "Take photo anyway" is due plus a margin. One results line per segment.
 */
class SweepRunner(
    private val index: FrameIndex,
    private val analyzer: FrameAnalyzer,
    /** The screen-reader flag (`captureScreenReader=1`): "Take photo anyway" shows at once (C25). */
    private val isScreenReader: Boolean = false,
    /**
     * A new mask every this many ms, reused by the frames in between, as the phone's segmenter
     * cadence (`captureMaskCadenceMs`); 0 gives every frame a fresh mask.
     */
    private val maskCadenceMs: Int = 0,
) {
    /** Runs [set] and returns its segments' records. */
    fun run(set: FrameSet): List<SegmentRecord> {
        var now = 0L
        val clock = CaptureClock { now }
        val kind = if (set.isBatch) CaptureFlowKind.BATCH else CaptureFlowKind.SINGLE
        val session =
            CaptureCameraSession(
                CameraContext(set.family, set.mode, kind = kind),
                clock,
                isScreenReaderOn = isScreenReader,
            )
        val frameMs = MS_PER_SECOND.toDouble() / index.fps
        val records = mutableListOf<SegmentRecord>()
        var nextTickMs = CaptureRules.Evaluation.INTERVAL_MS.toLong()
        session.cameraReady()
        var mask: MaskSample? = null
        set.segments.forEachIndexed { segmentIndex, segment ->
            val startMs = now
            // A new image is a new scene: its first frame takes a mask at once, then the cadence runs.
            mask = null
            val record =
                SegmentRecord(
                    set,
                    segmentIndex,
                    startMs,
                    CLOCK,
                    analyzer.boxes,
                    analyzer.pose,
                    MaskPlay(analyzer.masks, maskCadenceMs),
                    drawnBefore = session.snapshot.outline,
                )
            records += record
            record.onState(StepState.of(session.snapshot), now)
            val endMs = startMs + playMs(set, segmentIndex, segment.frames, frameMs)
            var frameNumber = 0
            while (true) {
                val frameAt = startMs + (frameNumber * frameMs).toLong()
                if (frameAt >= endMs) break
                // Ticks strictly before the frame: a frame stamped at the same instant is the newest
                // detector result then, so the tick after it reads it (as iOS evaluates a frame when it
                // arrives). With ticks first, a tick at 800 ms read the 766 ms frame and its older mask,
                // and every sweep unlock came one evaluation later than on iOS (900 vs 800 ms).
                while (nextTickMs < frameAt) {
                    now = nextTickMs
                    handle(session, session.tick(), record, kind, clock)
                    nextTickMs += CaptureRules.Evaluation.INTERVAL_MS
                }
                now = frameAt
                val offset = analyzer.offset(segment, frameNumber)
                val current = mask
                val sample =
                    if (current == null || maskCadenceMs == 0 || now - current.timestampMs >= maskCadenceMs) {
                        MaskSample(segment, offset, now).also { mask = it }
                    } else {
                        current
                    }
                val observation =
                    analyzer.observe(segment, offset, now, withPose = set.mode == CaptureMode.WORN, maskSample = sample)
                handle(session, session.submit(observation), record, kind, clock)
                record.onOutline(
                    session.snapshot.outline,
                    analyzer.outlineReference(sample.segment),
                    sample.offset,
                    now,
                )
                frameNumber++
            }
            now = endMs
        }
        return records
    }

    /** Applies [effects]: a capture is recorded and finished at once; the camera carries on. */
    private fun handle(
        session: CaptureCameraSession,
        effects: List<CaptureEffect>,
        record: SegmentRecord,
        kind: CaptureFlowKind,
        clock: CaptureClock,
    ) {
        record.onState(StepState.of(session.snapshot), clock.nowMs())
        val capture = effects.filterIsInstance<CaptureEffect.RequestCapture>().firstOrNull() ?: return
        record.onCapture(capture.trigger, clock.nowMs())
        session.captureFinished()
        // Single capture leaves the step; the sweep starts it again instead of opening review.
        if (kind == CaptureFlowKind.SINGLE) session.cameraReady()
        record.onState(StepState.of(session.snapshot), clock.nowMs())
    }

    /** A segment plays its frames; the last one also until the anyway delay has passed with a margin. */
    private fun playMs(
        set: FrameSet,
        segmentIndex: Int,
        frames: Int,
        frameMs: Double,
    ): Long {
        val framesMs = (frames * frameMs).toLong()
        val isLast = segmentIndex == set.segments.lastIndex
        return if (isLast) max(framesMs, CaptureRules.Timing.ANYWAY_DELAY_MS + LAST_SEGMENT_MARGIN_MS) else framesMs
    }

    private companion object {
        const val MS_PER_SECOND = 1000L
        const val CLOCK = "virtual"

        /** Long enough to see "Take photo anyway" at 10.0 s ± 0.5 s. */
        const val LAST_SEGMENT_MARGIN_MS = 1500L
    }
}
