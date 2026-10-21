package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppBadge
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.ComponentGallery

/**
 * C03 badges: one cell per `ComponentGallery.badge` entry with its label (each trial pill has its
 * own words), in generated order, tagged with its test id, on the sample host surface.
 */
@Composable
internal fun GalleryBadges(modifier: Modifier = Modifier) {
    GalleryFlow(
        modifier = modifier.badgeHostSurface(AppTheme.colors),
        horizontalSpacing = AppTheme.spacing.space16,
    ) {
        ComponentGallery.badge.forEach { entry ->
            GalleryCell(caption = entry.testId) {
                AppBadge(
                    variant = entry.variant,
                    size = entry.size,
                    modifier = Modifier.testTag(entry.testId),
                    label = entry.label,
                    hostSurface = ComponentGallery.badgeHostSurface,
                )
            }
        }
    }
}

/**
 * The sample host surface badges sit on (`ComponentGallery.badgeHostSurface`, whose colour the dot's
 * and count's ring takes), with room around them. The gallery and the badge playground share it.
 */
internal fun Modifier.badgeHostSurface(colors: AppColors): Modifier =
    background(colors.color(ComponentGallery.badgeHostSurface), RoundedCornerShape(AppTheme.radius.radius12.dp))
        .padding(AppTheme.spacing.space16.dp)
