package app.aistylist.feature.capture.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.aistylist.contracts.kernel.CaptureHint
import app.aistylist.core.designsystem.AppButton
import app.aistylist.core.designsystem.AppChip
import app.aistylist.core.designsystem.AppIcon
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.core.designsystem.generated.ChipSelection
import app.aistylist.core.designsystem.generated.ChipSize
import app.aistylist.core.designsystem.generated.ChipVariant
import app.aistylist.feature.capture.R
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.ReviewPhotos
import app.aistylist.feature.capture.domain.SecondPhotoQuestion

/** Loads a photo of the flow (the in-memory store); null when it cannot be read. */
typealias PhotoLoader = suspend (PhotoRef) -> Bitmap?

/** A photo filling its box (centre-cropped), named for assistive tech; surface-2 while loading. */
@Composable
internal fun FlowPhoto(
    photo: PhotoRef?,
    loader: PhotoLoader,
    label: String,
    modifier: Modifier = Modifier,
) {
    val bitmap by produceState<Bitmap?>(initialValue = null, photo) { value = photo?.let { loader(it) } }
    Box(
        modifier = modifier.background(role(AppColorRole.SURFACE2)).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        bitmap?.let {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

/**
 * A paper screen: background, modal header, [content] scrolling in the 20 margins, and [actions]
 * pinned at the bottom (stacked, full width).
 */
@Composable
private fun PaperScreen(
    title: String,
    tag: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable ColumnScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(role(AppColorRole.BACKGROUND))
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .testTag(tag),
    ) {
        ModalHeader(
            title = title,
            onClose = onClose,
            closeTag = CaptureTestTags.CAMERA_CLOSE,
            closeLabel = stringResource(R.string.cap_close),
        )
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(
                        start = AppTheme.spacing.space20.dp,
                        end = AppTheme.spacing.space20.dp,
                        top = AppTheme.spacing.space16.dp,
                    ),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
            content = content,
        )
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(
                        start = AppTheme.spacing.space20.dp,
                        end = AppTheme.spacing.space20.dp,
                        top = AppTheme.spacing.space12.dp,
                        bottom = CaptureProposedTokens.sheetPaddingBottom,
                    ),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp),
            content = actions,
        )
    }
}

/** What the review screen reports. */
class ReviewActions(
    val onClose: () -> Unit,
    val onAnswer: (wantsSecond: Boolean) -> Unit,
    val onTakeSecond: () -> Unit,
    val onDone: () -> Unit,
    val onRetake: () -> Unit,
)

