package app.aistylist.core.designsystem.catalog

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import app.aistylist.core.designsystem.AppReasonRow
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.GalleryComponent

@Preview(name = "AppReasonRow states, light", heightDp = 400)
@Composable
private fun AppReasonRowStatesLightPreview() {
    StateGrid(GalleryComponent.REASON_ROW, dark = false)
}

@Preview(name = "AppReasonRow states, dark", heightDp = 400)
@Composable
private fun AppReasonRowStatesDarkPreview() {
    StateGrid(GalleryComponent.REASON_ROW, dark = true)
}

/** The largest font scale: every line wraps, and the disc grows with its icon. */
@Preview(name = "AppReasonRow, largest text", heightDp = 800, fontScale = 2f)
@Composable
private fun AppReasonRowLargestTextPreview() {
    StateGrid(GalleryComponent.REASON_ROW, dark = false)
}

/** The playground's props: the row's texts. */
private data class ReasonRowProps(
    val label: String = ComponentGallery.reasonRowLabel,
    val fact: String = ComponentGallery.reasonRowFact,
    val freshness: String = ComponentGallery.reasonRowFreshness,
    val accessibilityLabel: String = ComponentGallery.reasonRowAccessibilityLabel,
)

/** Live controls for Android Studio's interactive preview mode. */
@Preview(name = "AppReasonRow playground", showBackground = true)
@Composable
private fun AppReasonRowPlaygroundPreview() {
    Playground(ReasonRowProps()) { props, update ->
        AppReasonRow(
            label = props.label,
            fact = props.fact,
            factIcon = ComponentGallery.reasonRowFactIcon,
            freshness = props.freshness,
            accessibilityLabel = props.accessibilityLabel,
        )
        PlaygroundTextField("label", props.label) { update(props.copy(label = it)) }
        PlaygroundTextField("fact", props.fact) { update(props.copy(fact = it)) }
        PlaygroundTextField("freshness", props.freshness) { update(props.copy(freshness = it)) }
        PlaygroundTextField("accessibilityLabel", props.accessibilityLabel) {
            update(props.copy(accessibilityLabel = it))
        }
    }
}
