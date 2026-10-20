package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppButton
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.R
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.core.designsystem.generated.GalleryComponent
import app.aistylist.core.designsystem.toTextStyle

/**
 * The debug-only design-system gallery (AI-195): every token section, then every component
 * section, in one non-lazy scroll so every test tag is in the tree. Follows the system scheme
 * through the caller's `AppTheme`.
 */
@Composable
fun DesignSystemGalleryScreen(
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val resources = LocalResources.current
    val sections = remember(resources) { gallerySections(resources) }
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                .testTag(GalleryTestTags.ROOT)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = AppTheme.spacing.space20.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space24.dp),
    ) {
        GalleryHeader(onClose = onClose)
        sections.forEach { section -> GallerySectionView(section = section) }
    }
}

@Composable
private fun GalleryHeader(
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        Text(
            text = stringResource(R.string.ds_gallery_title),
            style = AppTheme.typography.title2.toTextStyle(),
            color = AppTheme.colors.color(AppColorRole.TEXT),
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        AppButton(
            label = stringResource(R.string.ds_gallery_close),
            variant = ButtonVariant.TEXT,
            size = ButtonSize.COMPACT,
            action = onClose,
            modifier = Modifier.testTag(GalleryTestTags.CLOSE),
        )
    }
}

@Composable
private fun GallerySectionView(
    section: GallerySection,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().testTag(section.id),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        Text(
            text = section.title,
            style = AppTheme.typography.title3.toTextStyle(),
            color = AppTheme.colors.color(AppColorRole.TEXT),
            modifier = Modifier.semantics { heading() },
        )
        when (val kind = section.kind) {
            GallerySectionKind.Colours -> {
                GalleryColours()
            }

            GallerySectionKind.Typography -> {
                GalleryTypography()
            }

            GallerySectionKind.Spacing -> {
                GallerySpacing()
            }

            GallerySectionKind.Radius -> {
                GalleryRadius()
            }

            // Exhaustive: a new component contract fails the build until it has a renderer.
            is GallerySectionKind.Component -> {
                when (kind.component) {
                    GalleryComponent.BUTTON -> GalleryButtons()
                }
            }
        }
    }
}

@Preview(name = "Gallery, light", heightDp = 2400)
@Composable
private fun GalleryLightPreview() {
    AppTheme(scheme = AppScheme.LIGHT) { DesignSystemGalleryScreen(onClose = {}) }
}

@Preview(name = "Gallery, dark", heightDp = 2400)
@Composable
private fun GalleryDarkPreview() {
    AppTheme(scheme = AppScheme.DARK) { DesignSystemGalleryScreen(onClose = {}) }
}
