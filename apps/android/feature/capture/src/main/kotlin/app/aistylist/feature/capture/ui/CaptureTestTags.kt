package app.aistylist.feature.capture.ui

import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.feature.capture.domain.ShutterState
import app.aistylist.feature.capture.domain.UnderwearPick

/**
 * Test IDs (capture brief §10): the Android `testTag`, exposed as resource ids for Maestro, equal to
 * the iOS accessibility identifiers. The hint label's ID is the hint key itself (`CaptureHint.value`)
 * and the guide's is `CameraContext.guideTestTag`.
 */
object CaptureTestTags {
    const val SCREEN_PICKER: String = "cap-screen-picker"
    const val SCREEN_CAMERA: String = "cap-screen-camera"
    const val SCREEN_REVIEW: String = "cap-screen-review"
    const val SCREEN_IMPORT_TIPS: String = "cap-screen-import-tips"
    const val SCREEN_BATCH_SUMMARY: String = "cap-screen-batch-summary"
    const val SCREEN_PERMISSION: String = "cap-screen-permission"
    const val SCREEN_NO_CAMERA: String = "cap-screen-no-camera"

    const val PICKER_CLOSE: String = "cap-picker-close"
    const val PICKER_UNDERWEAR: String = "cap-picker-family-underwear"
    const val PICKER_NOT_SURE: String = "cap-picker-not-sure"
    const val PICKER_BATCH: String = "cap-picker-batch"
    const val PICKER_IMPORT: String = "cap-picker-import"

    const val OPTIN_SHEET: String = "cap-optin-sheet"
    const val OPTIN_FLAT_ONLY: String = "cap-optin-flat-only"
    const val OPTIN_ALLOW_WORN: String = "cap-optin-allow-worn"

    const val CAMERA_CLOSE: String = "cap-camera-close"
    const val CAMERA_HELP: String = "cap-camera-help"
    const val CAMERA_TORCH: String = "cap-camera-torch"
    const val CAMERA_SPEECH: String = "cap-camera-speech"
    const val CAMERA_IMPORT: String = "cap-camera-import"
    const val CAMERA_SKIP_BACK: String = "cap-camera-skip-back"
    const val CAMERA_UNDERWEAR_WORN_TOGGLE: String = "cap-camera-underwear-worn-toggle"

    /** Proposed on the SC16 board (the brief names only the toggle inside the menu). */
    const val CAMERA_MENU: String = "cap-camera-menu"

    /** Proposed: the help sheet opened by [CAMERA_HELP] (the brief names only the button). */
    const val HELP_SHEET: String = "cap-help-sheet"

    const val STEP_BACK: String = "cap-step-back"
    const val STEP_PAIR: String = "cap-step-pair"
    const val RING: String = "cap-ring"

    /** The live outline of the item; its state description is `locked` or `unlocked` (capture brief "Live outline"). */
    const val OUTLINE: String = "cap-outline"
    const val ANYWAY_BUTTON: String = "cap-anyway-button"
    const val ANYWAY_REASON: String = "cap-anyway-reason"

    const val BATCH_COUNT: String = "cap-batch-count"
    const val BATCH_NEXT: String = "cap-batch-next"
    const val BATCH_DONE: String = "cap-batch-done"

    /** Proposed on the SC20 board (the brief gives the summary's "Done" no ID). */
    const val BATCH_SUMMARY_DONE: String = "cap-batch-summary-done"

    const val REVIEW_PHOTO_FRONT: String = "cap-review-photo-front"
    const val REVIEW_PHOTO_BACK: String = "cap-review-photo-back"
    const val REVIEW_BACK_SAME: String = "cap-review-back-same"
    const val REVIEW_BACK_DIFFERENT: String = "cap-review-back-different"
    const val REVIEW_DONE: String = "cap-review-done"
    const val REVIEW_TAKE_BACK: String = "cap-review-take-back"
    const val REVIEW_RETAKE: String = "cap-review-retake"

    const val IMPORT_KEEP_ANYWAY: String = "cap-import-keep-anyway"
    const val IMPORT_CHOOSE_ANOTHER: String = "cap-import-choose-another"

    const val PERMISSION_SETTINGS: String = "cap-permission-settings"

    /** Also the no-camera screen's import button (SC20 board: reuse, the brief gives it no own ID). */
    const val PERMISSION_IMPORT: String = "cap-permission-import"

    fun pickerFamily(family: CaptureShapeFamily): String = "cap-picker-family-${family.value}"

    fun underwearPick(pick: UnderwearPick): String =
        "cap-picker-underwear-" +
            when (pick) {
                UnderwearPick.BRA_OR_TOP -> "top"
                UnderwearPick.BRIEFS_OR_BOTTOMS -> "bottoms"
                UnderwearPick.SWIMSUIT_OR_BODYSUIT -> "swimsuit"
                UnderwearPick.TIGHTS -> "tights"
                UnderwearPick.SOCKS -> "socks"
            }

    fun mode(mode: CaptureMode): String = "cap-mode-${mode.value}"

    fun shutter(state: ShutterState): String = "cap-shutter-${state.name.lowercase()}"

    /** `cap-import-tip-<hint key>`: the hint key without its `cap-hint-` prefix. */
    fun importTip(hintKey: String): String = "cap-import-tip-${hintKey.removePrefix("cap-hint-")}"
}
