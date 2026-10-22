package app.aistylist.feature.capture.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.core.designsystem.AppButton
import app.aistylist.core.designsystem.AppIcon
import app.aistylist.core.designsystem.AppText
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.feature.capture.R
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CameraSnapshot
import app.aistylist.feature.capture.domain.CaptureFlowKind
import app.aistylist.feature.capture.domain.CaptureSide
import app.aistylist.feature.capture.domain.LockPhase
import app.aistylist.feature.capture.domain.ShutterState
import app.aistylist.feature.capture.domain.UnderwearPick

/** Everything the camera screen shows, beyond the live picture. */
data class CameraScreenModel(
    val context: CameraContext,
    /** Null only for the instant before the step's session publishes. */
    val snapshot: CameraSnapshot?,
    val offeredModes: List<CaptureMode>,
    /** The underwear or swimwear sub-pick the camera shows; null for any other item. */
    val underwearPick: UnderwearPick?,
    val isWornAllowed: Boolean,
    val batchCount: Int,
    val isSpeechOn: Boolean,
    val hasTorch: Boolean,
    val isTorchOn: Boolean,
) {
    val isUnderwear: Boolean get() = underwearPick != null
}

/** What the camera screen reports. */
interface CameraActions {
    fun onClose()

    fun onSpeechToggled(isOn: Boolean)

    fun onTorchToggled(isOn: Boolean)

    fun onWornAllowed(isAllowed: Boolean)

    fun onModeSelected(mode: CaptureMode)

    fun onImport()

    fun onShutter()

    fun onAnyway()

    fun onNextItem()

    fun onSkip()

    fun onBatchDone()
}

/** `cap-screen-camera` (SC17–SC20): the camera chrome on camera-ground, the same in every scheme. */
@Composable
fun CameraScreen(
    model: CameraScreenModel,
    actions: CameraActions,
    preview: @Composable (Modifier) -> Unit,
    modifier: Modifier = Modifier,
) {
    var sheet by rememberSaveable { mutableStateOf(CameraSheet.NONE) }
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(
                    role(AppColorRole.CAMERA_GROUND),
                ).testTag(CaptureTestTags.SCREEN_CAMERA),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .padding(
                        start = AppTheme.spacing.space20.dp,
                        end = AppTheme.spacing.space20.dp,
                        top = CaptureProposedTokens.chromePaddingTop,
                        bottom = CaptureProposedTokens.chromePaddingBottom,
                    ),
            verticalArrangement = Arrangement.spacedBy(CaptureProposedTokens.chromeGap),
        ) {
            TopBar(model, actions, onOpen = { sheet = it })
            PreviewArea(model, preview, modifier = Modifier.weight(1f))
            AnywaySlot(model, actions)
            Box(
                modifier = Modifier.fillMaxWidth().heightIn(min = CaptureProposedTokens.modeSlotHeight),
                contentAlignment = Alignment.Center,
            ) {
                if (model.offeredModes.size > 1) {
                    ModeSwitch(model.offeredModes, model.context.mode, actions::onModeSelected)
                }
            }
            BottomRow(model, actions)
        }
        if (sheet == CameraSheet.HELP) HelpSheet(onDismiss = { sheet = CameraSheet.NONE })
        if (sheet == CameraSheet.MENU) {
            MenuSheet(model.isWornAllowed, actions::onWornAllowed, onDismiss = { sheet = CameraSheet.NONE })
        }
    }
}

private enum class CameraSheet { NONE, HELP, MENU }

