package app.aistylist.feature.capture.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.dropShadow
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.aistylist.core.designsystem.AppIcon
import app.aistylist.core.designsystem.AppText
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppElevation
import app.aistylist.core.designsystem.generated.AppIconMetrics
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.generated.AppTextStyle
import kotlin.math.min

/** The colour of [role] in the active scheme. */
@Composable
@ReadOnlyComposable
internal fun role(role: AppColorRole): Color = AppTheme.colors.color(role)

/** Tokens are numbers in dp; this reads one as a [Dp]. */
internal val Double.tokenDp: Dp get() = dp

/**
 * S2 draws the camera chrome's 1 px divider ring and the yellow selected mode (SC04); the camera
 * ground itself is the same in every scheme. High contrast dark follows dark.
 */
@Composable
@ReadOnlyComposable
internal fun isDarkScheme(): Boolean = isSystemInDarkTheme()

/** A DESIGN.md elevation (`offsetY`, `blur`, ARGB `color`) as a drop shadow under [shape]. */
internal fun Modifier.elevation(
    shape: Shape,
    offsetY: Double,
    blur: Double,
    color: Long,
): Modifier = dropShadow(shape, Shadow(radius = blur.dp, color = Color(color), offset = DpOffset(0.dp, offsetY.dp)))

/** The snackbar elevation (the hint card, SC04). */
@Composable
@ReadOnlyComposable
internal fun Modifier.snackbarElevation(shape: Shape): Modifier =
    if (isDarkScheme()) {
        with(AppElevation.SnackbarDark) { elevation(shape, offsetY, blur, color) }
    } else {
        with(AppElevation.SnackbarLight) { elevation(shape, offsetY, blur, color) }
    }

/** [pathData] (SVG) parsed once. */
@Composable
internal fun rememberSvgPath(pathData: String): Path =
    remember(pathData) { PathParser().parsePathString(pathData).toPath() }

/** Draws [path], laid out in a [viewport] box, scaled uniformly and centred in this draw scope. */
internal fun DrawScope.drawInViewport(
    path: Path,
    viewport: Size,
    stroke: Stroke,
    color: Color,
) {
    val scale = min(size.width / viewport.width, size.height / viewport.height)
    val dx = (size.width - viewport.width * scale) / 2
    val dy = (size.height - viewport.height * scale) / 2
    withTransform({
        translate(dx, dy)
        scale(scale, scale, pivot = androidx.compose.ui.geometry.Offset.Zero)
    }) {
        drawPath(
            path,
            color,
            style = Stroke(stroke.width / scale, cap = stroke.cap, join = stroke.join, pathEffect = stroke.pathEffect),
        )
    }
}

/**
 * A proposed C02 glyph (speaker, speaker-off: C11 board) drawn like `AppIcon`: 24 grid, stroke 1.7,
 * round caps and joins, decorative, growing with the font scale.
 */
@Composable
internal fun ProposedGlyph(
    pathData: String,
    color: Color,
    modifier: Modifier = Modifier,
    size: AppIconSize = AppIconMetrics.defaultSize,
) {
    val path = rememberSvgPath(pathData)
    // Like AppIcon: the step is treated as sp, so the glyph grows with the font scale.
    val rendered = with(LocalDensity.current) { size.size.sp.toDp() }
    Canvas(modifier = modifier.size(rendered)) {
        drawInViewport(
            path,
            Size(GLYPH_GRID, GLYPH_GRID),
            Stroke(width = GLYPH_STROKE * this.size.width / GLYPH_GRID, cap = StrokeCap.Round, join = StrokeJoin.Round),
            color,
        )
    }
}

private const val GLYPH_GRID = 24f
private const val GLYPH_STROKE = 1.7f

/** A dashed stroke effect of [dash] on, [dash] off. */
internal fun dashEffect(dashPx: Float): PathEffect = PathEffect.dashPathEffect(floatArrayOf(dashPx, dashPx))

/**
 * An icon-only control: a 48 dp target around an [AppIcon] (or [content]), named [label] for
 * assistive tech (DESIGN.md "Icon buttons": verb + object).
 */
@Composable
internal fun IconControl(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier =
            modifier
                .minimumInteractiveComponentSize()
                .clip(RoundedCornerShape(AppTheme.radius.full.dp))
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/** An [IconControl] showing a C02 glyph in [tint]. */
@Composable
internal fun IconButtonGlyph(
    icon: AppIconName,
    label: String,
    tint: AppColorRole,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    IconControl(label = label, onClick = onClick, modifier = modifier) {
        AppIcon(name = icon, size = AppIconSize.LG, tint = tint)
    }
}

/** The full-screen modal header (C09, 56): close left, title centred, divider below. */
@Composable
internal fun ModalHeader(
    title: String,
    onClose: () -> Unit,
    closeTag: String,
    closeLabel: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(CaptureProposedTokens.modalHeaderHeight)
                    .padding(horizontal = AppTheme.spacing.space12.dp),
        ) {
            IconButtonGlyph(
                icon = AppIconName.CLOSE,
                label = closeLabel,
                tint = AppColorRole.TEXT,
                onClick = onClose,
                modifier = Modifier.align(Alignment.CenterStart).testTag(closeTag),
            )
            AppText(
                text = title,
                style = AppTheme.typography.headline,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .padding(horizontal = AppTheme.spacing.space48.dp)
                        .semantics { heading() },
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(
                        CaptureProposedTokens.darkEdge,
                    ).background(role(AppColorRole.DIVIDER)),
        )
    }
}

/**
 * A C09 bottom sheet over the screen it belongs to, drawn in the same window so its test tags stay
 * resource ids: scrim, surface with top radius 24, handle, sheet elevation. Back and a scrim tap
 * call [onDismiss].
 */
@Composable
internal fun CaptureSheet(
    onDismiss: () -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    BackHandler(onBack = onDismiss)
    val dark = isDarkScheme()
    val shape = RoundedCornerShape(topStart = AppTheme.radius.radius24.dp, topEnd = AppTheme.radius.radius24.dp)
    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(role(AppColorRole.SCRIM))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onDismiss,
                    ),
        )
        Column(
            modifier =
                modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .then(
                        if (dark) {
                            with(AppElevation.SheetDark) { Modifier.elevation(shape, offsetY, blur, color) }
                        } else {
                            with(AppElevation.SheetLight) { Modifier.elevation(shape, offsetY, blur, color) }
                        },
                    ).clip(shape)
                    .background(role(AppColorRole.SURFACE))
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
                    ).clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = {},
                    ).navigationBarsPadding()
                    .padding(
                        start = AppTheme.spacing.space20.dp,
                        end = AppTheme.spacing.space20.dp,
                        top = CaptureProposedTokens.sheetPaddingTop,
                        bottom = CaptureProposedTokens.sheetPaddingBottom,
                    ).semantics { contentDescription = label },
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterHorizontally)
                        .width(CaptureProposedTokens.sheetHandleWidth)
                        .height(CaptureProposedTokens.sheetHandleHeight)
                        .clip(RoundedCornerShape(AppTheme.radius.radius2.dp))
                        .background(role(AppColorRole.OUTLINE)),
            )
            content()
        }
    }
}

/** A text in [style] coloured by [color] role. */
@Composable
internal fun RoleText(
    text: String,
    style: AppTextStyle,
    color: AppColorRole,
    modifier: Modifier = Modifier,
    textAlign: TextAlign? = null,
) {
    AppText(text = text, style = style, color = role(color), modifier = modifier, textAlign = textAlign)
}
