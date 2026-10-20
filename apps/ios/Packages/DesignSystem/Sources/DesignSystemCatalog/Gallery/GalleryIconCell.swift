// A gallery cell of the C02 section (AI-201): one glyph at the playground's size and tint.
import DesignSystem
import DesignTokens
import SwiftUI

/// `name` drawn by `AppIcon`, then its glyph id. One accessibility element tagged with the glyph's test
/// ID; the icon is hidden, so the cell reads as its id.
struct GalleryIconCell: View {
  let name: AppIconName
  let size: AppIconSize
  let tint: AppColorRole

  @Environment(\.appTheme) private var theme

  var body: some View {
    VStack(spacing: theme.spacing.space4) {
      AppIcon(name, size: size, tint: tint)
      Text(name.rawValue)
        .font(theme.font(theme.typography.caption))
        .foregroundStyle(theme.color(.textSecondary))
    }
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier(name.testId)
  }
}