@Composable
private fun TopBar(
    model: CameraScreenModel,
    actions: CameraActions,
    onOpen: (CameraSheet) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxWidth().heightIn(min = CaptureProposedTokens.topBarHeight)) {
        IconButtonGlyph(
            icon = AppIconName.CLOSE,
            label = stringResource(R.string.cap_close),
            tint = AppColorRole.CAMERA_PAPER,
            onClick = actions::onClose,
            modifier = Modifier.align(Alignment.CenterStart).testTag(CaptureTestTags.CAMERA_CLOSE),
        )
        if (model.context.kind == CaptureFlowKind.BATCH && model.batchCount > 0) {
            CountChip(
                text = pluralStringResource(R.plurals.cap_batch_count, model.batchCount, model.batchCount),
                modifier = Modifier.align(Alignment.Center),
            )
        }
        Row(modifier = Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
            if (model.isUnderwear) {
                IconButtonGlyph(
                    icon = AppIconName.MORE,
                    label = stringResource(R.string.cap_more_options),
                    tint = AppColorRole.CAMERA_PAPER,
                    onClick = { onOpen(CameraSheet.MENU) },
                    modifier = Modifier.testTag(CaptureTestTags.CAMERA_MENU),
                )
            }
            val speechLabel = stringResource(if (model.isSpeechOn) R.string.cap_speech_on else R.string.cap_speech_off)
            IconControl(
                label = speechLabel,
                onClick = { actions.onSpeechToggled(!model.isSpeechOn) },
                modifier = Modifier.testTag(CaptureTestTags.CAMERA_SPEECH),
            ) {
                ProposedGlyph(
                    pathData = if (model.isSpeechOn) SPEAKER_GLYPH else SPEAKER_OFF_GLYPH,
                    color = role(AppColorRole.CAMERA_PAPER),
                )
            }
            if (model.hasTorch) {
                IconButtonGlyph(
                    icon = AppIconName.FLASH,
                    label = stringResource(R.string.cap_torch),
                    tint = AppColorRole.CAMERA_PAPER,
                    onClick = { actions.onTorchToggled(!model.isTorchOn) },
                    modifier = Modifier.testTag(CaptureTestTags.CAMERA_TORCH),
                )
            }
            IconButtonGlyph(
                icon = AppIconName.INFO,
                label = stringResource(R.string.cap_help),
                tint = AppColorRole.CAMERA_PAPER,
                onClick = { onOpen(CameraSheet.HELP) },
                modifier = Modifier.testTag(CaptureTestTags.CAMERA_HELP),
            )
        }
    }
}

@Composable
private fun PreviewArea(
    model: CameraScreenModel,
    preview: @Composable (Modifier) -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(AppTheme.radius.radius24.dp)
    val context = model.context
    val snapshot = model.snapshot
    val hint = snapshot?.hint ?: CaptureHint.WARMING_UP
    val isSolid = snapshot?.shutter?.let { it != ShutterState.LOCKED } ?: false
    val previewLabel = stringResource(R.string.cap_preview_label)
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(role(AppColorRole.CAMERA_TRACK))
                .then(
                    if (isDarkScheme()) {
                        Modifier.border(
                            CaptureProposedTokens.darkEdge,
                            role(AppColorRole.DIVIDER),
                            shape,
                        )
                    } else {
                        Modifier
                    },
                ),
    ) {
        preview(Modifier.fillMaxSize())
        // The family guide (faint) until the item is outlined; then transparent, its node and tag kept.
        GuideOutline(
            pathData = context.guidePath,
            isSolid = isSolid,
            isFaint = true,
            alpha = if (snapshot?.outline != null) 0f else 1f,
            modifier =
                Modifier
                    .fillMaxSize()
                    .testTag(context.guideTestTag)
                    .semantics { contentDescription = previewLabel },
        )
        ItemOutline(live = snapshot?.outline, isSolid = isSolid, modifier = Modifier.fillMaxSize())
        stepLabel(context, model.underwearPick)?.let { (text, tag) ->
            StepPill(
                text = stringResource(text),
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = CaptureProposedTokens.stepPillTop)
                        .then(if (tag != null) Modifier.testTag(tag) else Modifier),
            )
        }
        HintCard(
            tag = hint.value,
            icon = hint.icon,
            text = stringResource(hint.shownText(context)),
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(
                        start = AppTheme.spacing.space16.dp,
                        end = AppTheme.spacing.space16.dp,
                        bottom = CaptureProposedTokens.hintCardBottom,
                    ),
        )
    }
}

