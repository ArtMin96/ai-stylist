package app.aistylist.feature.capture.ui

import androidx.annotation.StringRes
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.feature.capture.R
import app.aistylist.feature.capture.domain.AnywayReason
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CaptureSide
import app.aistylist.feature.capture.domain.UnderwearPick

// Copy lookups for the capture screens (capture brief §2, §6). The text lives in strings.xml.

/** The on-screen text of every hint but the guide, whose text follows the camera step (brief §6). */
private val SHOWN_TEXT: Map<CaptureHint, Int> =
    mapOf(
        CaptureHint.WARMING_UP to R.string.cap_hint_warming_up,
        CaptureHint.NO_ITEM to R.string.cap_hint_no_item,
        CaptureHint.CUT_OFF_MULTIPLE to R.string.cap_hint_cut_off_multiple,
        CaptureHint.CUT_OFF_TOP to R.string.cap_hint_cut_off_top,
        CaptureHint.CUT_OFF_BOTTOM to R.string.cap_hint_cut_off_bottom,
        CaptureHint.CUT_OFF_LEFT to R.string.cap_hint_cut_off_left,
        CaptureHint.CUT_OFF_RIGHT to R.string.cap_hint_cut_off_right,
        CaptureHint.BODY_SHOULDERS_HIPS to R.string.cap_hint_body_shoulders_hips,
        CaptureHint.BODY_HIPS_ANKLES to R.string.cap_hint_body_hips_ankles,
        CaptureHint.BODY_HIPS_KNEES to R.string.cap_hint_body_hips_knees,
        CaptureHint.BODY_SHOULDERS_KNEES to R.string.cap_hint_body_shoulders_knees,
        CaptureHint.TOO_SMALL to R.string.cap_hint_too_small,
        CaptureHint.NOT_STEADY to R.string.cap_hint_not_steady,
        CaptureHint.TOO_DARK to R.string.cap_hint_too_dark,
        CaptureHint.TOO_BRIGHT to R.string.cap_hint_too_bright,
        CaptureHint.TILT to R.string.cap_hint_tilt,
        CaptureHint.READY to R.string.cap_hint_ready,
        CaptureHint.CAPTURING to R.string.cap_hint_capturing,
        CaptureHint.NEXT_ITEM to R.string.cap_hint_next_item,
    )

/** The on-screen text of [this] hint in [context]; the guide's text follows the camera step. */
@StringRes
fun CaptureHint.shownText(context: CameraContext): Int =
    if (this == CaptureHint.GUIDE) context.guideText() else SHOWN_TEXT.getValue(this)

/** The spoken text of [hint] (brief §6 "Spoken"); the same as the shown text where the brief says "same". */
@StringRes
fun CaptureHint.spokenText(context: CameraContext): Int =
    when (this) {
        CaptureHint.NO_ITEM -> R.string.cap_spoken_no_item
        CaptureHint.TOO_SMALL -> R.string.cap_spoken_too_small
        CaptureHint.NOT_STEADY -> R.string.cap_spoken_not_steady
        CaptureHint.READY -> R.string.cap_spoken_ready
        CaptureHint.CAPTURING -> R.string.cap_spoken_capturing
        CaptureHint.NEXT_ITEM -> R.string.cap_spoken_next_item
        else -> shownText(context)
    }

/** The hint card's icon (C02 glyphs, as the SC17/SC18 boards draw them). */
val CaptureHint.icon: AppIconName
    get() =
        when (this) {
            CaptureHint.WARMING_UP, CaptureHint.NO_ITEM -> AppIconName.SEARCH

            CaptureHint.CUT_OFF_MULTIPLE,
            CaptureHint.CUT_OFF_TOP,
            CaptureHint.CUT_OFF_BOTTOM,
            CaptureHint.CUT_OFF_LEFT,
            CaptureHint.CUT_OFF_RIGHT,
            -> AppIconName.ZOOM_OUT

            CaptureHint.BODY_SHOULDERS_HIPS,
            CaptureHint.BODY_HIPS_ANKLES,
            CaptureHint.BODY_HIPS_KNEES,
            CaptureHint.BODY_SHOULDERS_KNEES,
            -> AppIconName.POSE_NEUTRAL

            CaptureHint.TOO_SMALL -> AppIconName.ZOOM_IN

            CaptureHint.NOT_STEADY -> AppIconName.PAUSE

            CaptureHint.TOO_DARK -> AppIconName.EVENING

            CaptureHint.TOO_BRIGHT -> AppIconName.SUN

            CaptureHint.TILT -> AppIconName.ROTATE_LEFT

            CaptureHint.GUIDE -> AppIconName.INFO

            CaptureHint.READY -> AppIconName.CHECK

            CaptureHint.CAPTURING -> AppIconName.CAPTURE

            CaptureHint.NEXT_ITEM -> AppIconName.ARROW_RIGHT
        }

/** The family instruction for this step (brief §6 "Family instructions"). */
@StringRes
fun CameraContext.guideText(): Int =
    when (side) {
        CaptureSide.FRONT -> family.frontGuide(mode)
        CaptureSide.BACK, CaptureSide.PAIR -> family.backGuide()
    }

