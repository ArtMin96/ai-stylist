package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily

/** Every tile and every path starts in flat mode (capture brief §2). */
val DEFAULT_CAPTURE_MODE: CaptureMode = CaptureMode.FLAT

/** A captured or imported photo, as the observation source stores it on the device. */
@JvmInline
value class PhotoRef(
    val value: String,
)

/**
 * The one-time underwear and swimwear question (capture brief §7, C19). Off by default: until the
 * user allows it, worn mode is absent for underwear.
 */
enum class WornOptIn {
    NOT_ASKED,
    FLAT_ONLY,
    WORN_ALLOWED,
    ;

    val allowsWorn: Boolean get() = this == WORN_ALLOWED
}

/** The underwear sub-pick and the shape family each one uses (capture brief §2). */
enum class UnderwearPick(
    val family: CaptureShapeFamily,
) {
    BRA_OR_TOP(CaptureShapeFamily.TOP),
    BRIEFS_OR_BOTTOMS(CaptureShapeFamily.SHORT_BOTTOM),
    SWIMSUIT_OR_BODYSUIT(CaptureShapeFamily.ONE_PIECE),
    TIGHTS(CaptureShapeFamily.LONG_BOTTOM),
    SOCKS(CaptureShapeFamily.SMALL_ITEM),
}

/** The review question: "Is the back different?", or "Add a photo of the pair?" for shoes (Q-D). */
enum class SecondPhotoQuestion { BACK, PAIR }

/** Why the camera cannot open (C23). */
enum class CameraUnavailableReason { PERMISSION_DENIED, NO_CAMERA }

/** The picked shape family and mode. Underwear picks use their family's rules (capture brief §3). */
data class CaptureSelection(
    val family: CaptureShapeFamily = CaptureShapeFamily.GENERIC,
    val mode: CaptureMode = DEFAULT_CAPTURE_MODE,
    /** The underwear or swimwear sub-pick; null for any other item. */
    val underwearPick: UnderwearPick? = null,
) {
    val isUnderwear: Boolean get() = underwearPick != null

    /** The family's modes; for underwear, worn only after the opt-in. */
    fun offeredModes(optIn: WornOptIn): List<CaptureMode> =
        if (isUnderwear && !optIn.allowsWorn) family.modes - CaptureMode.WORN else family.modes
}

/** The photos on the review screen. [wantsSecond]: "Different" / "Yes" (default "Same" / "No"). */
data class ReviewPhotos(
    val front: PhotoRef? = null,
    val second: PhotoRef? = null,
    val wantsSecond: Boolean = false,
)

/** The capture screens (capture brief §7, §10). */
sealed interface CaptureScreen {
    /** `cap-screen-picker`. */
    data object Picker : CaptureScreen

    /** `cap-optin-sheet`, over the picker, the first time the underwear tile is tapped. */
    data object WornOptInSheet : CaptureScreen

    /** The underwear sub-pick (`cap-picker-underwear-*`). */
    data object UnderwearPicker : CaptureScreen

    /** `cap-screen-camera` for one step. */
    data class Camera(
        val context: CameraContext,
    ) : CaptureScreen

    /** `cap-screen-review`. */
    data object Review : CaptureScreen

    /** The system photo picker is open; cancelling returns to [returnTo]. */
    data class ImportPicking(
        val returnTo: CaptureScreen,
    ) : CaptureScreen

    /** `cap-screen-import-tips`: one tip per failing check, "Keep anyway" or "Choose another". */
    data class ImportTips(
        val photo: PhotoRef,
        val tips: List<CaptureHint>,
        val returnTo: CaptureScreen,
    ) : CaptureScreen

    /** `cap-screen-batch-summary`. */
    data object BatchSummary : CaptureScreen

    /** `cap-screen-permission`. */
    data object PermissionDenied : CaptureScreen

    /** `cap-screen-no-camera`. */
    data object NoCamera : CaptureScreen

    /** The flow closed; v1 drops every photo (nothing is saved or uploaded). */
    data object Closed : CaptureScreen
}

/**
 * The capture flow (capture brief §2, §7): picker, underwear opt-in and sub-pick, camera steps,
 * review with the back or pair question, batch, and library import. Immutable; an input that does
 * not apply to the current screen returns the same state.
 */
