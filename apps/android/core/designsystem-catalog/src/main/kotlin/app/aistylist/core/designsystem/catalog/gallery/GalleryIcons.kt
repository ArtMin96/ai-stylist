package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppIcon
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.PlaygroundOptions
import app.aistylist.core.designsystem.catalog.R
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconMetrics
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSet
import app.aistylist.core.designsystem.generated.AppIconSize

/** The playground tints: the host foregrounds and the status foregrounds (DESIGN.md "Icons (C02)"). */
private val PlaygroundTints =
    listOf(
        AppColorRole.TEXT,
        AppColorRole.TEXT_SECONDARY,
        AppColorRole.PRIMARY_TEXT,
        AppColorRole.SUCCESS_FG,
        AppColorRole.WARNING_FG,
        AppColorRole.ERROR_FG,
        AppColorRole.INFO_FG,
    )

/**
 * C02: a size and tint playground, then one group per [AppIconSet] with every glyph of that set
 * in generated order, each cell tagged with its test id and captioned with its glyph id. The
 * cells follow the system font scale; there is no text-size control.
 */
@Composable
internal fun GalleryIcons(modifier: Modifier = Modifier) {
    var size by remember { mutableStateOf(AppIconMetrics.defaultSize) }
    var tint by remember { mutableStateOf(AppColorRole.TEXT) }
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space24.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
            PlaygroundOptions(
                AppIconSize.entries,
                size,
                AppIconSize::id,
                title = stringResource(R.string.ds_gallery_icons_size),
            ) { size = it }
            PlaygroundOptions(
                PlaygroundTints,
                tint,
                AppColorRole::id,
                title = stringResource(R.string.ds_gallery_icons_tint),
            ) { tint = it }
        }
        AppIconSet.entries.forEach { set ->
            IconSetGroup(set = set, size = size, tint = tint)
        }
    }
}

@Composable
private fun IconSetGroup(
    set: AppIconSet,
    size: AppIconSize,
    tint: AppColorRole,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp)) {
        GalleryLabel(
            text = set.id,
            style = AppTheme.typography.headline,
            role = AppColorRole.TEXT,
            modifier = Modifier.semantics { heading() },
        )
        // Cells wrap as the icons grow.
        GalleryFlow {
            AppIconName.entries.filter { it.set == set }.forEach { name ->
                GalleryCell(
                    caption = name.id,
                    modifier = Modifier.testTag(name.testId),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    AppIcon(name = name, size = size, tint = tint)
                }
            }
        }
    }
}
