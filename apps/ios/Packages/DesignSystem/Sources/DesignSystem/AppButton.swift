// AppButton: the C01 button (contract .impeccable/components/button.yaml, DESIGN.md "Buttons (C01)").
// Every look comes from the current theme's ButtonSpec; the caller attaches the test ID with
// `.accessibilityIdentifier(_:)`.
public import DesignTokens
public import SwiftUI

/// The app's button: a SwiftUI `Button` drawn from the C01 tokens of the current `\.appTheme`.
///
/// A `variant` and `size` pair the contract does not allow renders nothing. While `loading`, the
/// button keeps its enabled look and stays focusable, shows a spinner in the leading-icon slot,
/// is announced as "Loading" and ignores every activation.
public struct AppButton: View {
  private let label: String
  private let variant: ButtonVariant
  private let size: ButtonSize
  private let leadingIcon: AppIconName?
  private let fullWidth: Bool
  private let enabled: Bool
  private let loading: Bool
  private let action: () -> Void

  @Environment(\.appTheme) private var theme

  /// - Parameters:
  ///   - label: the visible text and the accessible name; it wraps, never truncates.
  ///   - leadingIcon: a decorative C02 glyph before the label, drawn at the look's icon step in the label
  ///     colour and hidden from VoiceOver.
  ///   - fullWidth: true fills the available width; false hugs the label.
  ///   - enabled: false shows the disabled look and blocks activation.
  ///   - loading: true while the request this button started runs.
  public init(
    _ label: String,
    variant: ButtonVariant,
    size: ButtonSize,
    leadingIcon: AppIconName? = nil,
    fullWidth: Bool = false,
    enabled: Bool = true,
    loading: Bool = false,
    action: @escaping () -> Void
  ) {
    self.label = label
    self.variant = variant
    self.size = size
    self.leadingIcon = leadingIcon
    self.fullWidth = fullWidth
    self.enabled = enabled
    self.loading = loading
    self.action = action
  }

  public var body: some View {
    if AppButtonRules.isAllowed(variant, size, in: theme.buttons) {
      Button {
        AppButtonRules.activate(loading: loading, enabled: enabled, action: action)
      } label: {
        Text(label)
      }
      .buttonStyle(
        AppButtonStyle(
          label: label,
          variant: variant,
          size: size,
          leadingIcon: leadingIcon,
          fullWidth: fullWidth,
          loading: loading
        )
      )
      .disabled(!enabled)
      .focusEffectDisabled()  // AppButtonFace draws the C01 focus ring instead of the system halo.
      .accessibilityValue(loading ? AppButtonRules.loadingStateText : "")
    }
  }
}
