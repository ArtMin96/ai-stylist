// A gallery cell of the C03 Reason row section: the AppReasonRow with the generated samples. It has one
// state, so the cell draws the live component.
import DesignSystem
import DesignTokens
import SwiftUI

/// The `AppReasonRow` of `entry` with its sample label, tagged with its test ID, then the test ID as text.
struct GalleryReasonRowCell: View {
  let entry: ReasonRowGalleryEntry

  var body: some View {
    GalleryCaptionedCell(caption: entry.testId) {
      AppReasonRow(
        entry.label,
        fact: ComponentGallery.reasonRowFact,
        factIcon: ComponentGallery.reasonRowFactIcon,
        freshness: ComponentGallery.reasonRowFreshness,
        accessibilityLabel: ComponentGallery.reasonRowAccessibilityLabel
      )
      .accessibilityIdentifier(entry.testId)
    }
  }
}
