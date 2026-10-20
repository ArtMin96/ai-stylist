// A gallery cell of a component section: one AppButton look in its forced state (AI-195). A live
// button cannot be held pressed or focused, so the cell draws the look with `AppButtonFace`.
import DesignSystem
import DesignTokens
import SwiftUI

/// The forced `AppButton` look of `entry`, tagged with its test ID, then the test ID as text.
/// Display-only: it has no action.
struct GalleryButtonCell: View {
  let entry: ButtonGalleryEntry

  @Environment(\.appTheme) private var theme

  var body: some View {
    VStack(alignment: .leading, spacing: theme.spacing.space4) {
      // Every generated gallery entry resolves a look in every context (GalleryTests).
      if let appearance = theme.buttons.appearance(variant: entry.variant, size: entry.size, state: entry.state) {
        AppButtonFace(
          label: ComponentGallery.buttonLabel,
          appearance: appearance,
          loading: entry.state == .loading
        )
        .accessibilityIdentifier(entry.testId)
      }
      Text(entry.testId)
        .font(theme.font(theme.typography.caption))
        .foregroundStyle(theme.color(.textSecondary))
    }
  }
}
