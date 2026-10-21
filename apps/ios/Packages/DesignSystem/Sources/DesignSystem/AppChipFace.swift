// Draws one resolved AppChip look and its content (contract .impeccable/components/chip.yaml). AppChipStyle
// uses it for the live chip; the dev-only DesignSystemCatalog target (gallery C03 section, previews) uses it
// to draw forced states (pressed, focused, disabled, the toggles). `package` access: visible to the catalog
// in this SwiftPM package, never to the features or the app, which use AppChip.
package import DesignTokens
package import SwiftUI

/// The visible chip of an `AppChip` in a given `ChipAppearance`; no interaction of its own.
///
/// Content, in order: the leading icon, the before-label parts (swatch, prefix) in `variant.parts` order,
/// the label, the after-label part (detail), the trailing icon. Each gap sits on the label's side of its
/// element: `iconGap` after the leading icon, `swatchGap` and `prefixGap` after their parts, `detailGap`
/// before the detail, `trailingIconGap` before the trailing icon. A part is drawn only when the variant
/// lists it and its prop is non-nil.
package struct AppChipFace: View {
  let label: String
  let variant: ChipVariant
  let appearance: ChipAppearance
  let leadingIcon: AppIconName?
  let prefix: String?
  let detail: String?
  let swatch: Color?

  @Environment(\.appTheme) private var theme
  @Environment(\.self) private var environment

  package init(
    label: String,
    variant: ChipVariant,
    appearance: ChipAppearance,
    leadingIcon: AppIconName? = nil,
    prefix: String? = nil,
    detail: String? = nil,
    swatch: Color? = nil
  ) {
    self.label = label
    self.variant = variant
    self.appearance = appearance
    self.leadingIcon = leadingIcon
    self.prefix = prefix
    self.detail = detail
    self.swatch = swatch
  }

  /// Whether a swatch needs its edge on `fill`: its WCAG contrast with the fill is below `minContrast`
  /// (`swatchEdgeMinContrast`; DESIGN.md "Colour swatch chip": "swatches near the ground").
  package static func showsSwatchEdge(_ swatch: Color.Resolved, on fill: Color.Resolved, minContrast: Double) -> Bool {
    AppColorContrast.ratio(swatch, fill) < minContrast
  }

  package var body: some View {
    HStack(spacing: 0) {
      if let name = glyph(appearance.leadingIcon) {
        AppIcon(name, size: appearance.iconSize, tint: appearance.iconColor ?? appearance.textColor)
          .padding(.trailing, appearance.iconGap)
      }
      ForEach(parts(at: .beforeLabel), id: \.self) { part($0) }
      AppComponentText(text: label, style: appearance.typography, color: appearance.textColor)
      ForEach(parts(at: .afterLabel), id: \.self) { part($0) }
      if let name = glyph(appearance.trailingIcon), let size = appearance.trailingIconSize {
        AppIcon(name, size: size, tint: appearance.trailingIconColor ?? appearance.textColor)
          .padding(.leading, appearance.trailingIconGap ?? 0)
      }
    }
    .padding(
      EdgeInsets(
        top: appearance.paddingTop,
        leading: appearance.paddingStart,
        bottom: appearance.paddingBottom,
        trailing: appearance.paddingEnd
      )
    )
    .frame(minHeight: appearance.height)
    .appShape(
      cornerRadius: appearance.rounded,
      fill: appearance.backgroundColor,
      overlay: appearance.overlayColor,
      border: appearance.borderColor,
      borderWidth: appearance.borderWidth
    )
    .overlay {
      if let ring = appearance.focusRing {
        AppFocusRing(ring: ring, cornerRadius: appearance.rounded)
      }
    }
  }

  /// The glyph an icon source draws: its own glyph, or the caller's `leadingIcon` for `.prop` (nil leaves the
  /// icon out); a nil source draws no icon.
  private func glyph(_ source: ChipIconSource?) -> AppIconName? {
    switch source {
    case .glyph(let name): name
    case .prop: leadingIcon
    case nil: nil
    }
  }

  /// The variant's parts at `position`, in contract order.
  private func parts(at position: ChipPartPosition) -> [ChipPart] {
    variant.parts.filter { $0.position == position }
  }

  /// One part with its gap on the label's side, or nothing when its prop is nil.
  @ViewBuilder private func part(_ part: ChipPart) -> some View {
    switch part {
    case .prefix:
      if let prefix {
        AppComponentText(
          text: prefix,
          style: appearance.prefixTypography ?? appearance.typography,
          color: appearance.prefixColor ?? appearance.textColor
        )
        .padding(.trailing, appearance.prefixGap ?? 0)
      }
    case .swatch:
      if let swatch, let size = appearance.swatchSize {
        swatchCircle(swatch, size: size)
          .padding(.trailing, appearance.swatchGap ?? 0)
      }
    case .detail:
      if let detail {
        // One run: the separator copy, then the detail.
        AppComponentText(
          text: (AppChipRules.separator(for: .detail) ?? "") + detail,
          style: appearance.detailTypography ?? appearance.typography,
          color: appearance.detailColor ?? appearance.textColor
        )
        .padding(.leading, appearance.detailGap ?? 0)
      }
    }
  }

  /// The swatch: a circle of `size` in the runtime colour, its edge inside when it sits near the fill, and its
  /// ring `swatchRingGap` outside it when the look sets one. Decorative: the chip's name carries the colour.
  private func swatchCircle(_ colour: Color, size: Double) -> some View {
    Circle()
      .fill(colour)
      .frame(width: size, height: size)
      .overlay {
        if let edge = appearance.swatchEdgeColor, let width = appearance.swatchEdgeWidth, showsEdge(colour) {
          Circle().strokeBorder(theme.color(edge), lineWidth: width)
        }
      }
      .overlay {
        if let ring = appearance.swatchRingColor, let width = appearance.swatchRingWidth {
          let outset = (appearance.swatchRingGap ?? 0) + width
          Circle()
            .strokeBorder(theme.color(ring), lineWidth: width)
            .padding(-outset)
        }
      }
      .accessibilityHidden(true)
  }

  /// The edge rule against the look's resolved fill; no fill or no threshold draws no edge.
  private func showsEdge(_ colour: Color) -> Bool {
    guard let fill = appearance.backgroundColor, let minContrast = appearance.swatchEdgeMinContrast else {
      return false
    }
    return Self.showsSwatchEdge(
      colour.resolve(in: environment),
      on: theme.color(fill).resolve(in: environment),
      minContrast: minContrast
    )
  }
}
