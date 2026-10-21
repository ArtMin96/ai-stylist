package app.aistylist.feature.capture.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.core.designsystem.AppButton
import app.aistylist.core.designsystem.AppIcon
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.feature.capture.R
import app.aistylist.feature.capture.domain.CaptureScreen
import app.aistylist.feature.capture.domain.UnderwearPick
import kotlin.math.min

/** What the picker and its sheets report. */
interface PickerActions {
    fun onFamily(family: CaptureShapeFamily)

    fun onUnderwear()

    fun onNotSure()

    fun onBatch()

    fun onImport()

    fun onClose()

    fun onOptIn(allowWorn: Boolean)

    fun onUnderwearPick(pick: UnderwearPick)

    fun onDismissSheet()
}

/** The tiles in reading order (brief §2); underwear is its own tile with a sub-pick. */
private val PICKER_FAMILIES =
    listOf(
        CaptureShapeFamily.TOP,
        CaptureShapeFamily.LONG_BOTTOM,
        CaptureShapeFamily.SHORT_BOTTOM,
        CaptureShapeFamily.ONE_PIECE,
        CaptureShapeFamily.OUTERWEAR,
        CaptureShapeFamily.SHOES,
        CaptureShapeFamily.BAG,
        CaptureShapeFamily.SMALL_ITEM,
    )

private const val PICKER_COLUMNS = 3

/** `cap-screen-picker` (SC16), with the underwear opt-in sheet or sub-pick over it. */
@Composable
fun PickerScreen(
    screen: CaptureScreen,
    actions: PickerActions,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(role(AppColorRole.BACKGROUND))
                .testTag(CaptureTestTags.SCREEN_PICKER),
    ) {
        Column(modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            ModalHeader(
                title = stringResource(R.string.cap_picker_title),
                onClose = actions::onClose,
                closeTag = CaptureTestTags.PICKER_CLOSE,
                closeLabel = stringResource(R.string.cap_close),
            )
            PickerBody(actions)
        }
        when (screen) {
            CaptureScreen.WornOptInSheet -> {
                OptInSheet(actions)
            }

            CaptureScreen.UnderwearPicker -> {
                UnderwearSheet(actions)
            }

            else -> {}
        }
    }
}

@Composable
private fun PickerBody(
    actions: PickerActions,
    modifier: Modifier = Modifier,
) {
    val tiles: List<Pair<String, @Composable () -> Unit>> =
        PICKER_FAMILIES.map { family ->
            CaptureTestTags.pickerFamily(family) to
                @Composable {
                    FamilyTile(
                        label = stringResource(family.label()),
                        subtitle = family.subtitle()?.let { stringResource(it) },
                        artPath = family.tileArtPath,
                        onClick = { actions.onFamily(family) },
                        modifier = Modifier.testTag(CaptureTestTags.pickerFamily(family)),
                    )
                }
        } +
            (
                CaptureTestTags.PICKER_UNDERWEAR to
                    @Composable {
                        FamilyTile(
                            label = stringResource(R.string.cap_family_underwear),
                            subtitle = null,
                            artPath = CaptureShapeFamily.ONE_PIECE.tileArtPath,
                            onClick = actions::onUnderwear,
                            modifier = Modifier.testTag(CaptureTestTags.PICKER_UNDERWEAR),
                        )
                    }
            )
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = AppTheme.spacing.space20.dp, vertical = AppTheme.spacing.space16.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        tiles.chunked(PICKER_COLUMNS).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(CaptureProposedTokens.pickerColumnGap)) {
                row.forEach { (_, tile) -> Box(modifier = Modifier.weight(1f)) { tile() } }
                repeat(PICKER_COLUMNS - row.size) { Spacer(modifier = Modifier.weight(1f)) }
            }
        }
        Spacer(modifier = Modifier.size(AppTheme.spacing.space4.dp))
        AppButton(
            label = stringResource(R.string.cap_picker_not_sure),
            variant = ButtonVariant.SECONDARY,
            size = ButtonSize.LARGE,
            action = actions::onNotSure,
            fullWidth = true,
            modifier = Modifier.testTag(CaptureTestTags.PICKER_NOT_SURE),
        )
        AppButton(
            label = stringResource(R.string.cap_picker_batch),
            variant = ButtonVariant.TONAL,
            size = ButtonSize.COMPACT,
            action = actions::onBatch,
            leadingIcon = AppIconName.COLLECTION,
            fullWidth = true,
            modifier = Modifier.testTag(CaptureTestTags.PICKER_BATCH),
        )
        AppButton(
            label = stringResource(R.string.cap_import),
            variant = ButtonVariant.TONAL,
            size = ButtonSize.COMPACT,
            action = actions::onImport,
            leadingIcon = AppIconName.PHOTO,
            fullWidth = true,
            modifier = Modifier.testTag(CaptureTestTags.PICKER_IMPORT),
        )
    }
}

