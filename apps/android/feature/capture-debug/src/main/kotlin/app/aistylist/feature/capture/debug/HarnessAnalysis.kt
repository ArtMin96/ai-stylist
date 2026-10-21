package app.aistylist.feature.capture.debug

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
        files.probe.parentFile?.mkdirs()
        files.probe.writeText(result.report.toString(2))
        return FrameAnalyzer(index, result.boxes, result.pose)
    }
}
