// The pure rules of AppButton from its contract (.impeccable/components/button.yaml): which state
// shows, which look it resolves to, and when an activation runs the action. No SwiftUI, so the tests
// check them without rendering. Public because the Xcode test run builds the package without
// testability (no `@testable import`). `nonisolated`: pure functions over Sendable token values.
public import DesignTokens

/// The state, look and activation rules of `AppButton`.
nonisolated public enum AppButtonRules {
  /// The state text announced while loading (parity: Android `stateDescription`), from the String Catalog
  /// key `app_button_loading`.
  public static var loadingStateText: String {
    AppStrings.localized("app_button_loading")
  }

  /// The state shown, first match wins: loading, disabled (not enabled), pressed, focused, enabled.
  public static func displayedState(loading: Bool, enabled: Bool, pressed: Bool, focused: Bool) -> ButtonState {
    if loading {
      return .loading
    }
    if !enabled {
      return .disabled
    }
    if pressed {
      return .pressed
    }
    return focused ? .focused : .enabled
  }

  /// The look to draw for the inputs; nil when the contract does not allow `variant` at `size`.
  public static func appearance(
    in spec: ButtonSpec,
    variant: ButtonVariant,
    size: ButtonSize,
    loading: Bool,
    enabled: Bool,
    pressed: Bool,
    focused: Bool
  ) -> ButtonAppearance? {
    let state = displayedState(loading: loading, enabled: enabled, pressed: pressed, focused: focused)
    return spec.appearance(variant: variant, size: size, state: state)
  }

  /// Whether `variant` at `size` is an allowed pair; a disallowed pair renders nothing.
  public static func isAllowed(_ variant: ButtonVariant, _ size: ButtonSize, in spec: ButtonSpec) -> Bool {
    spec.appearance(variant: variant, size: size, state: .enabled) != nil
  }

  /// Handles one activation (tap, keyboard, assistive): runs `action` only when enabled and not
  /// loading. `AppButton`'s only activation path.
  public static func activate(loading: Bool, enabled: Bool, action: () -> Void) {
    guard enabled, !loading else {
      return
    }
    action()
  }
}
