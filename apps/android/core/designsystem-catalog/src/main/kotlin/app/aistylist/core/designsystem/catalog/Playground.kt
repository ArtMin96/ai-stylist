package app.aistylist.core.designsystem.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppText
import app.aistylist.core.designsystem.AppTheme

// The parts every component playground shares: the frame, its state, and its option and text controls.

/**
 * A component playground for Android Studio's interactive preview mode, in the system scheme. It
 * holds one props value, starting at [initial]; [content] draws the component and its controls from
 * the current props and replaces them through its `update` argument.
 */
@Composable
internal fun <P> Playground(
    initial: P,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.(props: P, update: (P) -> Unit) -> Unit,
) {
    var props by remember { mutableStateOf(initial) }
    AppTheme {
        Column(
            modifier = modifier.padding(AppTheme.spacing.space16.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            content(props) { props = it }
        }
    }
}

/**
 * One row of playground options under an optional [title]: a filter chip per option, named by
 * [name], with [selected] checked; picking one calls [onSelect].
 */
@Composable
internal fun <T> PlaygroundOptions(
    options: List<T>,
    selected: T,
    name: (T) -> String,
    modifier: Modifier = Modifier,
    title: String? = null,
    onSelect: (T) -> Unit,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp)) {
        title?.let { AppText(text = it, style = AppTheme.typography.headline) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
            options.forEach { option ->
                FilterChip(
                    selected = option == selected,
                    onClick = { onSelect(option) },
                    label = { Text(name(option)) },
                )
            }
        }
    }
}

/** One labelled text control of a playground. */
@Composable
internal fun PlaygroundTextField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(value = value, onValueChange = onValueChange, modifier = modifier, label = { Text(label) })
}

/** The size a playground shows: [chosen] while the variant allows it, else the first size it allows. */
internal fun <S> List<S>.shownSize(chosen: S): S = if (chosen in this) chosen else first()
