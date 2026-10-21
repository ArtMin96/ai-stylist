// The ButtonStyle behind AppChip: reads the interaction (pressed, focused, enabled) from SwiftUI, picks the
// look with AppChipRules and draws it with AppChipFace inside the 44 pt touch target.
import DesignTokens
import SwiftUI

/// Draws an `AppChip` in the look of its displayed state.
struct AppChipStyle: ButtonStyle {
  let label: String
  let variant: ChipVariant
  let size: ChipSize
  let leadingIcon: AppIconName?
  let selected: Bool
  let expanded: Bool
  let prefix: String?
  let detail: String?
  let swatch: Color?

  func makeBody(configuration: Configuration) -> some View {
    AppChipStyleBody(style: self, isPressed: configuration.isPressed)
  }
}

/// The style's view, so it can read the environment.
private struct AppChipStyleBody: View {
  let style: AppChipStyle
  let isPressed: Bool

  @Environment(\.appTheme) private var theme
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.isFocused) private var isFocused
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    if let appearance = AppChipRules.appearance(
      in: theme.chips,
      variant: style.variant,
      size: style.size,
      selected: style.selected,
      expanded: style.expanded,
      enabled: isEnabled,
      pressed: isPressed,
      focused: isFocused
    ) {
      AppChipFace(
        label: style.label,
        variant: style.variant,
        appearance: appearance,
        leadingIcon: style.leadingIcon,
        prefix: style.prefix,
        detail: style.detail,
        swatch: style.swatch
      )
      // The hit area is part of the layout, so a wrapping row of chips sits 44 pt apart.
      .frame(minWidth: AppInteraction.minTouchTarget, minHeight: AppInteraction.minTouchTarget)
      .contentShape(.rect)
      .animation(AppInteraction.pressAnimation(reduceMotion: reduceMotion), value: appearance)
    }
  }
}