/**
 * The pill text and its test ID: "Back" / "Pair" on those steps; on a single front step the item's
 * name with no ID, the underwear sub-pick's for underwear (boards SC16-SC18).
 */
private fun stepLabel(
    context: CameraContext,
    underwearPick: UnderwearPick?,
): Pair<Int, String?>? =
    when {
        context.side == CaptureSide.BACK -> R.string.cap_step_back to CaptureTestTags.STEP_BACK
        context.side == CaptureSide.PAIR -> R.string.cap_step_pair to CaptureTestTags.STEP_PAIR
        context.kind == CaptureFlowKind.BATCH -> null
        else -> (underwearPick?.label() ?: context.family.label()) to null
    }

@Composable
private fun AnywaySlot(
    model: CameraScreenModel,
    actions: CameraActions,
    modifier: Modifier = Modifier,
) {
    val snapshot = model.snapshot
    Column(
        modifier = modifier.fillMaxWidth().heightIn(min = CaptureProposedTokens.anywaySlotHeight),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp, Alignment.Bottom),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when {
            snapshot?.phase == LockPhase.COOLDOWN -> {
                CameraTonalButton(
                    label = stringResource(R.string.cap_hint_next_item),
                    onClick = actions::onNextItem,
                    icon = AppIconName.ARROW_RIGHT,
                    modifier = Modifier.testTag(CaptureTestTags.BATCH_NEXT),
                )
            }

            snapshot?.isAnywayVisible == true && snapshot.shutter != ShutterState.CAPTURING -> {
                snapshot.anywayReason?.let { reason ->
                    AppText(
                        text = stringResource(reason.text(model.context)),
                        style = AppTheme.typography.footnote,
                        color = role(AppColorRole.CAMERA_PAPER),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.testTag(CaptureTestTags.ANYWAY_REASON),
                    )
                }
                CameraTonalButton(
                    label = stringResource(R.string.cap_anyway),
                    onClick = actions::onAnyway,
                    modifier = Modifier.testTag(CaptureTestTags.ANYWAY_BUTTON),
                )
            }
        }
    }
}

@Composable
private fun BottomRow(
    model: CameraScreenModel,
    actions: CameraActions,
    modifier: Modifier = Modifier,
) {
    val snapshot = model.snapshot
    val state = snapshot?.shutter ?: ShutterState.LOCKED
    val hintText = stringResource((snapshot?.hint ?: CaptureHint.WARMING_UP).shownText(model.context))
    val label =
        if (state == ShutterState.LOCKED) {
            stringResource(R.string.cap_take_photo_unavailable, hintText)
        } else {
            stringResource(R.string.cap_take_photo)
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(
                    min = CaptureProposedTokens.bottomRowHeight,
                ).padding(horizontal = AppTheme.spacing.space8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            IconControl(
                label = stringResource(R.string.cap_import),
                onClick = actions::onImport,
                modifier =
                    Modifier
                        .size(CaptureProposedTokens.cameraIconButton)
                        .clip(CircleShape)
                        .background(role(AppColorRole.CAMERA_TRACK))
                        .testTag(CaptureTestTags.CAMERA_IMPORT),
            ) {
                AppIcon(name = AppIconName.PHOTO, size = AppIconSize.LG, tint = AppColorRole.CAMERA_PAPER)
            }
        }
        Shutter(
            state = state,
            progress = (snapshot?.ringProgress ?: 0.0).toFloat(),
            label = label,
            onClick = actions::onShutter,
        )
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
            rightAction(model, actions)?.let { (text, tag, onClick) ->
                CameraTextButton(text = stringResource(text), onClick = onClick, modifier = Modifier.testTag(tag))
            }
        }
    }
}

