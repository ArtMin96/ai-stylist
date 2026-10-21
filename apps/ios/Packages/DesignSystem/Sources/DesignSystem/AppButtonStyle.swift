// The ButtonStyle behind AppButton: reads the interaction (pressed, focused, enabled) from SwiftUI,
// picks the look with AppButtonRules and draws it with AppButtonFace.
import DesignTokens
import SwiftUI

/// Draws an `AppButton` in the look of its displayed state.
struct AppButtonStyle: ButtonStyle {
  let label: String
  let variant: ButtonVariant
  let size: ButtonSize
  let leadingIcon: AppIconName?
  let fullWidth: Bool
  let loading: Bool

  func makeBody(configuration: Configuration) -> some View {
    AppButtonStyleBody(style: self, isPressed: configuration.isPressed)
  }
}

/// The style's view, so it can read the environment.
private struct AppButtonStyleBody: View {
  let style: AppButtonStyle
  let isPressed: Bool

  @Environment(\.appTheme) private var theme
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.isFocused) private var isFocused
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    if let appearance = AppButtonRules.appearance(
      in: theme.buttons,
      variant: style.variant,
      size: style.size,
      loading: style.loading,
      enabled: isEnabled,
      pressed: isPressed,
      focused: isFocused
    ) {
      AppButtonFace(
        label: style.label,
        appearance: appearance,
        leadingIcon: style.leadingIcon,
        loading: style.loading,
        fullWidth: style.fullWidth
      )
      .frame(minWidth: AppInteraction.minTouchTarget, minHeight: AppInteraction.minTouchTarget)
      .contentShape(.rect)
      .animation(AppInteraction.pressAnimation(reduceMotion: reduceMotion), value: appearance)
    }
  }
}
