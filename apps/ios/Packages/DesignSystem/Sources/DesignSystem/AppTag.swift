// AppTag: the tags of canvas board C03 (contract .impeccable/components/tag.yaml, DESIGN.md "Chips and tags
// (C03)"). A tag labels and never acts (R4): no tap, no pressed state, no touch target. Every look comes
// from the current theme's TagSpec; the caller attaches the test ID with `.accessibilityIdentifier(_:)`.
public import DesignTokens
public import SwiftUI

/// A static label drawn from the C03 tag tokens of the current `\.appTheme`.
///
/// A `variant` and `size` pair the contract does not allow renders nothing. It is read as static text named
/// `accessibilityLabel ?? label`; its icon and dot are hidden.
public struct AppTag: View {
  private let label: String
  private let variant: TagVariant
  private let size: TagSize
  private let leadingIcon: AppIconName?
  private let accessibilityLabel: String?

  @Environment(\.appTheme) private var theme

  /// - Parameters:
  ///   - label: the visible text; it wraps, never truncates, and is the spoken name unless
  ///     `accessibilityLabel` is set.
  ///   - leadingIcon: the caller's availability glyph, drawn where the look's icon comes from the prop
  ///     (unavailable).
  ///   - accessibilityLabel: the spoken name when it differs from the label ("Needs Plus").
  public init(
    _ label: String,
    variant: TagVariant,
    size: TagSize,
    leadingIcon: AppIconName? = nil,
    accessibilityLabel: String? = nil
  ) {
    self.label = label
    self.variant = variant
    self.size = size
    self.leadingIcon = leadingIcon
    self.accessibilityLabel = accessibilityLabel
  }

  public var body: some View {
    if let appearance = theme.tags.appearance(variant: variant, size: size, state: .enabled) {
      HStack(spacing: 0) {
        if let name = glyph(appearance.leadingIcon), let iconSize = appearance.iconSize {
          AppIcon(name, size: iconSize, tint: appearance.textColor)
            .padding(.trailing, appearance.iconGap ?? 0)
        }
        ForEach(variant.parts, id: \.self) { part($0, in: appearance) }
        AppComponentText(text: label, style: appearance.typography, color: appearance.textColor)
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
        border: appearance.borderColor,
        borderWidth: appearance.borderWidth,
        borderDash: appearance.borderDash
      )
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(accessibilityLabel ?? label)
      .accessibilityAddTraits(roleTraits)
    }
  }

  /// The traits of `variant.role`; every tag reads as static text.
  private var roleTraits: AccessibilityTraits {
    switch variant.role {
    case .text: .isStaticText
    }
  }

  /// The glyph an icon source draws: its own glyph, or the caller's `leadingIcon` for `.prop`; a nil source
  /// draws no icon.
  private func glyph(_ source: TagIconSource?) -> AppIconName? {
    switch source {
    case .glyph(let name): name
    case .prop: leadingIcon
    case nil: nil
    }
  }

  /// One part before the label: the new tag's dot, in the label colour, `dotGap` before the label.
  @ViewBuilder private func part(_ part: TagPart, in appearance: TagAppearance) -> some View {
    switch part {
    case .dot:
      if let dotSize = appearance.dotSize {
        Circle()
          .fill(theme.color(appearance.textColor))
          .frame(width: dotSize, height: dotSize)
          .padding(.trailing, appearance.dotGap ?? 0)
      }
    }
  }
}
