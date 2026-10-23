package app.aistylist.feature.capture.ui

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.core.designsystem.AppIcon
import app.aistylist.core.designsystem.AppText
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.generated.CameraModeSelectedTokens
import app.aistylist.core.designsystem.generated.CameraModeSwitchTokens
import app.aistylist.feature.capture.R
import app.aistylist.feature.capture.domain.ShutterState
import kotlin.math.roundToInt

/** Android's "Remove animations": the ring then fills without easing and nothing animates (brief §8). */
@Composable
internal fun isReducedMotion(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember(resolver) { Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

/**
 * The guide outline (C11 proposed): dashed while locked, solid with round caps once unlocked; never
 * colour alone. Faint ([isFaint], as on iOS: the camera-paper 2 stroke without its camera-ink halo)
 * until an item is outlined; then transparent ([alpha] 0), its node and test tag kept. Otherwise
 * camera-paper 2 over a camera-ink 4 halo, so it reads at 3:1 over any picture (the box-path fallback).
 */
@Composable
internal fun GuideOutline(
    pathData: String,
    isSolid: Boolean,
    modifier: Modifier = Modifier,
    isFaint: Boolean = false,
    alpha: Float = 1f,
) {
    val path = rememberSvgPath(pathData)
    val ink = role(AppColorRole.CAMERA_INK)
    val paper = role(AppColorRole.CAMERA_PAPER)
    Canvas(modifier = modifier) {
        val viewport = Size(CaptureProposedTokens.GUIDE_VIEWPORT_WIDTH, CaptureProposedTokens.GUIDE_VIEWPORT_HEIGHT)
        val dash = if (isSolid) null else dashEffect(CaptureProposedTokens.guideDash.toPx())
        val cap = if (isSolid) StrokeCap.Round else StrokeCap.Butt
        if (!isFaint) {
            drawInViewport(
                path,
                viewport,
                Stroke(CaptureProposedTokens.guideHalo.toPx(), cap = cap, join = StrokeJoin.Round, pathEffect = dash),
                ink.copy(alpha = ink.alpha * alpha),
            )
        }
        drawInViewport(
            path,
            viewport,
            Stroke(CaptureProposedTokens.guideStroke.toPx(), cap = cap, join = StrokeJoin.Round, pathEffect = dash),
            paper.copy(alpha = paper.alpha * alpha),
        )
    }
}

/** The step pill (`cap-step-back`, `cap-step-pair`) or the family label on the front step. */
@Composable
internal fun StepPill(
    text: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = CaptureProposedTokens.stepPillHeight)
                .clip(RoundedCornerShape(AppTheme.radius.full.dp))
                .background(role(AppColorRole.CAMERA_GROUND))
                .padding(horizontal = CaptureProposedTokens.stepPillPaddingHorizontal),
        contentAlignment = Alignment.Center,
    ) {
        AppText(text = text, style = AppTheme.typography.labelSm, color = role(AppColorRole.CAMERA_PAPER))
    }
}

/**
 * The hint card: icon + words (never colour alone), wrapping without truncation, a polite live
 * region so TalkBack announces each new hint. Its test tag is the hint key.
 */
@Composable
internal fun HintCard(
    tag: String,
    icon: AppIconName,
    text: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(AppTheme.radius.radius16.dp)
    val dark = isDarkScheme()
    Row(
        modifier =
            modifier
                .snackbarElevation(shape)
                .clip(shape)
                .background(role(AppColorRole.CAMERA_GROUND))
                .then(
                    if (dark) {
                        Modifier.border(
                            CaptureProposedTokens.darkEdge,
                            role(AppColorRole.DIVIDER),
                            shape,
                        )
                    } else {
                        Modifier
                    },
                ).padding(
                    horizontal = CaptureProposedTokens.hintCardPaddingHorizontal,
                    vertical = CaptureProposedTokens.hintCardPaddingVertical,
                ).testTag(tag)
                .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(CaptureProposedTokens.hintCardGap),
        verticalAlignment = Alignment.Top,
    ) {
        AppIcon(name = icon, size = AppIconSize.MD, tint = AppColorRole.CAMERA_PAPER)
        AppText(text = text, style = AppTheme.typography.subheadMedium, color = role(AppColorRole.CAMERA_PAPER))
    }
}

/** A camera-chrome button (proposed camera-button-tonal): Compact 44 on camera-track, paper label. */
@Composable
internal fun CameraTonalButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: AppIconName? = null,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = CaptureProposedTokens.cameraButtonHeight)
                .minimumInteractiveComponentSize()
                .clip(RoundedCornerShape(AppTheme.radius.full.dp))
                .background(role(AppColorRole.CAMERA_TRACK))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = AppTheme.spacing.space20.dp),
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let { AppIcon(name = it, size = AppIconSize.MD, tint = AppColorRole.CAMERA_PAPER) }
        AppText(text = label, style = AppTheme.typography.subhead, color = role(AppColorRole.CAMERA_PAPER))
    }
}

