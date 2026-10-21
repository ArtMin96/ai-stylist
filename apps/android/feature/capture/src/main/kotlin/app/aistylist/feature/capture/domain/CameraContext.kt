package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily

/** Which side of the item a camera step photographs (capture brief §4, §7). */
enum class CaptureSide { FRONT, BACK, PAIR }

/** One item at a time, or batch mode (capture brief §7, Q16). */
enum class CaptureFlowKind { SINGLE, BATCH }

/** What one camera step is photographing; the rules and the guide outline read it. */
data class CameraContext(
    val family: CaptureShapeFamily,
    val mode: CaptureMode,
    val side: CaptureSide = CaptureSide.FRONT,
    val kind: CaptureFlowKind = CaptureFlowKind.SINGLE,
) {
    /** The guide outline's test ID, `cap-guide-<family>-<mode>[-back|-pair]` (capture brief §10). */
    val guideTestTag: String
        get() {
            val suffix =
                when (side) {
                    CaptureSide.FRONT -> ""
                    CaptureSide.BACK -> "-back"
                    CaptureSide.PAIR -> "-pair"
                }
            return "cap-guide-${family.value}-${mode.value}$suffix"
        }
}
