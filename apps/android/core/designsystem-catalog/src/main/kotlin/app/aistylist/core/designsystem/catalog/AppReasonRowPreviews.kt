package app.aistylist.core.designsystem.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
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
import app.aistylist.core.designsystem.AppReasonRow
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.GalleryReasonRow
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.ComponentGallery

@Preview(name = "AppReasonRow states, light", heightDp = 400)
@Composable
private fun AppReasonRowStatesLightPreview() {
    AppReasonRowStates(scheme = AppScheme.LIGHT)
}

@Preview(name = "AppReasonRow states, dark", heightDp = 400)
@Composable
private fun AppReasonRowStatesDarkPreview() {
    AppReasonRowStates(scheme = AppScheme.DARK)
}

/** The largest font scale: every line wraps, and the disc grows with its icon. */
@Preview(name = "AppReasonRow, largest text", heightDp = 800, fontScale = 2f)
@Composable
private fun AppReasonRowLargestTextPreview() {
    AppReasonRowStates(scheme = AppScheme.LIGHT)
}

/** The gallery's C03 reason-row section: every `ComponentGallery.reasonRow` cell. */
@Composable
private fun AppReasonRowStates(
    scheme: AppScheme,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = scheme) {
        GalleryReasonRow(
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
        )
    }
}

/** Live controls for Android Studio's interactive preview mode. */
@Preview(name = "AppReasonRow playground", showBackground = true)
@Composable
private fun AppReasonRowPlaygroundPreview() {
    var label by remember { mutableStateOf(ComponentGallery.reasonRowLabel) }
    var fact by remember { mutableStateOf(ComponentGallery.reasonRowFact) }
    var freshness by remember { mutableStateOf(ComponentGallery.reasonRowFreshness) }
    var accessibilityLabel by remember { mutableStateOf(ComponentGallery.reasonRowAccessibilityLabel) }
    AppTheme {
        Column(
            modifier = Modifier.padding(AppTheme.spacing.space16.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            AppReasonRow(
                label = label,
                fact = fact,
                factIcon = ComponentGallery.reasonRowFactIcon,
                freshness = freshness,
                accessibilityLabel = accessibilityLabel,
            )
            OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("label") })
            OutlinedTextField(value = fact, onValueChange = { fact = it }, label = { Text("fact") })
            OutlinedTextField(value = freshness, onValueChange = { freshness = it }, label = { Text("freshness") })
            OutlinedTextField(
                value = accessibilityLabel,
                onValueChange = { accessibilityLabel = it },
                label = { Text("accessibilityLabel") },
            )
        }
    }
}
