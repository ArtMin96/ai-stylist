// Draws one resolved AppButton look. AppButtonStyle uses it for the live button; the dev-only
// DesignSystemCatalog target (gallery C01 section, previews) uses it to draw forced states (pressed,
// focused, loading, disabled). `package` access: visible to the catalog in this SwiftPM package, never
// to HomeFeature or the app, which use AppButton.
package import DesignTokens
package import SwiftUI

/// The visible pill of an `AppButton` in a given `ButtonAppearance`; no interaction of its own.
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
    let shape = RoundedRectangle(cornerRadius: appearance.rounded)
    HStack(spacing: appearance.iconGap) {
      leadingSlot
      Text(label)
        .font(theme.font(appearance.typography))
        .tracking(appearance.typography.letterSpacing)
        .multilineTextAlignment(.center)
        .lineLimit(nil)
        .fixedSize(horizontal: false, vertical: true)
    }
    .foregroundStyle(theme.color(appearance.textColor))
    .padding(
      EdgeInsets(
        top: appearance.paddingTop,
        leading: appearance.paddingStart,
        bottom: appearance.paddingBottom,
        trailing: appearance.paddingEnd
      )
    )
    .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: appearance.height)
    .background {
      shape.fill(appearance.backgroundColor.map(theme.color) ?? .clear)
      if let overlay = appearance.overlayColor {
        shape.fill(theme.color(overlay))
      }
    }
    .overlay {
      if let border = appearance.borderColor, let width = appearance.borderWidth {
        shape.strokeBorder(theme.color(border), lineWidth: width)
      }
    }
    .overlay {
      if let ring = appearance.focusRing {
        focusRing(ring)
      }
    }
  }

  /// The spinner while loading, else the leading icon at the look's icon step, in the label colour
  /// inherited from the row; both decorative. The system spinner keeps one size under Dynamic Type, so it
  /// is scaled by the slot's Dynamic Type factor to grow like the icon it replaces.
  @ViewBuilder private var leadingSlot: some View {
    if loading {
      ProgressView()
        .progressViewStyle(.circular)
        .tint(theme.color(appearance.spinnerColor ?? appearance.textColor))
        .scaleEffect(slotSize / appearance.iconSize.size)
        .frame(width: slotSize, height: slotSize)
        .accessibilityHidden(true)
    } else if let leadingIcon {
      AppIcon(leadingIcon, size: appearance.iconSize)
    }
  }

  /// The focus ring: outside the pill by `offset`, following its corners.
  private func focusRing(_ ring: FocusRingTokens) -> some View {
    let outset = ring.offset + ring.width
    return RoundedRectangle(cornerRadius: appearance.rounded + outset)
      .strokeBorder(theme.color(ring.color), lineWidth: ring.width)
      .padding(-outset)
  }
}
