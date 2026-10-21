package app.aistylist.core.designsystem

import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.ChipAccessibility
import app.aistylist.core.designsystem.generated.ChipRole
import app.aistylist.core.designsystem.generated.ChipSelection
import app.aistylist.core.designsystem.generated.ChipSize
import app.aistylist.core.designsystem.generated.ChipState
import app.aistylist.core.designsystem.generated.ChipVariant

/**
 * The C03 chip (`.impeccable/components/chip.yaml`), every tappable chip. Its look comes only from
 * `AppTheme.chips`. When the resting state (the state rule with no interaction) has no look at
 * [variant] × [size], the chip renders nothing: a size, a toggle or `enabled = false` the variant
 * does not take. [selection] matters only for a selectable variant. A chip is disabled through
 * [enabled] only; its look follows that prop, and an interaction state with no look shows the
 * resting look.
 *
 * It is one accessibility element named [accessibilityLabel] or [label], in the role of
 * `variant.role`; its icons, swatch, prefix and detail are not read. Activation runs [action] once
 * in every state but the disabled ones. The hit area is at least `ChipAccessibility.minTouchTarget`
 * (48 dp) square at every size.
 */
@Composable
fun AppChip(
    label: String,
    variant: ChipVariant,
    size: ChipSize,
    action: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: AppIconName? = null,
    selected: Boolean = false,
    expanded: Boolean = false,
    enabled: Boolean = true,
    selection: ChipSelection = ChipSelection.MULTIPLE,
    prefix: String? = null,
    detail: String? = null,
    swatch: Color? = null,
    accessibilityLabel: String? = null,
) {
    val chips = AppTheme.chips
    val resting =
        displayedChipState(
            selected = selected,
            expanded = expanded,
            enabled = enabled,
            pressed = false,
            focused = false,
        )
    val restingAppearance = resting?.let { chips.appearance(variant, size, it) } ?: return
    val interaction = rememberControlInteraction()
    val state =
        displayedChipState(
            selected = selected,
            expanded = expanded,
            enabled = enabled,
            pressed = interaction.pressed,
            focused = interaction.focused,
        )
            ?: resting
    val activatable = state.isActivatable
    val name = accessibilityLabel ?: label
    val disclosureState =
        stringResource(if (expanded) R.string.ds_chip_state_expanded else R.string.ds_chip_state_collapsed)
    val activation =
        when (variant.role) {
            ChipRole.BUTTON -> {
                Modifier.clickable(
                    interaction.source,
                    null,
                    enabled = activatable,
                    role = Role.Button,
                    onClick = action,
                )
            }

            ChipRole.SELECTABLE -> {
                Modifier.selectableChip(selection, selected = selected, enabled = activatable, interaction, action)
            }

            ChipRole.DISCLOSURE -> {
                Modifier.disclosureChip(
                    expanded = expanded,
                    disclosureState,
                    enabled = activatable,
                    interaction,
                    action,
                )
            }

            ChipRole.MENU -> {
                Modifier.menuChip(selected = selected, enabled = activatable, interaction, action)
            }
        }
    ProvideTouchTarget(ChipAccessibility.minTouchTarget) {
        AppChipFace(
            appearance = chips.appearance(variant, size, state) ?: restingAppearance,
            variant = variant,
            label = label,
            modifier =
                modifier
                    .semantics { contentDescription = name }
                    .then(activation)
                    .minimumInteractiveComponentSize()
                    // Innermost, so the role, state and actions above stay and only the content is hidden.
                    .hideContentSemantics(),
            leadingIcon = leadingIcon,
            prefix = prefix,
            detail = detail,
            swatch = swatch,
        )
    }
}

/** A selectable chip: a checkbox toggle in a multiple selection, a radio button in a single one. */
private fun Modifier.selectableChip(
    selection: ChipSelection,
    selected: Boolean,
    enabled: Boolean,
    interaction: ControlInteraction,
    action: () -> Unit,
): Modifier =
    when (selection) {
        ChipSelection.MULTIPLE -> {
            toggleable(
                value = selected,
                interactionSource = interaction.source,
                indication = null,
                enabled = enabled,
                role = Role.Checkbox,
                onValueChange = { action() },
            )
        }

        ChipSelection.SINGLE -> {
            selectable(
                selected = selected,
                interactionSource = interaction.source,
                indication = null,
                enabled = enabled,
                role = Role.RadioButton,
                onClick = action,
            )
        }
    }

/** The reason chip: a button that says expanded or collapsed and expands or collapses through [action]. */
private fun Modifier.disclosureChip(
    expanded: Boolean,
    stateWords: String,
    enabled: Boolean,
    interaction: ControlInteraction,
    action: () -> Unit,
): Modifier =
    semantics {
        stateDescription = stateWords
        if (enabled) {
            val toggle = {
                action()
                true
            }
            // Only the action that changes the state is offered.
            if (expanded) collapse(action = toggle) else expand(action = toggle)
        }
    }.clickable(interaction.source, null, enabled = enabled, role = Role.Button, onClick = action)

/** A chip that opens a list: a drop-down list, marked selected while selected. */
private fun Modifier.menuChip(
    selected: Boolean,
    enabled: Boolean,
    interaction: ControlInteraction,
    action: () -> Unit,
): Modifier =
    semantics { if (selected) this.selected = true }
        .clickable(interaction.source, null, enabled = enabled, role = Role.DropdownList, onClick = action)

/**
 * The state shown (contract G2), first match wins: disabled if not [enabled], else pressed, else
 * focused, else none; prefixed `selected-` while [selected] and `expanded-` while [expanded]. Null
 * when no state has that combination (both toggles on, or expanded and disabled).
 */
internal fun displayedChipState(
    selected: Boolean,
    expanded: Boolean,
    enabled: Boolean,
    pressed: Boolean,
    focused: Boolean,
): ChipState? {
    if (selected && expanded) return null
    val toggle = chipToggle(selected, expanded)
    val interaction = chipInteraction(enabled, pressed, focused)
    if (toggle == null) return interaction ?: ChipState.ENABLED
    if (interaction == null) return toggle
    // A compound state's contract id is "<toggle>-<interaction>" (G2).
    return ChipState.entries.firstOrNull { it.id == "${toggle.id}-${interaction.id}" }
}

/** The toggle that is on, if any. */
private fun chipToggle(
    selected: Boolean,
    expanded: Boolean,
): ChipState? =
    when {
        selected -> ChipState.SELECTED
        expanded -> ChipState.EXPANDED
        else -> null
    }

/** The interaction shown, first match wins: disabled, pressed, focused; none at rest. */
private fun chipInteraction(
    enabled: Boolean,
    pressed: Boolean,
    focused: Boolean,
): ChipState? =
    when {
        !enabled -> ChipState.DISABLED
        pressed -> ChipState.PRESSED
        focused -> ChipState.FOCUSED
        else -> null
    }

/** Whether an activation in this state runs the action: never while disabled. */
internal val ChipState.isActivatable: Boolean
    get() = this != ChipState.DISABLED && this != ChipState.SELECTED_DISABLED
