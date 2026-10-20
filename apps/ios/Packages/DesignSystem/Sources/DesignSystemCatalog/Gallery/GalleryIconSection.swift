// The gallery's C02 section (AI-201): a size and tint playground, then every glyph grouped by its
// generated set, each cell tagged with its test ID. There is no text-size control: the cells follow the
// system Dynamic Type setting, so changing it in Settings shows the scaling.
import DesignSystem
import DesignTokens
import SwiftUI

/// The playground controls, then one group per `AppIconSet` in generated order with that set's glyphs.
struct GalleryIconSection: View {
  /// The tints offered: the host foregrounds, then the status foregrounds (DESIGN.md "Icons (C02)" Tint).
  private static let tints: [AppColorRole] = [
    .text, .textSecondary, .primaryText, .successFg, .warningFg, .errorFg, .infoFg,
  ]

  let names: [AppIconName]

  @State private var size = AppIconMetrics.defaultSize
  @State private var tint = AppColorRole.text

  @Environment(\.appTheme) private var theme

  var body: some View {
    VStack(alignment: .leading, spacing: theme.spacing.space24) {
      VStack(alignment: .leading, spacing: theme.spacing.space8) {
        control("Size") {
          Picker("Size", selection: $size) {
            ForEach(AppIconSize.allCases, id: \.self) { Text($0.rawValue) }
          }
        }
        control("Tint") {
          Picker("Tint", selection: $tint) {
            ForEach(Self.tints, id: \.self) { Text($0.rawValue) }
          }
        }
      }
      ForEach(AppIconSet.allCases, id: \.self) { set in
        group(set)
      }
    }
  }

  /// A playground control with its visible label, in the headline style on both apps.
  private func control<Control: View>(_ label: String, @ViewBuilder picker: () -> Control) -> some View {
    let content = picker()
    return LabeledContent {
      content.labelsHidden()
    } label: {
      Text(label)
        .font(theme.font(theme.typography.headline))
        .foregroundStyle(theme.color(.text))
    }
  }

  /// The set's id as a header, then its glyphs in generated order, wrapping as they grow.
  private func group(_ set: AppIconSet) -> some View {
    VStack(alignment: .leading, spacing: theme.spacing.space12) {
      Text(set.rawValue)
        .font(theme.font(theme.typography.headline))
        .foregroundStyle(theme.color(.text))
        .accessibilityAddTraits(.isHeader)
      GalleryFlowLayout(spacing: theme.spacing.space12) {
        ForEach(names.filter { $0.set == set }, id: \.self) { name in
          GalleryIconCell(name: name, size: size, tint: tint)
        }
      }
    }
  }
}
