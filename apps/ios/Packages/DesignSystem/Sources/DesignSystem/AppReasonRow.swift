// AppReasonRow: the expanded reason row of canvas board C03 (contract .impeccable/components/reason-row.yaml,
// DESIGN.md "Chips and tags (C03)"). It shows under the chips while its reason chip is expanded. No tap, no
// touch target. Every look comes from the current theme's ReasonRowSpec; the caller attaches the test ID with
// `.accessibilityIdentifier(_:)`.
public import DesignTokens
public import SwiftUI

/// The reason sentence, its fact and its freshness, drawn from the C03 reason-row tokens of the current
/// `\.appTheme`.
///
/// Three lines, `lineGap` apart: the label, the fact behind an icon disc, the freshness. It is a region named
/// `accessibilityLabel` whose lines VoiceOver reads in order; the icon is hidden. It fills the width it is
/// offered, as the row under the chips does.
public struct AppReasonRow: View {
  private let label: String
  private let fact: String
  private let factIcon: AppIconName
  private let freshness: String
  private let accessibilityLabel: String

  @Environment(\.appTheme) private var theme

  /// - Parameters:
  ///   - label: the reason sentence from the reason-code templates.
  ///   - fact: the fact behind it.
  ///   - factIcon: the fact's C02 glyph, the same as its reason chip's.
  ///   - freshness: the source and its time.
  ///   - accessibilityLabel: the region's name ("Why: " and the reason chip's label).
  public init(
    _ label: String,
    fact: String,
    factIcon: AppIconName,
    freshness: String,
    accessibilityLabel: String
  ) {
    self.label = label
    self.fact = fact
    self.factIcon = factIcon
    self.freshness = freshness
    self.accessibilityLabel = accessibilityLabel
  }

  public var body: some View {
    if let appearance = theme.reasonRows.appearance(variant: .standard, size: .standard, state: .enabled) {
      ReasonRowLines(
        label: label,
        fact: fact,
        factIcon: factIcon,
        freshness: freshness,
        appearance: appearance
      )
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(
        EdgeInsets(
          top: appearance.paddingTop,
          leading: appearance.paddingStart,
          bottom: appearance.paddingBottom,
          trailing: appearance.paddingEnd
        )
      )
      .appShape(
        cornerRadius: appearance.rounded,
        fill: appearance.backgroundColor,
        border: appearance.borderColor,
        borderWidth: appearance.borderWidth
      )
      .accessibilityElement(children: .contain)
      .accessibilityLabel(accessibilityLabel)
    }
  }
}

/// The row's lines in a resolved look, so the icon disc can scale with Dynamic Type from the look's size.
private struct ReasonRowLines: View {
  let label: String
  let fact: String
  let factIcon: AppIconName
  let freshness: String
  let appearance: ReasonRowAppearance

  /// The disc's side: the token size scaled with Dynamic Type exactly as `AppIcon` scales its icon
  /// (`AppIcon.scalingStyle(for:)`), so the disc and its icon grow together with the text.
  @ScaledMetric private var discSize: Double

  @Environment(\.appTheme) private var theme

  init(label: String, fact: String, factIcon: AppIconName, freshness: String, appearance: ReasonRowAppearance) {
    self.label = label
    self.fact = fact
    self.factIcon = factIcon
    self.freshness = freshness
    self.appearance = appearance
    _discSize = ScaledMetric(
      wrappedValue: appearance.iconDiscSize,
      relativeTo: AppIcon.scalingStyle(for: appearance.iconSize)
    )
  }

  var body: some View {
    VStack(alignment: .leading, spacing: appearance.lineGap) {
      AppComponentText(text: label, style: appearance.typography, color: appearance.textColor)
      ForEach(ReasonRowVariant.standard.parts, id: \.self) { line($0) }
    }
  }

  /// One `line` part: its text in its own style, opened by the icon disc when the part takes the leading icon.
  private func line(_ part: ReasonRowPart) -> some View {
    HStack(spacing: appearance.iconGap) {
      if part.takesLeadingIcon {
        disc
      }
      switch part {
      case .fact:
        AppComponentText(text: fact, style: appearance.factTypography, color: appearance.factColor)
      case .freshness:
        AppComponentText(text: freshness, style: appearance.freshnessTypography, color: appearance.freshnessColor)
      }
    }
  }

  /// The leading icon in its disc; the icon is decorative.
  private var disc: some View {
    Circle()
      .fill(theme.color(appearance.iconDiscColor))
      .frame(width: discSize, height: discSize)
      .overlay {
        AppIcon(glyph, size: appearance.iconSize, tint: appearance.iconColor)
      }
      .accessibilityHidden(true)
  }

  /// The glyph the look's leading icon source draws: its own glyph, or the caller's `factIcon` for `.prop`.
  private var glyph: AppIconName {
    switch appearance.leadingIcon {
    case .glyph(let name): name
    case .prop: factIcon
    }
  }
}
