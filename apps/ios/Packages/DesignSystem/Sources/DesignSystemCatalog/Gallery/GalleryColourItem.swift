// A gallery item of the Colours section (AI-195).
import DesignSystem
import DesignTokens
import SwiftUI

/// A square swatch filled with `role` in the current context, then the role's DESIGN.md id.
struct GalleryColourItem: View {
  let role: AppColorRole

  @Environment(\.appTheme) private var theme

  var body: some View {
    HStack(spacing: theme.spacing.space12) {
      let swatch = RoundedRectangle(cornerRadius: theme.radius.radius8)
      swatch
        .fill(theme.color(role))
        .overlay { swatch.strokeBorder(theme.color(.divider)) }
        .frame(width: theme.spacing.space40, height: theme.spacing.space40)
        .accessibilityHidden(true)
      AppComponentText(text: role.rawValue, style: theme.typography.footnote, color: .text)
    }
  }
}
