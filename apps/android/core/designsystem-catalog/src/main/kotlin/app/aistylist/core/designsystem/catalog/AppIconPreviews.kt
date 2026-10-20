package app.aistylist.core.designsystem.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.GalleryIcons
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole

// The playground plus seven groups of wrapped cells need about this much height.
@Preview(name = "AppIcon set, light", heightDp = 2400)
@Composable
private fun AppIconSetLightPreview() {
    AppIconSection(scheme = AppScheme.LIGHT)
}

@Preview(name = "AppIcon set, dark", heightDp = 2400)
@Composable
private fun AppIconSetDarkPreview() {
    AppIconSection(scheme = AppScheme.DARK)
}

/** The largest font scale: every icon and its stroke grow with the text. */
@Preview(name = "AppIcon set, largest text", heightDp = 4800, fontScale = 2f)
@Composable
private fun AppIconSetLargestTextPreview() {
    AppIconSection(scheme = AppScheme.LIGHT)
}

/** The gallery's C02 section on the scheme's background. */
@Composable
private fun AppIconSection(
    scheme: AppScheme,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = scheme) {
        GalleryIcons(
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
        )
    }
}
