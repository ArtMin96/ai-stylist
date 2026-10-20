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
  let leadingIcon: Image?
  let loading: Bool
  let fullWidth: Bool

  @Environment(\.appTheme) private var theme

  package init(
    label: String,
    appearance: ButtonAppearance,
    leadingIcon: Image? = nil,
    loading: Bool = false,
    fullWidth: Bool = false
  ) {
    self.label = label
    self.appearance = appearance
    self.leadingIcon = leadingIcon
    self.loading = loading
    self.fullWidth = fullWidth
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

  /// The spinner while loading, else the leading icon; both decorative and sized by the slot tokens.
  @ViewBuilder private var leadingSlot: some View {
    if loading {
      ProgressView()
        .progressViewStyle(.circular)
        .tint(theme.color(appearance.spinnerColor ?? appearance.textColor))
        .frame(width: appearance.iconSize, height: appearance.iconSize)
        .accessibilityHidden(true)
    } else if let leadingIcon {
      leadingIcon
        .resizable()
        .scaledToFit()
        .frame(width: appearance.iconSize, height: appearance.iconSize)
        .accessibilityHidden(true)
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
