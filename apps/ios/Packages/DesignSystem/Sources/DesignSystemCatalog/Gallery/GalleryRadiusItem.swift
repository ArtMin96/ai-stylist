// A gallery item of the Radius section (AI-195).
import DesignSystem
import DesignTokens
import SwiftUI

/// A square with the step's corner radius, then the step's DESIGN.md name.
struct GalleryRadiusItem: View {
  let step: AppScaleStep

  @Environment(\.appTheme) private var theme

  var body: some View {
    HStack(spacing: theme.spacing.space12) {
      let side = theme.spacing.space48
      // `rounded-full` is far larger than the square, so it clamps to half the side: a circle.
      let shape = RoundedRectangle(cornerRadius: min(step.value, side / 2))
      shape
        .fill(theme.color(.surface2))
        .overlay { shape.strokeBorder(theme.color(.outline)) }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
      AppComponentText(text: step.name, style: theme.typography.footnote, color: .text)
    }
  }
}
