package app.aistylist.feature.capture.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppText
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.feature.capture.CaptureUiState

/** Debug test IDs (capture brief §10). */
object CaptureDebugTags {
    const val PANEL: String = "cap-debug-panel"
    const val SOURCE_CAMERA: String = "cap-debug-source-camera"
    const val SOURCE_FRAMES: String = "cap-debug-source-frames"
    const val SCREEN_READER_TOGGLE: String = "cap-debug-screenreader-toggle"
    const val SPOKEN_LOG: String = "cap-debug-spoken-log"
    const val LOCK_STATE: String = "cap-debug-lock-state"

    /** Not in the brief: the sweep screen's progress and result line. */
    const val SWEEP_STATUS: String = "cap-debug-sweep-status"

    fun frameSet(id: String): String = "cap-debug-frameset-$id"
}

private val PANEL_TOP = 120.dp
private val LIST_HEIGHT = 280.dp

/**
 * The debug panel over the capture screens: the lock state, the spoken log (the last three spoken
 * lines, so a screen-reader run is visible), and, expanded, the source switch, the screen-reader flag
 * and the frame-set list. It also feeds the interactive results log. `captureDebugPanel=0` hides it
 * (screenshots) but keeps the log.
 */
@Composable
fun CaptureDebugPanel(
    harness: CaptureHarness,
    state: CaptureUiState,
    spokenLog: List<String>,
    isScreenReaderForced: Boolean,
    onScreenReaderForced: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val snapshot = state.camera
    LaunchedEffect(harness, snapshot) { harness.record(snapshot) }
    if (!harness.args.showsPanel) return
    var isExpanded by rememberSaveable { mutableStateOf(false) }
    val ink = AppTheme.colors.color(AppColorRole.ON_INVERSE)
    Column(
        modifier =
            modifier
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(top = PANEL_TOP, start = AppTheme.spacing.space8.dp, end = AppTheme.spacing.space8.dp)
                .clip(RoundedCornerShape(AppTheme.radius.radius12.dp))
                .background(AppTheme.colors.color(AppColorRole.INVERSE_SURFACE).copy(alpha = PANEL_ALPHA))
                .padding(AppTheme.spacing.space8.dp)
                .testTag(CaptureDebugTags.PANEL),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp),
    ) {
        val lock =
            snapshot?.let {
                listOfNotNull(
                    it.phase.wire,
                    it.hint?.value,
                    if (it.isAnywayVisible) "anyway" else null,
                ).joinToString(" · ")
            } ?: "no camera step"
        val setName = harness.selectedSet?.id ?: "camera"
        Row(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
            AppText(
                text = "$setName · $lock",
                style = AppTheme.typography.caption,
                color = ink,
                modifier = Modifier.weight(1f).testTag(CaptureDebugTags.LOCK_STATE),
            )
            DebugButton(if (isExpanded) "Hide" else "Debug", ink) { isExpanded = !isExpanded }
        }
        if (isScreenReaderForced || spokenLog.isNotEmpty()) {
            AppText(
                text = spokenLog.joinToString("\n").ifEmpty { "(nothing spoken yet)" },
                style = AppTheme.typography.caption,
                color = ink,
                modifier = Modifier.testTag(CaptureDebugTags.SPOKEN_LOG),
            )
        }
        if (isExpanded) {
            Row(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                DebugButton("Camera", ink, Modifier.testTag(CaptureDebugTags.SOURCE_CAMERA)) { harness.play(null) }
                DebugButton(
                    "Screen reader: ${if (isScreenReaderForced) "on" else "off"}",
                    ink,
                    Modifier.testTag(CaptureDebugTags.SCREEN_READER_TOGGLE),
                ) { onScreenReaderForced(!isScreenReaderForced) }
            }
            FrameSetList(harness, ink)
        }
    }
}

private const val PANEL_ALPHA = 0.85f

@Composable
private fun FrameSetList(
    harness: CaptureHarness,
    ink: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
) {
    val sets = harness.index?.sets.orEmpty()
    if (sets.isEmpty()) {
        AppText(
            text = "No frames in ${harness.framesDir}",
            style = AppTheme.typography.caption,
            color = ink,
            modifier = modifier,
        )
        return
    }
    LazyColumn(modifier = modifier.heightIn(max = LIST_HEIGHT).testTag(CaptureDebugTags.SOURCE_FRAMES)) {
        items(sets, key = { it.id }) { set ->
            DebugButton(
                set.id,
                ink,
                Modifier.fillMaxWidth().testTag(CaptureDebugTags.frameSet(set.id)),
            ) { harness.play(set.id) }
        }
    }
}

@Composable
private fun DebugButton(
    text: String,
    ink: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    AppText(
        text = text,
        style = AppTheme.typography.labelSm,
        color = ink,
        modifier =
            modifier
                .minimumInteractiveComponentSize()
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = AppTheme.spacing.space4.dp),
    )
}