/** One family tile (C08 item tile, square, radius 16, surface-2, outline art; label and subtitle wrap). */
@Composable
private fun FamilyTile(
    label: String,
    subtitle: String?,
    artPath: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val name = listOfNotNull(label, subtitle).joinToString(", ")
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = name
                    role = Role.Button
                },
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(AppTheme.radius.radius16.dp))
                    .background(role(AppColorRole.SURFACE2)),
            contentAlignment = Alignment.Center,
        ) {
            OutlineArt(
                pathData = artPath,
                color = role(AppColorRole.TEXT_SECONDARY),
                modifier = Modifier.size(CaptureProposedTokens.pickerTileArt),
            )
        }
        RoleText(text = label, style = AppTheme.typography.captionStrong, color = AppColorRole.TEXT)
        subtitle?.let { RoleText(text = it, style = AppTheme.typography.caption, color = AppColorRole.TEXT_SECONDARY) }
    }
}

/** A guide outline fitted into this box: the tile art until C10 garment art exists natively. */
@Composable
private fun OutlineArt(
    pathData: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    val path = rememberSvgPath(pathData)
    Canvas(modifier = modifier) {
        val bounds = path.getBounds()
        val scale = min(size.width / bounds.width, size.height / bounds.height)
        withTransform({
            translate((size.width - bounds.width * scale) / 2, (size.height - bounds.height * scale) / 2)
            scale(scale, scale, pivot = androidx.compose.ui.geometry.Offset.Zero)
            translate(-bounds.left, -bounds.top)
        }) {
            drawPath(
                path,
                color,
                style =
                    Stroke(
                        width = CaptureProposedTokens.artStroke.toPx() / scale,
                        cap = StrokeCap.Round,
                        join = StrokeJoin.Round,
                    ),
            )
        }
    }
}

@Composable
private fun OptInSheet(
    actions: PickerActions,
    modifier: Modifier = Modifier,
) {
    val title = stringResource(R.string.cap_optin_title)
    CaptureSheet(
        onDismiss = actions::onDismissSheet,
        label = title,
        modifier = modifier.testTag(CaptureTestTags.OPTIN_SHEET),
    ) {
        RoleText(
            text = title,
            style = AppTheme.typography.title3,
            color = AppColorRole.TEXT,
            modifier = Modifier.semantics { heading() },
        )
        RoleText(
            text = stringResource(R.string.cap_optin_body),
            style = AppTheme.typography.callout,
            color = AppColorRole.TEXT,
        )
        Column(verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
            // Equal weight (DESIGN.md The Equal Weight Rule): both tonal Large, neither pre-selected.
            AppButton(
                label = stringResource(R.string.cap_optin_flat_only),
                variant = ButtonVariant.TONAL,
                size = ButtonSize.LARGE,
                action = { actions.onOptIn(false) },
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.OPTIN_FLAT_ONLY),
            )
            AppButton(
                label = stringResource(R.string.cap_optin_allow_worn),
                variant = ButtonVariant.TONAL,
                size = ButtonSize.LARGE,
                action = { actions.onOptIn(true) },
                fullWidth = true,
                modifier = Modifier.testTag(CaptureTestTags.OPTIN_ALLOW_WORN),
            )
        }
    }
}

@Composable
private fun UnderwearSheet(
    actions: PickerActions,
    modifier: Modifier = Modifier,
) {
    val title = stringResource(R.string.cap_family_underwear)
    CaptureSheet(onDismiss = actions::onDismissSheet, label = title, modifier = modifier) {
        RoleText(
            text = title,
            style = AppTheme.typography.title3,
            color = AppColorRole.TEXT,
            modifier = Modifier.semantics { heading() },
        )
        Column {
            UnderwearPick.entries.forEach { pick ->
                // C07 plain list row 52: label, chevron, full-width divider.
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = CaptureProposedTokens.listRowHeight)
                            .clickable(role = Role.Button) { actions.onUnderwearPick(pick) }
                            .testTag(CaptureTestTags.underwearPick(pick)),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RoleText(
                        text = stringResource(pick.label()),
                        style = AppTheme.typography.body,
                        color = AppColorRole.TEXT,
                        modifier = Modifier.weight(1f),
                    )
                    AppIcon(name = AppIconName.CHEVRON_RIGHT, size = AppIconSize.MD, tint = AppColorRole.TEXT_SECONDARY)
                }
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(
                            CaptureProposedTokens.darkEdge,
                        ).background(role(AppColorRole.DIVIDER)),
                )
            }
        }
    }
}