/** `cap-screen-review` (SC19): the photo, the back or pair question, Done or "Take back photo", Retake. */
@Composable
fun ReviewScreen(
    review: ReviewPhotos,
    question: SecondPhotoQuestion,
    loader: PhotoLoader,
    actions: ReviewActions,
    modifier: Modifier = Modifier,
) {
    val front = stringResource(R.string.cap_review_front)
    val secondName =
        stringResource(
            if (question == SecondPhotoQuestion.PAIR) R.string.cap_review_pair else R.string.cap_review_back,
        )
    val takeSecond = review.wantsSecond && review.second == null
    PaperScreen(
        title = stringResource(R.string.cap_review_title),
        tag = CaptureTestTags.SCREEN_REVIEW,
        onClose = actions.onClose,
        modifier = modifier,
        actions = { ReviewButtons(question, takeSecond, actions) },
    ) {
        if (review.second == null) {
            FlowPhoto(
                photo = review.front,
                loader = loader,
                label = stringResource(R.string.cap_review_photo_label, front),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(CaptureProposedTokens.reviewPhotoHeight)
                        .clip(RoundedCornerShape(AppTheme.radius.radius24.dp))
                        .testTag(CaptureTestTags.REVIEW_PHOTO_FRONT),
            )
            SecondQuestion(question, review.wantsSecond, actions.onAnswer)
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(CaptureProposedTokens.pickerColumnGap)) {
                PairPhoto(review.front, loader, front, CaptureTestTags.REVIEW_PHOTO_FRONT, Modifier.weight(1f))
                PairPhoto(review.second, loader, secondName, CaptureTestTags.REVIEW_PHOTO_BACK, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ReviewButtons(
    question: SecondPhotoQuestion,
    takeSecond: Boolean,
    actions: ReviewActions,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
        // Primary first: "Done", or "Take back photo" / "Take pair photo" after "Different" / "Yes".
        AppButton(
            label =
                stringResource(
                    when {
                        !takeSecond -> R.string.cap_done
                        question == SecondPhotoQuestion.PAIR -> R.string.cap_review_take_pair
                        else -> R.string.cap_review_take_back
                    },
                ),
            variant = ButtonVariant.PRIMARY,
            size = ButtonSize.LARGE,
            action = if (takeSecond) actions.onTakeSecond else actions.onDone,
            fullWidth = true,
            modifier =
                Modifier.testTag(
                    if (takeSecond) CaptureTestTags.REVIEW_TAKE_BACK else CaptureTestTags.REVIEW_DONE,
                ),
        )
        AppButton(
            label = stringResource(R.string.cap_review_retake),
            variant = ButtonVariant.SECONDARY,
            size = ButtonSize.LARGE,
            action = actions.onRetake,
            fullWidth = true,
            modifier = Modifier.testTag(CaptureTestTags.REVIEW_RETAKE),
        )
    }
}

@Composable
private fun PairPhoto(
    photo: PhotoRef?,
    loader: PhotoLoader,
    name: String,
    tag: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp)) {
        FlowPhoto(
            photo = photo,
            loader = loader,
            label = stringResource(R.string.cap_review_photo_label, name),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(CaptureProposedTokens.reviewPairPhotoHeight)
                    .clip(RoundedCornerShape(AppTheme.radius.radius16.dp))
                    .testTag(tag),
        )
        RoleText(text = name, style = AppTheme.typography.labelSm, color = AppColorRole.TEXT)
    }
}

/** "Is the back different?" / "Add a photo of the pair?": two C03 choice chips, one choice. */
@Composable
private fun SecondQuestion(
    question: SecondPhotoQuestion,
    wantsSecond: Boolean,
    onAnswer: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val isPair = question == SecondPhotoQuestion.PAIR
    Column(
        modifier = modifier.padding(top = AppTheme.spacing.space12.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp),
    ) {
        RoleText(
            text = stringResource(if (isPair) R.string.cap_review_pair_question else R.string.cap_review_back_question),
            style = AppTheme.typography.headline,
            color = AppColorRole.TEXT,
            modifier = Modifier.semantics { heading() },
        )
        Row(
            modifier = Modifier.selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp),
        ) {
            AppChip(
                label = stringResource(if (isPair) R.string.cap_review_no else R.string.cap_review_same),
                variant = ChipVariant.CHOICE,
                size = ChipSize.LARGE,
                action = { onAnswer(false) },
                selected = !wantsSecond,
                selection = ChipSelection.SINGLE,
                modifier = Modifier.testTag(CaptureTestTags.REVIEW_BACK_SAME),
            )
            AppChip(
                label = stringResource(if (isPair) R.string.cap_review_yes else R.string.cap_review_different),
                variant = ChipVariant.CHOICE,
                size = ChipSize.LARGE,
                action = { onAnswer(true) },
                selected = wantsSecond,
                selection = ChipSelection.SINGLE,
                modifier = Modifier.testTag(CaptureTestTags.REVIEW_BACK_DIFFERENT),
            )
        }
    }
}

/** `cap-screen-import-tips` (SC20): the imported photo, one warning banner per failing check, two actions. */
@Composable
fun ImportTipsScreen(
    photo: PhotoRef,
    tips: List<CaptureHint>,
    context: CameraContext,
    loader: PhotoLoader,
    onKeepAnyway: () -> Unit,
    onChooseAnother: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PaperScreen(
        title = stringResource(R.string.cap_review_title),
        tag = CaptureTestTags.SCREEN_IMPORT_TIPS,
        onClose = onClose,
        modifier = modifier,
        actions = {
            AppButton(
                label = stringResource(R.string.cap_import_choose_another),
                variant = ButtonVariant.PRIMARY,
                size = ButtonSize.LARGE,
                action = onChooseAnother,
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.IMPORT_CHOOSE_ANOTHER),
            )
            AppButton(
                label = stringResource(R.string.cap_import_keep_anyway),
                variant = ButtonVariant.SECONDARY,
                size = ButtonSize.LARGE,
                action = onKeepAnyway,
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.IMPORT_KEEP_ANYWAY),
            )
        },
    ) {
        FlowPhoto(
            photo = photo,
            loader = loader,
            label = stringResource(R.string.cap_import_photo_label),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(
                        CaptureProposedTokens.importPhotoHeight,
                    ).clip(RoundedCornerShape(AppTheme.radius.radius24.dp)),
        )
        RoleText(
            text = stringResource(R.string.cap_import_heading),
            style = AppTheme.typography.headline,
            color = AppColorRole.TEXT,
            modifier = Modifier.padding(top = AppTheme.spacing.space8.dp).semantics { heading() },
        )
        tips.forEach { tip -> TipBanner(tip, context) }
    }
}

/** A C04 warning banner: icon + the hint's text, never colour alone. */
@Composable
private fun TipBanner(
    tip: CaptureHint,
    context: CameraContext,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(AppTheme.radius.radius16.dp))
                .background(role(AppColorRole.WARNING_BG))
                .padding(
                    horizontal = CaptureProposedTokens.hintCardPaddingHorizontal,
                    vertical = AppTheme.spacing.space12.dp,
                ).testTag(CaptureTestTags.importTip(tip.value))
                .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(CaptureProposedTokens.hintCardGap),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon(name = tip.icon, size = AppIconSize.MD, tint = AppColorRole.WARNING_FG)
        RoleText(
            text = stringResource(tip.shownText(context)),
            style = AppTheme.typography.subhead,
            color = AppColorRole.WARNING_FG,
        )
    }
}

