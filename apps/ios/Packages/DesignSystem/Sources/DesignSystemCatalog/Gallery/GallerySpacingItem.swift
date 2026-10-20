// A gallery item of the Spacing section (AI-195).
import DesignSystem
import DesignTokens
import SwiftUI

/// A bar as wide as the step, then the step's DESIGN.md name.
struct GallerySpacingItem: View {
  let step: AppScaleStep

  @Environment(\.appTheme) private var theme

  var body: some View {
    HStack(spacing: theme.spacing.space12) {
      Rectangle()
        .fill(theme.color(.primary))
        .frame(width: step.value, height: theme.spacing.space8)
        .accessibilityHidden(true)
      Text(step.name)
        .font(theme.font(theme.typography.footnote))
        .foregroundStyle(theme.color(.text))
    }
  }
}
