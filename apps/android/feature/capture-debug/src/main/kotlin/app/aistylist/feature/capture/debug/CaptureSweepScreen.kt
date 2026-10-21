package app.aistylist.feature.capture.debug

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppButton
import app.aistylist.core.designsystem.AppText
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonVariant
import org.json.JSONObject

/**
 * The sweep screen (`captureSweep=1`): runs every frame set (or those starting with
 * `captureSweepFilter`) through [SweepRunner], appends each segment's line to
 * `capture-results.jsonl` and writes `capture-results.done` (set and line counts, the sources used)
 * at the end, so a recipe can wait for it and pull both.
 */
@Composable
fun CaptureSweepScreen(
    harness: CaptureHarness,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var status by remember { mutableStateOf("Sweep starting…") }
    LaunchedEffect(harness) {
        val analysis = harness.analysis
        val index = harness.index
        if (analysis == null || index == null) {
            status = "No frames in ${harness.framesDir}"
            harness.files.reset()
            harness.files.done.writeText(JSONObject().put("error", status).toString())
            return@LaunchedEffect
        }
        harness.files.reset()
        val sets = index.sets.filter { set -> harness.args.sweepFilter?.let { set.id.startsWith(it) } ?: true }
        var lines = 0
        sets.forEachIndexed { position, set ->
            status = "Sweep ${position + 1} of ${sets.size}: ${set.id}"
            val records = analysis.use { analyzer -> SweepRunner(index, analyzer).run(set) }
            records.forEach { harness.files.append(it.toJson()) }
            lines += records.size
        }
        val probe = analysis.probe
        val summary =
            JSONObject()
                .put("sets", sets.size)
                .put("lines", lines)
                .put("detector", probe?.boxes?.id)
                .put("pose", probe?.pose?.id)
        harness.files.done.writeText(summary.toString())
        status = "Sweep done: ${sets.size} sets, $lines lines → ${harness.files.results}"
    }
    Column(
        modifier = modifier.fillMaxSize().padding(AppTheme.spacing.space20.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        AppText(
            text = status,
            style = AppTheme.typography.callout,
            modifier = Modifier.testTag(CaptureDebugTags.SWEEP_STATUS),
        )
        AppButton(label = "Close", variant = ButtonVariant.SECONDARY, size = ButtonSize.MEDIUM, action = onDone)
    }
}