/** The C05 camera mode switch: one segment per offered mode, the selected one filled. */
@Composable
internal fun ModeSwitch(
    modes: List<CaptureMode>,
    selected: CaptureMode,
    onSelect: (CaptureMode) -> Unit,
    modifier: Modifier = Modifier,
) {
    val dark = isDarkScheme()
    val track = if (dark) CameraModeSwitchTokens.dark else CameraModeSwitchTokens.light
    val chosen = if (dark) CameraModeSelectedTokens.dark else CameraModeSelectedTokens.light
    val groupLabel = stringResource(R.string.cap_mode_group)
    val selectedWord = stringResource(R.string.cap_selected)
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(track.rounded.dp))
                .background(role(track.backgroundColor))
                .padding(CaptureProposedTokens.modeTrackPadding)
                .selectableGroup()
                .semantics { contentDescription = groupLabel },
        horizontalArrangement = Arrangement.spacedBy(CaptureProposedTokens.modeSegmentGap),
    ) {
        modes.forEach { mode ->
            val isSelected = mode == selected
            Box(
                modifier =
                    Modifier
                        .heightIn(min = track.height.dp)
                        .clip(RoundedCornerShape(track.rounded.dp))
                        .then(if (isSelected) Modifier.background(role(chosen.backgroundColor)) else Modifier)
                        .selectable(selected = isSelected, role = Role.RadioButton) { onSelect(mode) }
                        .semantics { if (isSelected) stateDescription = selectedWord }
                        .padding(start = track.paddingStart.dp, end = track.paddingEnd.dp)
                        .testTag(CaptureTestTags.mode(mode)),
                contentAlignment = Alignment.Center,
            ) {
                AppText(
                    text = stringResource(mode.label()),
                    style = if (isSelected) chosen.typography else AppTheme.typography.subheadMedium,
                    color = role(if (isSelected) chosen.textColor else track.textColor),
                )
            }
        }
    }
}

/**
 * The shutter (C11 proposed): ring 76 with a stroke-4 track in camera-track and the fill in
 * camera-paper from 12 o'clock clockwise; a 60 disc (52 while capturing), camera-track with the lock
 * glyph while locked. The ring is its own node (`cap-ring`, value in percent) beside the button, so
 * both stay visible to UI tests. Its test tag follows the state.
 */
@Composable
internal fun Shutter(
    state: ShutterState,
    progress: Float,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val reduced = isReducedMotion()
    val shown by animateFloatAsState(
        targetValue = if (state == ShutterState.CAPTURING) 1f else progress,
        animationSpec = if (reduced) snap() else tween(CaptureRules.Evaluation.INTERVAL_MS, easing = LinearEasing),
        label = "ring",
    )
    val percent = (shown * PERCENT).roundToInt()
    val ringValue = stringResource(R.string.cap_ring_value, percent)
    val track = role(AppColorRole.CAMERA_TRACK)
    val paper = role(AppColorRole.CAMERA_PAPER)
    Box(modifier = modifier.size(CaptureProposedTokens.shutterSize), contentAlignment = Alignment.Center) {
        Canvas(
            modifier =
                Modifier
                    .size(CaptureProposedTokens.shutterSize)
                    .testTag(CaptureTestTags.RING)
                    .semantics {
                        progressBarRangeInfo = ProgressBarRangeInfo(shown, 0f..1f)
                        stateDescription = ringValue
                    },
        ) {
            val stroke = CaptureProposedTokens.shutterRing.toPx()
            val inset = stroke / 2
            val arcSize = Size(size.width - stroke, size.height - stroke)
            drawArc(
                track,
                0f,
                FULL_CIRCLE,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(stroke),
            )
            drawArc(
                paper,
                START_AT_TOP,
                FULL_CIRCLE * shown,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(stroke),
            )
        }
        val disc =
            if (state ==
                ShutterState.CAPTURING
            ) {
                CaptureProposedTokens.shutterDiscCapturing
            } else {
                CaptureProposedTokens.shutterDisc
            }
        Box(
            modifier =
                Modifier
                    .size(disc)
                    .clip(CircleShape)
                    .background(if (state == ShutterState.LOCKED) track else paper)
                    .clickable(onClick = onClick)
                    .testTag(CaptureTestTags.shutter(state))
                    .clearAndSetSemantics {
                        contentDescription = label
                        role = Role.Button
                    },
            contentAlignment = Alignment.Center,
        ) {
            if (state ==
                ShutterState.LOCKED
            ) {
                AppIcon(name = AppIconName.LOCK, size = AppIconSize.LG, tint = AppColorRole.CAMERA_PAPER)
            }
        }
    }
}

private const val PERCENT = 100
private const val FULL_CIRCLE = 360f
private const val START_AT_TOP = -90f

/** The batch count chip (C05 upload badge): ring 1.5, check icon, "3 items". */
@Composable
internal fun CountChip(
    text: String,
    modifier: Modifier = Modifier,
) {
    val color = role(if (isDarkScheme()) AppColorRole.CAMERA_YELLOW else AppColorRole.CAMERA_PAPER)
    val shape = RoundedCornerShape(AppTheme.radius.full.dp)
    Row(
        modifier =
            modifier
                .heightIn(min = CaptureProposedTokens.countChipHeight)
                .border(CaptureProposedTokens.countChipRing, color, shape)
                .padding(horizontal = CaptureProposedTokens.countChipPaddingHorizontal)
                .testTag(CaptureTestTags.BATCH_COUNT)
                .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon(
            name = AppIconName.CHECK,
            size = AppIconSize.MD,
            tint = if (isDarkScheme()) AppColorRole.CAMERA_YELLOW else AppColorRole.CAMERA_PAPER,
        )
        AppText(text = text, style = AppTheme.typography.labelMd, color = color)
    }
}