/** `cap-screen-batch-summary` (SC20): the local thumbnails, kept until the flow closes. */
@Composable
fun BatchSummaryScreen(
    photos: List<PhotoRef>,
    loader: PhotoLoader,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = pluralStringResource(R.plurals.cap_batch_count, photos.size, photos.size)
    PaperScreen(
        title = title,
        tag = CaptureTestTags.SCREEN_BATCH_SUMMARY,
        onClose = onDone,
        modifier = modifier,
        actions = {
            AppButton(
                label = stringResource(R.string.cap_done),
                variant = ButtonVariant.PRIMARY,
                size = ButtonSize.LARGE,
                action = onDone,
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.BATCH_SUMMARY_DONE),
            )
        },
    ) {
        RoleText(
            text = stringResource(R.string.cap_batch_summary_line),
            style = AppTheme.typography.footnote,
            color = AppColorRole.TEXT_SECONDARY,
        )
        photos.chunked(SUMMARY_COLUMNS).forEachIndexed { rowIndex, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(CaptureProposedTokens.pickerColumnGap)) {
                row.forEachIndexed { index, photo ->
                    val name = stringResource(R.string.cap_batch_photo, rowIndex * SUMMARY_COLUMNS + index + 1)
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp),
                    ) {
                        FlowPhoto(
                            photo = photo,
                            loader = loader,
                            label = name,
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(
                                        1f,
                                    ).clip(RoundedCornerShape(AppTheme.radius.radius16.dp)),
                        )
                        RoleText(text = name, style = AppTheme.typography.caption, color = AppColorRole.TEXT)
                    }
                }
                repeat(SUMMARY_COLUMNS - row.size) { Spacer(modifier = Modifier.weight(1f)) }
            }
        }
    }
}

private const val SUMMARY_COLUMNS = 3

/** `cap-screen-permission` (C23): the C04 state template with "Open Settings" and import. */
@Composable
fun PermissionScreen(
    onOpenSettings: () -> Unit,
    onImport: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PaperScreen(stringResource(R.string.cap_add_item), CaptureTestTags.SCREEN_PERMISSION, onClose, modifier) {
        StateCard(
            icon = AppIconName.LOCK,
            title = stringResource(R.string.cap_permission_title),
            body = stringResource(R.string.cap_permission_body),
        ) {
            AppButton(
                label = stringResource(R.string.cap_permission_settings),
                variant = ButtonVariant.PRIMARY,
                size = ButtonSize.CARD,
                action = onOpenSettings,
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.PERMISSION_SETTINGS),
            )
            AppButton(
                label = stringResource(R.string.cap_import),
                variant = ButtonVariant.TONAL,
                size = ButtonSize.CARD,
                action = onImport,
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.PERMISSION_IMPORT),
            )
        }
    }
}

/** `cap-screen-no-camera`: the state template with import only. */
@Composable
fun NoCameraScreen(
    onImport: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PaperScreen(stringResource(R.string.cap_add_item), CaptureTestTags.SCREEN_NO_CAMERA, onClose, modifier) {
        StateCard(
            icon = AppIconName.CAPTURE,
            title = stringResource(R.string.cap_no_camera_title),
            body = stringResource(R.string.cap_no_camera_body),
        ) {
            AppButton(
                label = stringResource(R.string.cap_import),
                variant = ButtonVariant.PRIMARY,
                size = ButtonSize.CARD,
                action = onImport,
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.PERMISSION_IMPORT),
            )
        }
    }
}

/** The C04 state template: padding 20, radius 24, illustration slot, Title 3, Callout, actions. */
@Composable
private fun StateCard(
    icon: AppIconName,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    actions: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(AppTheme.radius.radius24.dp)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = AppTheme.spacing.space48.dp)
                .clip(shape)
                .background(role(AppColorRole.SURFACE))
                .border(CaptureProposedTokens.darkEdge, role(AppColorRole.DIVIDER), shape)
                .padding(AppTheme.spacing.space20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(CaptureProposedTokens.stateSlotWidth, CaptureProposedTokens.stateSlotHeight)
                    .clip(RoundedCornerShape(AppTheme.radius.radius16.dp))
                    .background(role(AppColorRole.SURFACE2)),
            contentAlignment = Alignment.Center,
        ) {
            AppIcon(name = icon, size = AppIconSize.XL, tint = AppColorRole.TEXT_SECONDARY)
        }
        RoleText(
            text = title,
            style = AppTheme.typography.title3,
            color = AppColorRole.TEXT,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        RoleText(
            text = body,
            style = AppTheme.typography.callout,
            color = AppColorRole.TEXT_SECONDARY,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(AppTheme.spacing.space4.dp))
        actions()
    }
}
