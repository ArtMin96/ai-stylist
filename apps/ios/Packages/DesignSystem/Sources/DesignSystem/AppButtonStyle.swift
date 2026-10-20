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
  /// The minimum touch target on iOS, in points, for every size (contract
  /// `accessibility.minTouchTarget.ios`; DESIGN.md Layout "Touch targets"). No token carries it yet.
  private static let minTouchTarget: CGFloat = 44
  /// `AppMotion.Press.duration` is in milliseconds.
  private static let millisecondsPerSecond = 1000.0

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
      .frame(minWidth: Self.minTouchTarget, minHeight: Self.minTouchTarget)
      .contentShape(.rect)
      .animation(reduceMotion ? nil : Self.pressAnimation, value: appearance)
    }
  }

  /// The pressed transition: `AppMotion.Press` duration and easing (a cubic Bézier).
  private static var pressAnimation: Animation {
    let seconds = AppMotion.Press.duration / millisecondsPerSecond
    let curve = AppMotion.Press.easing
    guard curve.count == 4 else {
      return .linear(duration: seconds)
    }
    return .timingCurve(curve[0], curve[1], curve[2], curve[3], duration: seconds)
  }
}
