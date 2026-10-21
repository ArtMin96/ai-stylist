// A gallery cell of the C03 Chips section: one AppChip look in its forced state. A live chip cannot be held
// pressed or focused, so the cell draws the look with `AppChipFace`, filled with the generated samples.
import DesignSystem
import DesignTokens
import SwiftUI

/// The forced `AppChip` look of `entry`, tagged with its test ID, then the test ID as text. Display-only: it
/// has no action. The face draws each sample only where the look asks for it: the leading icon where its
/// source is the prop, the prefix, swatch and detail where the variant lists that part.
struct GalleryChipCell: View {
  let entry: ChipGalleryEntry

  @Environment(\.appTheme) private var theme

  var body: some View {
    GalleryCaptionedCell(caption: entry.testId) {
      // Every generated gallery entry resolves a look in every context (C03GalleryTests).
      if let appearance = theme.chips.appearance(variant: entry.variant, size: entry.size, state: entry.state) {
        AppChipFace(
          label: ComponentGallery.chipLabel,
          variant: entry.variant,
          appearance: appearance,
          leadingIcon: ComponentGallery.chipLeadingIcon,
          prefix: ComponentGallery.chipPrefix,
          detail: ComponentGallery.chipDetail,
          swatch: theme.color(ComponentGallery.chipSwatch)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(entry.testId)
      }
    }
  }
}
