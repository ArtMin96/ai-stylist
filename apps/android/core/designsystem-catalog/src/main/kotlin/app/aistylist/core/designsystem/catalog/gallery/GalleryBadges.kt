package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppBadge
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.ComponentGallery

/**
 * C03 badges: one cell per `ComponentGallery.badge` entry, in generated order, tagged with its test
 * id, on a fill of the sample host surface that the dot's and count's ring takes.
 */
@Composable
internal fun GalleryBadges(modifier: Modifier = Modifier) {
    val host = ComponentGallery.badgeHostSurface
    FlowRow(
        modifier =
            modifier
                .background(AppTheme.colors.color(host), RoundedCornerShape(AppTheme.radius.radius12.dp))
                .padding(AppTheme.spacing.space16.dp),
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        ComponentGallery.badge.forEach { entry ->
            GalleryCell(testId = entry.testId) {
                AppBadge(
                    variant = entry.variant,
                    size = entry.size,
                    modifier = Modifier.testTag(entry.testId),
                    label = ComponentGallery.badgeLabel,
                    hostSurface = host,
                )
            }
        }
    }
}
