// A gallery cell of a component section: one AppButton look in its forced state (AI-195). A live
// button cannot be held pressed or focused, so the cell draws the look with `AppButtonFace`.
import DesignSystem
import DesignTokens
import SwiftUI

/// The forced `AppButton` look of `entry` with its sample label, tagged with its test ID, then the test ID as
/// text. Display-only: it has no action.
struct GalleryButtonCell: View {
  let entry: ButtonGalleryEntry

  @Environment(\.appTheme) private var theme

  var body: some View {
    GalleryCaptionedCell(caption: entry.testId) {
      // Each button entry resolves a look in all five contexts (AppButtonTests, `expectGallery`).
      if let appearance = theme.buttons.appearance(variant: entry.variant, size: entry.size, state: entry.state) {
        AppButtonFace(label: entry.label, appearance: appearance, loading: entry.state == .loading)
          .accessibilityIdentifier(entry.testId)
      }
    }
  }
}
