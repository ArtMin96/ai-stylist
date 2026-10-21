// AppBadge: the count badge and the trial pill of canvas board C03 (contract
// .impeccable/components/badge.yaml, DESIGN.md "Chips and tags (C03)"). A badge flags and never acts (R4):
// no tap, no touch target. Every look comes from the current theme's BadgeSpec; the caller attaches the test
// ID with `.accessibilityIdentifier(_:)`.
public import DesignTokens
public import SwiftUI

/// A dot, a count or a trial pill drawn from the C03 badge tokens of the current `\.appTheme`.
///
/// A `variant` and `size` pair the contract does not allow renders nothing, and so does a look that draws a
/// label (count, trial, trial-last-day) with a nil `label`. The dot and the count are hidden from VoiceOver
/// (the host names them); the trial pills read as static text.
public struct AppBadge: View {
  private let variant: BadgeVariant
  private let size: BadgeSize
  private let label: String?
  private let hostSurface: AppColorRole?

  @Environment(\.appTheme) private var theme

  /// - Parameters:
  ///   - label: the count ("2") or the trial words; required where the look draws a label.
  ///   - hostSurface: the colour role of the surface the badge sits on (dot, count); its ring outside the
  ///     badge takes that colour. Nil draws no ring.
  public init(variant: BadgeVariant, size: BadgeSize, label: String? = nil, hostSurface: AppColorRole? = nil) {
    self.variant = variant
    self.size = size
    self.label = label
    self.hostSurface = hostSurface
  }

  public var body: some View {
    if let appearance = theme.badges.appearance(variant: variant, size: size, state: .enabled) {
      switch variant.role {
      case .decorative:
        badge(appearance)
          .accessibilityHidden(true)
      case .text:
        badge(appearance)
          .accessibilityElement(children: .combine)
          .accessibilityAddTraits(.isStaticText)
      }
    }
  }

  /// The dot (a look with a `size`), else the label pill; nothing when the pill has no label.
  @ViewBuilder private func badge(_ appearance: BadgeAppearance) -> some View {
    if let dotSize = appearance.size {
      Color.clear
        .frame(width: dotSize, height: dotSize)
        .appShape(
          cornerRadius: appearance.rounded,
          fill: appearance.backgroundColor,
          border: appearance.borderColor,
          borderWidth: appearance.borderWidth
        )
        .overlay { outerRing(appearance) }
    } else if let label, let typography = appearance.typography, let textColor = appearance.textColor {
      HStack(spacing: 0) {
        // A badge has no icon prop, so only a glyph source draws an icon (the trial clock).
        if case .glyph(let name)? = appearance.leadingIcon, let iconSize = appearance.iconSize {
          AppIcon(name, size: iconSize, tint: textColor)
            .padding(.trailing, appearance.iconGap ?? 0)
        }
        // A trial pill's words wrap centred at the largest text sizes.
        AppComponentText(text: label, style: typography, color: textColor, alignment: .center)
      }
      .padding(
        EdgeInsets(
          top: appearance.paddingTop ?? 0,
          leading: appearance.paddingStart ?? 0,
          bottom: appearance.paddingBottom ?? 0,
          trailing: appearance.paddingEnd ?? 0
        )
      )
      // minWidth keeps a one-digit count round; both are minimums, so the badge grows with the text.
      .frame(minWidth: appearance.minWidth.map { CGFloat($0) }, minHeight: appearance.height.map { CGFloat($0) })
      .appShape(
        cornerRadius: appearance.rounded,
        fill: appearance.backgroundColor,
        border: appearance.borderColor,
        borderWidth: appearance.borderWidth
      )
      .overlay { outerRing(appearance) }
    }
  }

  /// The `outerRing` part (dot, count): a ring of `outerRingWidth` outside the shape in the host surface's
  /// colour, so the badge stands off the icon below it; none without a `hostSurface`.
  @ViewBuilder private func outerRing(_ appearance: BadgeAppearance) -> some View {
    if variant.parts.contains(.outerRing), let width = appearance.outerRingWidth, let hostSurface {
      AppOutsideRing(
        shape: RoundedRectangle(cornerRadius: appearance.rounded),
        color: hostSurface,
        width: width,
        gap: 0
      )
    }
  }
}
