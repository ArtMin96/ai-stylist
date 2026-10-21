package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.toTextStyle

/** One component cell of the gallery: the component, then its test id written below it. */
@Composable
internal fun GalleryCell(
    testId: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp)) {
        content()
        Text(
            text = testId,
            style = AppTheme.typography.caption.toTextStyle(),
            color = AppTheme.colors.color(AppColorRole.TEXT_SECONDARY),
        )
    }
}
