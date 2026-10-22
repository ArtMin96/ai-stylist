package app.aistylist.feature.capture.camera

import app.aistylist.contracts.kernel.CaptureRules
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * When the garment segmenter runs (capture brief §3, the iOS mask cadence): one inference in flight,
 * on the newest frame only, at most every mask interval, and once a second while the phone is hot
 * (thermal status moderate or worse). The analysis thread asks [tryStart]; the segmenter thread
 * calls [finish]. Thread-safe.
 */
class MaskCadence {
    private val isRunning = AtomicBoolean(false)
    private val lastStartMs = AtomicLong(NEVER)

    /** True, and the run counts as started, when nothing is in flight and the interval has passed. */
    fun tryStart(
        nowMs: Long,
        isHot: Boolean,
    ): Boolean {
        val last = lastStartMs.get()
        val interval = if (isHot) HOT_INTERVAL_MS else CaptureRules.Ios.MASK_INTERVAL_MS.toLong()
        if (last != NEVER && nowMs - last < interval) return false
        if (!isRunning.compareAndSet(false, true)) return false
        lastStartMs.set(nowMs)
        return true
    }

    /** The started run ended, with or without a mask. */
    fun finish() {
        isRunning.set(false)
    }

    companion object {
        /** Once a second while the phone is hot. */
        const val HOT_INTERVAL_MS: Long = 1_000L
        private const val NEVER = Long.MIN_VALUE
    }
}
