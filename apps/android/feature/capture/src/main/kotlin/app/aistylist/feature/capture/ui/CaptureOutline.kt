package app.aistylist.feature.capture.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.feature.capture.R
import app.aistylist.feature.capture.domain.LiveOutline
import app.aistylist.feature.capture.domain.NormalizedPoint
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The live outline of the item (capture brief "Live outline"): the guide's two-tone stroke
 * (camera-paper 2 over a camera-ink 4 halo, 3:1 over any picture), dashed while locked and solid with
 * round caps once unlocked, so the state never rests on colour. It moves to each new outline over
 * one mask interval and fades in when an item is found and out when it is lost; with reduced motion
 * it switches at once. [outline] is in analysis-frame space; it is drawn over a preview that fills
 * this box centre-cropped (the viewfinder's ContentScale.Crop). Test tag `cap-outline`, state
 * `locked` or `unlocked`, present only while an outline shows.
 */
@Composable
internal fun ItemOutline(
    live: LiveOutline?,
    isSolid: Boolean,
    modifier: Modifier = Modifier,
) {
    val outline = live?.points
    val reduced = isReducedMotion()
    val durationMs = CaptureRules.Mask.INTERVAL_MS
    val motion = rememberOutlineMotion(live, reduced, durationMs)
    val alpha by animateFloatAsState(
        targetValue = if (outline == null) 0f else 1f,
        animationSpec = if (reduced) snap() else tween(durationMs, easing = LinearEasing),
        label = "outline-alpha",
    )
    val drawn = motion.drawn() ?: return
    val ink = role(AppColorRole.CAMERA_INK)
    val paper = role(AppColorRole.CAMERA_PAPER)
    var area by remember { mutableStateOf(IntSize.Zero) }
    Box(modifier = modifier.onSizeChanged { area = it }) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            if (alpha > 0f) {
                val path = outlinePath(drawn.map { it.inPreview(size) })
                drawOutline(path, isSolid, OutlineInk(ink, paper, alpha))
            }
        }
        if (outline != null && area != IntSize.Zero) OutlineNode(outline, area, isSolid)
    }
}

/** Where the drawn outline is between masks: [shown] reached at [progress] 1, from [from] at 0. */
private class OutlineMotion {
    var shown by mutableStateOf<LiveOutline?>(null)
    var from by mutableStateOf<List<NormalizedPoint>?>(null)
    val progress = Animatable(1f)

    fun drawn(): List<NormalizedPoint>? = shown?.points?.lerp(from, progress.value)
}

/** A blend moves from where the outline is drawn now over one mask interval; a snap (new item, big change) jumps. */
@Composable
private fun rememberOutlineMotion(
    live: LiveOutline?,
    reduced: Boolean,
    durationMs: Int,
): OutlineMotion {
    val motion = remember { OutlineMotion() }
    LaunchedEffect(live, reduced) {
        if (live == null) return@LaunchedEffect
        val previous = motion.shown
        val blends = previous != null && previous.snapCount == live.snapCount
        motion.from =
            if (previous != null && blends) previous.points.lerp(motion.from, motion.progress.value) else live.points
        motion.shown = live
        motion.progress.snapTo(0f)
        motion.progress.animateTo(1f, if (reduced || !blends) snap() else tween(durationMs, easing = LinearEasing))
    }
    return motion
}

/**
 * The outline's accessibility node, `cap-outline` with its locked or unlocked state, on the outline's
 * own box: Compose drops a node a later sibling covers entirely, and the `cap-guide-*` node under it
 * must stay (the shared flows assert it).
 */