@StringRes
private fun CaptureShapeFamily.frontGuide(mode: CaptureMode): Int =
    when (this) {
        CaptureShapeFamily.TOP -> {
            byMode(mode, R.string.cap_guide_top_flat, R.string.cap_guide_top_hanger, R.string.cap_guide_top_worn)
        }

        CaptureShapeFamily.LONG_BOTTOM -> {
            byMode(
                mode,
                R.string.cap_guide_long_bottom_flat,
                R.string.cap_guide_long_bottom_hanger,
                R.string.cap_guide_long_bottom_worn,
            )
        }

        CaptureShapeFamily.SHORT_BOTTOM -> {
            byMode(
                mode,
                R.string.cap_guide_short_bottom_flat,
                R.string.cap_guide_short_bottom_hanger,
                R.string.cap_guide_short_bottom_worn,
            )
        }

        CaptureShapeFamily.ONE_PIECE -> {
            byMode(
                mode,
                R.string.cap_guide_one_piece_flat,
                R.string.cap_guide_one_piece_hanger,
                R.string.cap_guide_one_piece_worn,
            )
        }

        CaptureShapeFamily.OUTERWEAR -> {
            byMode(
                mode,
                R.string.cap_guide_outerwear_flat,
                R.string.cap_guide_outerwear_hanger,
                R.string.cap_guide_outerwear_worn,
            )
        }

        CaptureShapeFamily.SHOES -> {
            R.string.cap_guide_shoes_flat
        }

        CaptureShapeFamily.BAG -> {
            if (mode ==
                CaptureMode.HANGER
            ) {
                R.string.cap_guide_bag_hanger
            } else {
                R.string.cap_guide_bag_flat
            }
        }

        CaptureShapeFamily.SMALL_ITEM -> {
            R.string.cap_guide_small_item_flat
        }

        CaptureShapeFamily.GENERIC -> {
            byMode(
                mode,
                R.string.cap_guide_generic_flat,
                R.string.cap_guide_generic_hanger,
                R.string.cap_guide_generic_worn,
            )
        }
    }

@StringRes
private fun CaptureShapeFamily.backGuide(): Int =
    when (this) {
        CaptureShapeFamily.SHOES -> R.string.cap_guide_shoes_pair
        CaptureShapeFamily.BAG -> R.string.cap_guide_bag_back
        CaptureShapeFamily.SMALL_ITEM -> R.string.cap_guide_turn_over
        else -> R.string.cap_guide_back
    }

@StringRes
private fun byMode(
    mode: CaptureMode,
    @StringRes flat: Int,
    @StringRes hanger: Int,
    @StringRes worn: Int,
): Int =
    when (mode) {
        CaptureMode.FLAT -> flat
        CaptureMode.HANGER -> hanger
        CaptureMode.WORN -> worn
    }

/** The picker tile label of [this] family (brief §2); `generic` is "Not sure". */
@StringRes
fun CaptureShapeFamily.label(): Int =
    when (this) {
        CaptureShapeFamily.TOP -> R.string.cap_family_top
        CaptureShapeFamily.LONG_BOTTOM -> R.string.cap_family_long_bottom
        CaptureShapeFamily.SHORT_BOTTOM -> R.string.cap_family_short_bottom
        CaptureShapeFamily.ONE_PIECE -> R.string.cap_family_one_piece
        CaptureShapeFamily.OUTERWEAR -> R.string.cap_family_outerwear
        CaptureShapeFamily.SHOES -> R.string.cap_family_shoes
        CaptureShapeFamily.BAG -> R.string.cap_family_bag
        CaptureShapeFamily.SMALL_ITEM -> R.string.cap_family_small_item
        CaptureShapeFamily.GENERIC -> R.string.cap_picker_not_sure
    }

/** The tile subtitle, where the brief gives one. */
@StringRes
fun CaptureShapeFamily.subtitle(): Int? =
    when (this) {
        CaptureShapeFamily.TOP -> R.string.cap_family_top_subtitle
        CaptureShapeFamily.LONG_BOTTOM -> R.string.cap_family_long_bottom_subtitle
        CaptureShapeFamily.SMALL_ITEM -> R.string.cap_family_small_item_subtitle
        else -> null
    }

@StringRes
fun CaptureMode.label(): Int =
    when (this) {
        CaptureMode.FLAT -> R.string.cap_mode_flat
        CaptureMode.HANGER -> R.string.cap_mode_hanger
        CaptureMode.WORN -> R.string.cap_mode_worn
    }

@StringRes
fun UnderwearPick.label(): Int =
    when (this) {
        UnderwearPick.BRA_OR_TOP -> R.string.cap_underwear_top
        UnderwearPick.BRIEFS_OR_BOTTOMS -> R.string.cap_underwear_bottoms
        UnderwearPick.SWIMSUIT_OR_BODYSUIT -> R.string.cap_underwear_swimsuit
        UnderwearPick.TIGHTS -> R.string.cap_underwear_tights
        UnderwearPick.SOCKS -> R.string.cap_underwear_socks
    }

/** The reason line's text resource and, for [AnywayReason.Hint], the hint whose text it repeats. */
@StringRes
fun AnywayReason.text(context: CameraContext): Int =
    when (this) {
        AnywayReason.NoItemSurfaceTip -> R.string.cap_anyway_no_item
        AnywayReason.TryHangerMode -> R.string.cap_anyway_try_hanger
        is AnywayReason.Hint -> hint.shownText(context)
    }
