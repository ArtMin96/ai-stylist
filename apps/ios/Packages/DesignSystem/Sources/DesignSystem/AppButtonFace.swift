// Draws one resolved AppButton look. AppButtonStyle uses it for the live button; the dev-only
// DesignSystemCatalog target (gallery C01 section, previews) uses it to draw forced states (pressed,
// focused, loading, disabled). `package` access: visible to the catalog in this SwiftPM package, never
// to HomeFeature or the app, which use AppButton.
package import DesignTokens
package import SwiftUI

/// The visible pill of an `AppButton` in a given `ButtonAppearance`, laid out and drawn by `appFace` (its fill,
/// pressed overlay, ring and focus ring come from `AppShapeStyle`); no interaction of its own.
package struct AppButtonFace: View {
  let label: String
  let appearance: ButtonAppearance
  let leadingIcon: AppIconName?
  let loading: Bool
  let fullWidth: Bool

  /// The leading slot's side: the icon step scaled with Dynamic Type exactly as `AppIcon` scales it
  /// (`AppIcon.scalingStyle(for:)`), so the spinner takes the icon's room and the button keeps its size while
  /// loading.
  @ScaledMetric private var slotSize: Double

  @Environment(\.appTheme) private var theme

  package init(
    label: String,
    appearance: ButtonAppearance,
    leadingIcon: AppIconName? = nil,
    loading: Bool = false,
    fullWidth: Bool = false
  ) {
    self.label = label
    self.appearance = appearance
    self.leadingIcon = leadingIcon
    self.loading = loading
    self.fullWidth = fullWidth
    _slotSize = ScaledMetric(
      wrappedValue: appearance.iconSize.size,
      relativeTo: AppIcon.scalingStyle(for: appearance.iconSize)
    )
  }

  package var body: some View {
    HStack(spacing: appearance.iconGap) {
      leadingSlot
      AppComponentText(text: label, style: appearance.typography, color: appearance.textColor, alignment: .center)
    }
    .appFace(appearance, maxWidth: fullWidth ? .infinity : nil)
  }

  /// The spinner while loading, else the leading icon at the look's icon step, in the label colour; both
  /// decorative. The system spinner keeps one size under Dynamic Type, so it is scaled by the slot's Dynamic
  /// Type factor to grow like the icon it replaces.
  @ViewBuilder private var leadingSlot: some View {
    if loading {
      ProgressView()
        .progressViewStyle(.circular)
        .tint(theme.color(appearance.spinnerColor ?? appearance.textColor))
        .scaleEffect(slotSize / appearance.iconSize.size)
        .frame(width: slotSize, height: slotSize)
        .accessibilityHidden(true)
    } else if let leadingIcon {
      AppIcon(leadingIcon, size: appearance.iconSize, tint: appearance.textColor)
    }
  }
}
