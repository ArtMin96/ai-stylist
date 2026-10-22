package app.aistylist.feature.capture.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.feature.capture.domain.NormalizedPoint
import kotlin.math.max

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
internal fun LiveOutline(
    outline: List<NormalizedPoint>?,
    isSolid: Boolean,
    modifier: Modifier = Modifier,
) {
    val reduced = isReducedMotion()
    val durationMs = CaptureRules.Ios.MASK_INTERVAL_MS
    var shown by remember { mutableStateOf(outline) }
    var from by remember { mutableStateOf(outline) }
    val progress = remember { Animatable(1f) }
    LaunchedEffect(outline, reduced) {
        if (outline == null) return@LaunchedEffect
        val previous = shown
        from = if (previous != null && previous.size == outline.size) previous.lerp(from, progress.value) else outline
        shown = outline
        progress.snapTo(0f)
        progress.animateTo(1f, if (reduced) snap() else tween(durationMs, easing = LinearEasing))
    }
    val alpha by animateFloatAsState(
        targetValue = if (outline == null) 0f else 1f,
        animationSpec = if (reduced) snap() else tween(durationMs, easing = LinearEasing),
        label = "outline-alpha",
    )
    val target = shown ?: return
    val start = from ?: target
    val ink = role(AppColorRole.CAMERA_INK)
    val paper = role(AppColorRole.CAMERA_PAPER)
    Canvas(modifier = modifier.outlineSemantics(isShown = outline != null, isSolid = isSolid)) {
        if (alpha >
            0f
        ) {
            drawOutline(outlinePath(target.lerp(start, progress.value)), isSolid, OutlineInk(ink, paper, alpha))
        }
    }
}

/** `cap-outline` with its locked or unlocked state, only while an outline shows. */
private fun Modifier.outlineSemantics(
    isShown: Boolean,
    isSolid: Boolean,
): Modifier {
    if (!isShown) return this
    val state = if (isSolid) OUTLINE_UNLOCKED else OUTLINE_LOCKED
    return testTag(CaptureTestTags.OUTLINE).semantics { stateDescription = state }
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
private fun DrawScope.outlinePath(points: List<NormalizedPoint>): Path {
    val frameWidth = CaptureRules.AnalysisFrame.HEIGHT_PX.toFloat()
    val frameHeight = CaptureRules.AnalysisFrame.WIDTH_PX.toFloat()
    val scale = max(size.width / frameWidth, size.height / frameHeight)
    val origin = Offset((size.width - frameWidth * scale) / 2, (size.height - frameHeight * scale) / 2)
    return Path().apply {
        points.forEachIndexed { i, point ->
            val x = origin.x + point.x.toFloat() * frameWidth * scale
            val y = origin.y + point.y.toFloat() * frameHeight * scale
            if (i == 0) moveTo(x, y) else lineTo(x, y)
        }
        close()
    }
}