data class CaptureFlowState(
    val screen: CaptureScreen = CaptureScreen.Picker,
    val selection: CaptureSelection = CaptureSelection(),
    val wornOptIn: WornOptIn = WornOptIn.NOT_ASKED,
    val review: ReviewPhotos = ReviewPhotos(),
    val batchPhotos: List<PhotoRef> = emptyList(),
) {
    val secondQuestion: SecondPhotoQuestion
        get() = if (selection.family == CaptureShapeFamily.SHOES) SecondPhotoQuestion.PAIR else SecondPhotoQuestion.BACK

    val offeredModes: List<CaptureMode> get() = selection.offeredModes(wornOptIn)

    /** The family an import is checked against: the camera step's when opened from one, else `generic` (Q17). */
    val importFamily: CaptureShapeFamily
        get() {
            val origin =
                when (val current = screen) {
                    is CaptureScreen.ImportPicking -> current.returnTo
                    is CaptureScreen.ImportTips -> current.returnTo
                    else -> current
                }
            return (origin as? CaptureScreen.Camera)?.context?.family ?: CaptureShapeFamily.GENERIC
        }

    /** A family tile (or "Not sure" → `generic`): the front camera step in the default mode. */
    fun pickFamily(family: CaptureShapeFamily): CaptureFlowState = startSingle(CaptureSelection(family = family))

    fun pickNotSure(): CaptureFlowState = pickFamily(CaptureShapeFamily.GENERIC)

    /** The underwear tile: the opt-in sheet the first time, else the sub-pick. */
    fun pickUnderwear(optIn: WornOptIn): CaptureFlowState {
        val screen = if (optIn == WornOptIn.NOT_ASKED) CaptureScreen.WornOptInSheet else CaptureScreen.UnderwearPicker
        return copy(wornOptIn = optIn, screen = screen)
    }

    /** The opt-in answer ("Flat and hanger only" / "Also allow worn photos"); then the sub-pick. */
    fun answerWornOptIn(allowWorn: Boolean): CaptureFlowState =
        if (screen != CaptureScreen.WornOptInSheet) {
            this
        } else {
            copy(wornOptIn = optInFor(allowWorn), screen = CaptureScreen.UnderwearPicker)
        }

    /** Back or a scrim tap on the opt-in sheet or the sub-pick: the picker again; an unanswered opt-in stays unasked. */
    fun dismissUnderwear(): CaptureFlowState =
        when (screen) {
            CaptureScreen.WornOptInSheet, CaptureScreen.UnderwearPicker -> copy(screen = CaptureScreen.Picker)
            else -> this
        }

    fun pickUnderwearItem(pick: UnderwearPick): CaptureFlowState =
        if (screen != CaptureScreen.UnderwearPicker) {
            this
        } else {
            startSingle(CaptureSelection(family = pick.family, underwearPick = pick))
        }

    /** "Many items (batch)": generic guide, no category, no back question (Q16, Q-C). */
    fun startBatch(): CaptureFlowState =
        copy(
            selection = CaptureSelection(),
            batchPhotos = emptyList(),
            screen =
                CaptureScreen.Camera(
                    CameraContext(CaptureShapeFamily.GENERIC, DEFAULT_CAPTURE_MODE, kind = CaptureFlowKind.BATCH),
                ),
        )

    /** The mode switch; ignored for a mode this family (or the underwear opt-in) does not offer. */
    fun changeMode(mode: CaptureMode): CaptureFlowState {
        if (mode !in offeredModes) return this
        val nextScreen =
            (screen as? CaptureScreen.Camera)?.let { camera -> camera.copy(context = camera.context.copy(mode = mode)) }
        return copy(selection = selection.copy(mode = mode), screen = nextScreen ?: screen)
    }

    /** The camera-menu toggle (`cap-camera-underwear-worn-toggle`); turning it off leaves worn mode. */
    fun setUnderwearWornAllowed(allowed: Boolean): CaptureFlowState {
        val next = copy(wornOptIn = optInFor(allowed))
        return if (!allowed && selection.mode == CaptureMode.WORN) next.changeMode(DEFAULT_CAPTURE_MODE) else next
    }

    /** A photo from the camera step on screen: batch counts it; single goes to review. */
    fun photoCaptured(photo: PhotoRef): CaptureFlowState {
        val camera = screen as? CaptureScreen.Camera ?: return this
        return when {
            camera.context.kind == CaptureFlowKind.BATCH -> {
                copy(batchPhotos = batchPhotos + photo)
            }

            camera.context.side == CaptureSide.FRONT -> {
                copy(
                    review = review.copy(front = photo),
                    screen = CaptureScreen.Review,
                )
            }

            else -> {
                copy(review = review.copy(second = photo), screen = CaptureScreen.Review)
            }
        }
    }

    /** Batch "Done": the local thumbnail list. */
    fun finishBatch(): CaptureFlowState = if (isBatchCamera) copy(screen = CaptureScreen.BatchSummary) else this

    /** "Same"/"No" (false) or "Different"/"Yes" (true). "Same" drops a back photo already taken. */
    fun answerSecondQuestion(wantsSecond: Boolean): CaptureFlowState {
        if (screen != CaptureScreen.Review) return this
        val second = if (wantsSecond) review.second else null
        return copy(review = review.copy(wantsSecond = wantsSecond, second = second))
    }

    /** "Take back photo" / "Take pair photo": the camera with the back or pair guide. */
    fun takeSecondPhoto(): CaptureFlowState {
        if (screen != CaptureScreen.Review || !review.wantsSecond) return this
        val side = if (secondQuestion == SecondPhotoQuestion.PAIR) CaptureSide.PAIR else CaptureSide.BACK
        return copy(screen = CaptureScreen.Camera(cameraContext(side)))
    }

    /** "Skip" on the back or pair step: back to review. */
    fun skipSecondPhoto(): CaptureFlowState {
        val camera = screen as? CaptureScreen.Camera ?: return this
        return if (camera.context.side == CaptureSide.FRONT) this else copy(screen = CaptureScreen.Review)
    }

    /** "Retake": the front step again; its photo replaces the front. */
    fun retake(): CaptureFlowState =
        if (screen !=
            CaptureScreen.Review
        ) {
            this
        } else {
            copy(screen = CaptureScreen.Camera(cameraContext(CaptureSide.FRONT)))
        }

    /** "Import from photos", from the picker, the camera bottom bar or the permission screens. */
    fun openImport(): CaptureFlowState =
        when (screen) {
            CaptureScreen.Picker,
            is CaptureScreen.Camera,
            CaptureScreen.PermissionDenied,
            CaptureScreen.NoCamera,
            -> copy(screen = CaptureScreen.ImportPicking(returnTo = screen))

            else -> this
        }

    fun cancelImport(): CaptureFlowState {
        val picking = screen as? CaptureScreen.ImportPicking ?: return this
        return copy(screen = picking.returnTo)
    }

    /** The picked photo and its import [tips] ([evaluateImportChecks]): straight to review when none fail. */
    fun importPicked(
        photo: PhotoRef,
        tips: List<CaptureHint>,
    ): CaptureFlowState {
        val picking = screen as? CaptureScreen.ImportPicking ?: return this
        return if (tips.isEmpty()) {
            toReview(photo)
        } else {
            copy(screen = CaptureScreen.ImportTips(photo, tips, picking.returnTo))
        }
    }

    fun keepImportAnyway(): CaptureFlowState {
        val tipsScreen = screen as? CaptureScreen.ImportTips ?: return this
        return toReview(tipsScreen.photo)
    }

    fun chooseAnotherImport(): CaptureFlowState {
        val tipsScreen = screen as? CaptureScreen.ImportTips ?: return this
        return copy(screen = CaptureScreen.ImportPicking(returnTo = tipsScreen.returnTo))
    }

    fun cameraUnavailable(reason: CameraUnavailableReason): CaptureFlowState {
        if (screen !is CaptureScreen.Camera) return this
        val next =
            when (reason) {
                CameraUnavailableReason.PERMISSION_DENIED -> CaptureScreen.PermissionDenied
                CameraUnavailableReason.NO_CAMERA -> CaptureScreen.NoCamera
            }
        return copy(screen = next)
    }

    /** Review "Done", the batch summary "Done", or any close button: the flow ends, photos dropped. */
    fun close(): CaptureFlowState =
        copy(screen = CaptureScreen.Closed, review = ReviewPhotos(), batchPhotos = emptyList())

    private val isBatchCamera: Boolean
        get() = (screen as? CaptureScreen.Camera)?.context?.kind == CaptureFlowKind.BATCH

    private fun startSingle(selection: CaptureSelection): CaptureFlowState =
        copy(
            selection = selection,
            review = ReviewPhotos(),
            screen = CaptureScreen.Camera(CameraContext(selection.family, selection.mode)),
        )

    private fun cameraContext(side: CaptureSide): CameraContext = CameraContext(selection.family, selection.mode, side)

    private fun toReview(photo: PhotoRef): CaptureFlowState =
        copy(review = ReviewPhotos(front = photo), screen = CaptureScreen.Review)

    private fun optInFor(allowWorn: Boolean): WornOptIn = if (allowWorn) WornOptIn.WORN_ALLOWED else WornOptIn.FLAT_ONLY
}
