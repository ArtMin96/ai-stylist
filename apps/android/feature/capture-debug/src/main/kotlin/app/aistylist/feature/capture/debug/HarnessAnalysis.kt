package app.aistylist.feature.capture.debug

import app.aistylist.feature.capture.camera.LiteRtGarmentSegmenter
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * The harness's one frame analyzer, built on first use: the probe runs then (ML Kit on a few stored
 * frames, blocking, so on [dispatcher]) and its report is written to `capture-probe.json`. Calls are
 * serialised: the analyzer and its caches are not thread-safe.
 */
class HarnessAnalysis(
    val index: FrameIndex,
    private val args: CaptureHarnessArgs,
    private val files: ResultsFiles,
    private val dispatcher: CoroutineDispatcher,
    /** Loads the real LiteRT segmenter (live masks); null when it cannot load. */
    private val loadSegmenter: () -> LiteRtGarmentSegmenter? = { null },
) {
    private val mutex = Mutex()
    private var analyzer: FrameAnalyzer? = null

    /** The probe's result once it ran; null before. */
    @Volatile
    var probe: ProbeResult? = null
        private set

    suspend fun <T> use(block: (FrameAnalyzer) -> T): T =
        withContext(dispatcher) {
            mutex.withLock { block(analyzer ?: create().also { analyzer = it }) }
        }

    private fun create(): FrameAnalyzer {
        val result = DetectorProbe.run(index, args)
        probe = result
        val segmenter = lazy(loadSegmenter)
        if (args.masks == MaskSource.LIVE) result.report.put("segmenterLoads", segmenter.value != null)
        result.report.put("masksUsed", args.masks.id).put("coveredUsed", args.covered.id)
        files.probe.parentFile?.mkdirs()
        files.probe.writeText(result.report.toString(2))
        return FrameAnalyzer(
            index,
            result.boxes,
            result.pose,
            args.masks,
            args.covered,
            segmenter,
            files::appendSegmenter,
        )
    }
}
