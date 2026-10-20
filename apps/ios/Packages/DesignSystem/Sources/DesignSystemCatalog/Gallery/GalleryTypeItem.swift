// A gallery item of the Typography section (AI-195).
import DesignSystem
import DesignTokens
import SwiftUI

/// The style's DESIGN.md name, set in that style.
struct GalleryTypeItem: View {
  let style: AppTextStyle

  @Environment(\.appTheme) private var theme

  var body: some View {
    Text(style.name)
      .font(theme.font(style))
      .tracking(style.letterSpacing)
      .foregroundStyle(theme.color(.text))
  }
}