@Composable
private fun OutlineNode(
    outline: List<NormalizedPoint>,
    area: IntSize,
    isSolid: Boolean,
) {
    val corners = outline.map { it.inPreview(Size(area.width.toFloat(), area.height.toFloat())) }
    val left = corners.minOf { it.x }.coerceAtLeast(0f)
    val top = corners.minOf { it.y }.coerceAtLeast(0f)
    val right = corners.maxOf { it.x }.coerceAtMost(area.width.toFloat())
    val bottom = corners.maxOf { it.y }.coerceAtMost(area.height.toFloat())
    val density = LocalDensity.current
    val label = stringResource(R.string.cap_a11y_outline)
    Box(
        modifier =
            Modifier
                .offset { IntOffset(left.roundToInt(), top.roundToInt()) }
                .size(
                    with(density) {
                        (right - left).coerceAtLeast(0f).toDp()
                    },
                    with(density) { (bottom - top).coerceAtLeast(0f).toDp() },
                ).outlineSemantics(isShown = true, isSolid = isSolid, label = label),
    )
}

/** `cap-outline` with its locked or unlocked state, only while an outline shows. */
private fun Modifier.outlineSemantics(
    isShown: Boolean,
    isSolid: Boolean,
    label: String,
): Modifier {
    if (!isShown) return this
    val state = if (isSolid) OUTLINE_UNLOCKED else OUTLINE_LOCKED
    return testTag(CaptureTestTags.OUTLINE).semantics {
        contentDescription = label
        stateDescription = state
    }
}

private class OutlineInk(
    val halo: Color,
    val line: Color,
    val alpha: Float,
)

/** The guide's two-tone stroke along [path]: dashed with butt caps while locked, solid and round once unlocked. */
private fun DrawScope.drawOutline(
    path: Path,
    isSolid: Boolean,
    ink: OutlineInk,
) {
    val dash = if (isSolid) null else dashEffect(CaptureProposedTokens.guideDash.toPx())
    val cap = if (isSolid) StrokeCap.Round else StrokeCap.Butt
    val halo = Stroke(CaptureProposedTokens.guideHalo.toPx(), cap = cap, join = StrokeJoin.Round, pathEffect = dash)
    val line = Stroke(CaptureProposedTokens.guideStroke.toPx(), cap = cap, join = StrokeJoin.Round, pathEffect = dash)
    drawPath(path, ink.halo, alpha = ink.alpha, style = halo)
    drawPath(path, ink.line, alpha = ink.alpha, style = line)
}

/** The outline's semantics state, as the shared flows assert it (`cap-outline` locked or unlocked). */
internal const val OUTLINE_LOCKED: String = "locked"
internal const val OUTLINE_UNLOCKED: String = "unlocked"

/** [this] outline at [progress] of the way from [start] (0) to [this] (1), point by point. */
private fun List<NormalizedPoint>.lerp(
    start: List<NormalizedPoint>?,
    progress: Float,
): List<NormalizedPoint> {
    if (start == null || start.size != size || progress >= 1f) return this
    return mapIndexed { i, end ->
        val begin = start[i]
        NormalizedPoint(begin.x + (end.x - begin.x) * progress, begin.y + (end.y - begin.y) * progress)
    }
}

/** The closed outline in this box: the analysis frame (portrait) scaled to fill it, centre-cropped. */
private fun outlinePath(points: List<Offset>): Path =
    Path().apply {
        points.forEachIndexed { i, point -> if (i == 0) moveTo(point.x, point.y) else lineTo(point.x, point.y) }
        close()
    }

/** [this] analysis-frame point in a box of [size]: the frame (portrait) scaled to fill it, centre-cropped. */
private fun NormalizedPoint.inPreview(size: Size): Offset {
    val frameWidth = CaptureRules.AnalysisFrame.HEIGHT_PX.toFloat()
    val frameHeight = CaptureRules.AnalysisFrame.WIDTH_PX.toFloat()
    val scale = max(size.width / frameWidth, size.height / frameHeight)
    return Offset(
        (size.width - frameWidth * scale) / 2 + x.toFloat() * frameWidth * scale,
        (size.height - frameHeight * scale) / 2 + y.toFloat() * frameHeight * scale,
    )
}