/** The right slot: "Skip" on the back and pair steps, "Done" in batch mode. */
private fun rightAction(
    model: CameraScreenModel,
    actions: CameraActions,
): Triple<Int, String, () -> Unit>? =
    when {
        model.context.kind == CaptureFlowKind.BATCH -> {
            Triple(
                R.string.cap_done,
                CaptureTestTags.BATCH_DONE,
                actions::onBatchDone,
            )
        }

        model.context.side != CaptureSide.FRONT -> {
            Triple(
                R.string.cap_skip,
                CaptureTestTags.CAMERA_SKIP_BACK,
                actions::onSkip,
            )
        }

        else -> {
            null
        }
    }

/** A text button on the camera ground (C01 text Compact 44, padding 0 12, paper 15/600). */
@Composable
private fun CameraTextButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = CaptureProposedTokens.cameraButtonHeight)
                .minimumInteractiveComponentSize()
                .clip(RoundedCornerShape(AppTheme.radius.full.dp))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = AppTheme.spacing.space12.dp),
        contentAlignment = Alignment.Center,
    ) {
        AppText(text = text, style = AppTheme.typography.subhead, color = role(AppColorRole.CAMERA_PAPER))
    }
}

/** The help sheet (`cap-camera-help`): the flat-lay technique for blind users (brief §8). */
@Composable
private fun HelpSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = stringResource(R.string.cap_help_title)
    CaptureSheet(onDismiss = onDismiss, label = title, modifier = modifier.testTag(CaptureTestTags.HELP_SHEET)) {
        RoleText(
            text = title,
            style = AppTheme.typography.title3,
            color = AppColorRole.TEXT,
            modifier =
                Modifier
                    .semantics {
                        heading()
                    },
        )
        RoleText(
            text = stringResource(R.string.cap_help_body),
            style = AppTheme.typography.callout,
            color = AppColorRole.TEXT,
        )
        AppButton(
            label = stringResource(R.string.cap_help_done),
            variant = ButtonVariant.TONAL,
            size = ButtonSize.LARGE,
            action = onDismiss,
            fullWidth = true,
        )
    }
}

/** The camera menu (underwear only): the worn-photos toggle row (C06 toggle row 64 + switch). */
@Composable
private fun MenuSheet(
    isWornAllowed: Boolean,
    onWornAllowed: (Boolean) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = stringResource(R.string.cap_menu_worn_title)
    val stateWord = stringResource(if (isWornAllowed) R.string.cap_on else R.string.cap_off)
    CaptureSheet(onDismiss = onDismiss, label = stringResource(R.string.cap_more_options), modifier = modifier) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = CaptureProposedTokens.toggleRowHeight)
                    .toggleable(value = isWornAllowed, role = Role.Switch, onValueChange = onWornAllowed)
                    .semantics { stateDescription = stateWord }
                    .testTag(CaptureTestTags.CAMERA_UNDERWEAR_WORN_TOGGLE),
            horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                RoleText(text = title, style = AppTheme.typography.headline, color = AppColorRole.TEXT)
                RoleText(
                    text = stringResource(R.string.cap_menu_worn_helper),
                    style = AppTheme.typography.footnote,
                    color = AppColorRole.TEXT_SECONDARY,
                )
            }
            RoleText(text = stateWord, style = AppTheme.typography.callout, color = AppColorRole.TEXT_SECONDARY)
            Switch(
                checked = isWornAllowed,
                onCheckedChange = null,
                colors =
                    SwitchDefaults.colors(
                        checkedTrackColor = role(AppColorRole.PRIMARY),
                        checkedThumbColor = role(AppColorRole.ON_PRIMARY),
                        uncheckedTrackColor = role(AppColorRole.OUTLINE),
                        uncheckedThumbColor = role(AppColorRole.SURFACE),
                        uncheckedBorderColor = role(AppColorRole.OUTLINE),
                    ),
            )
        }
        Spacer(modifier = Modifier.height(AppTheme.spacing.space4.dp))
    }
}
