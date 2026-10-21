package app.aistylist.core.designsystem.catalog

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import app.aistylist.core.designsystem.AppBadge
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.badgeHostSurface
import app.aistylist.core.designsystem.generated.BadgeSize
import app.aistylist.core.designsystem.generated.BadgeState
import app.aistylist.core.designsystem.generated.BadgeVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.GalleryComponent

@Preview(name = "AppBadge states, light", heightDp = 400)
@Composable
private fun AppBadgeStatesLightPreview() {
    StateGrid(GalleryComponent.BADGE, dark = false)
}

@Preview(name = "AppBadge states, dark", heightDp = 400)
@Composable
private fun AppBadgeStatesDarkPreview() {
    StateGrid(GalleryComponent.BADGE, dark = true)
}

/** The playground's props: every AppBadge parameter it controls. */
private data class BadgeProps(
    val variant: BadgeVariant = BadgeVariant.COUNT,
    val size: BadgeSize = BadgeSize.MEDIUM,
    val label: String = ComponentGallery.badgeLabel,
)

/** Live controls for Android Studio's interactive preview mode, on the sample host surface. */
@Preview(name = "AppBadge playground", showBackground = true)
@Composable
private fun AppBadgePlaygroundPreview() {
    Playground(BadgeProps()) { props, update ->
        // Only the sizes the contract allows for the variant.
        val sizes =
            BadgeSize.entries.filter { AppTheme.badges.appearance(props.variant, it, BadgeState.ENABLED) != null }
        val shownSize = sizes.shownSize(props.size)
        AppBadge(
            variant = props.variant,
            size = shownSize,
            modifier = Modifier.badgeHostSurface(AppTheme.colors),
            label = props.label,
            hostSurface = ComponentGallery.badgeHostSurface,
        )
        PlaygroundOptions(BadgeVariant.entries, props.variant, BadgeVariant::id) { update(props.copy(variant = it)) }
        PlaygroundOptions(sizes, shownSize, BadgeSize::id) { update(props.copy(size = it)) }
        PlaygroundTextField("label", props.label) { update(props.copy(label = it)) }
    }
}
