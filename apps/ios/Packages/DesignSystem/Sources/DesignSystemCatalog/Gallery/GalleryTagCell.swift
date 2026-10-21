// A gallery cell of the C03 Tags section: one AppTag with the generated samples. A tag has one state, so the
// cell draws the live component.
import DesignSystem
import DesignTokens
import SwiftUI

/// The `AppTag` of `entry` with its sample label, tagged with its test ID, then the test ID as text.
struct GalleryTagCell: View {
  let entry: TagGalleryEntry

  var body: some View {
    GalleryCaptionedCell(caption: entry.testId) {
      AppTag(
        entry.label,
        variant: entry.variant,
        size: entry.size,
        leadingIcon: ComponentGallery.tagLeadingIcon
      )
      .accessibilityIdentifier(entry.testId)
    }
  }
}
