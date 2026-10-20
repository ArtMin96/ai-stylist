package app.aistylist.core.designsystem.catalog.gallery

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppIcon
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.R
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconMetrics
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSet
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.toTextStyle

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
        PlaygroundControl(title = R.string.ds_gallery_icons_size) {
            AppIconSize.entries.forEach { option ->
                FilterChip(selected = option == size, onClick = { size = option }, label = { Text(option.id) })
            }
        }
        PlaygroundControl(title = R.string.ds_gallery_icons_tint) {
            PlaygroundTints.forEach { option ->
                FilterChip(selected = option == tint, onClick = { tint = option }, label = { Text(option.id) })
            }
        }
        AppIconSet.entries.forEach { set ->
            IconSetGroup(set = set, size = size, tint = tint)
        }
    }
}

/** One labelled row of playground chips. */
@Composable
private fun PlaygroundControl(
    @StringRes title: Int,
    modifier: Modifier = Modifier,
    chips: @Composable FlowRowScope.() -> Unit,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp)) {
        Text(
            text = stringResource(title),
            style = AppTheme.typography.headline.toTextStyle(),
            color = AppTheme.colors.color(AppColorRole.TEXT),
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp), content = chips)
    }
}

@Composable
private fun IconSetGroup(
    set: AppIconSet,
    size: AppIconSize,
    tint: AppColorRole,
    modifier: Modifier = Modifier,
) {
    val captionColor = AppTheme.colors.color(AppColorRole.TEXT_SECONDARY)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp)) {
        Text(
            text = set.id,
            style = AppTheme.typography.headline.toTextStyle(),
            color = AppTheme.colors.color(AppColorRole.TEXT),
        )
        // Non-lazy, so every cell's test tag is in the tree; cells wrap as the icons grow.
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            AppIconName.entries.filter { it.set == set }.forEach { name ->
                Column(
                    modifier = Modifier.testTag(name.testId),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp),
                ) {
                    AppIcon(name = name, size = size, tint = tint)
                    Text(
                        text = name.id,
                        style = AppTheme.typography.caption.toTextStyle(),
                        color = captionColor,
                    )
                }
            }
        }
    }
}
