package app.aistylist.core.designsystem.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppBadge
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.GalleryBadges
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.BadgeSize
import app.aistylist.core.designsystem.generated.BadgeState
import app.aistylist.core.designsystem.generated.BadgeVariant
import app.aistylist.core.designsystem.generated.ComponentGallery

@Preview(name = "AppBadge states, light", heightDp = 400)
@Composable
private fun AppBadgeStatesLightPreview() {
    AppBadgeStates(scheme = AppScheme.LIGHT)
}

@Preview(name = "AppBadge states, dark", heightDp = 400)
@Composable
private fun AppBadgeStatesDarkPreview() {
    AppBadgeStates(scheme = AppScheme.DARK)
}

/** The gallery's C03 badges section: every `ComponentGallery.badge` cell on the sample host surface. */
@Composable
private fun AppBadgeStates(
    scheme: AppScheme,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = scheme) {
        GalleryBadges(
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
        )
    }
}

/** Live controls for Android Studio's interactive preview mode, on the sample host surface. */
@Preview(name = "AppBadge playground", showBackground = true)
@Composable
private fun AppBadgePlaygroundPreview() {
    var variant by remember { mutableStateOf(BadgeVariant.COUNT) }
    var size by remember { mutableStateOf(BadgeSize.MEDIUM) }
    var label by remember { mutableStateOf(ComponentGallery.badgeLabel) }
    AppTheme {
        // Only the sizes the contract allows for the variant.
        val sizes = BadgeSize.entries.filter { AppTheme.badges.appearance(variant, it, BadgeState.ENABLED) != null }
        val shownSize = if (size in sizes) size else sizes.first()
        Column(
            modifier = Modifier.padding(AppTheme.spacing.space16.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            AppBadge(
                variant = variant,
                size = shownSize,
                modifier =
                    Modifier
                        .background(AppTheme.colors.color(ComponentGallery.badgeHostSurface))
                        .padding(AppTheme.spacing.space8.dp),
                label = label,
                hostSurface = ComponentGallery.badgeHostSurface,
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                BadgeVariant.entries.forEach { option ->
                    FilterChip(
                        selected = option == variant,
                        onClick = { variant = option },
                        label = { Text(option.id) },
                    )
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                sizes.forEach { option ->
                    FilterChip(selected = option == shownSize, onClick = { size = option }, label = { Text(option.id) })
                }
            }
            OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("label") })
        }
    }
}
