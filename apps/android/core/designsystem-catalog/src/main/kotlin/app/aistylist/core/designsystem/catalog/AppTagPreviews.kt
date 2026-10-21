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
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTag
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.GalleryTags
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.TagSize
import app.aistylist.core.designsystem.generated.TagState
import app.aistylist.core.designsystem.generated.TagVariant

@Preview(name = "AppTag states, light", heightDp = 1200)
@Composable
private fun AppTagStatesLightPreview() {
    AppTagStates(scheme = AppScheme.LIGHT)
}

@Preview(name = "AppTag states, dark", heightDp = 1200)
@Composable
private fun AppTagStatesDarkPreview() {
    AppTagStates(scheme = AppScheme.DARK)
}

/** The gallery's C03 tags section: every `ComponentGallery.tag` cell. */
@Composable
private fun AppTagStates(
    scheme: AppScheme,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = scheme) {
        GalleryTags(
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
        )
    }
}

/** Live controls for Android Studio's interactive preview mode. */
@Preview(name = "AppTag playground", showBackground = true)
@Composable
private fun AppTagPlaygroundPreview() {
    var variant by remember { mutableStateOf(TagVariant.PLAN_PLUS) }
    var size by remember { mutableStateOf(TagSize.REGULAR) }
    var label by remember { mutableStateOf(ComponentGallery.tagLabel) }
    AppTheme {
        // Only the sizes the contract allows for the variant.
        val sizes = TagSize.entries.filter { AppTheme.tags.appearance(variant, it, TagState.ENABLED) != null }
        val shownSize = if (size in sizes) size else sizes.first()
        Column(
            modifier = Modifier.padding(AppTheme.spacing.space16.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            AppTag(label = label, variant = variant, size = shownSize, leadingIcon = ComponentGallery.tagLeadingIcon)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                TagVariant.entries.forEach { option ->
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
