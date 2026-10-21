// A gallery cell of the C03 Badges section: one AppBadge with the generated samples, on the host surface the
// section draws. A badge has one state, so the cell draws the live component.
import DesignSystem
import DesignTokens
import SwiftUI

/// The `AppBadge` of `entry` with its sample label (the count, or the trial pill's own words), then the test ID
/// as text, as one accessibility element tagged with the test ID. The dot and the count are hidden from
/// VoiceOver (the host names them), so the cell carries the id and reads as its caption, as the icon cells do.
struct GalleryBadgeCell: View {
  let entry: BadgeGalleryEntry

  var body: some View {
    GalleryCaptionedCell(caption: entry.testId) {
      AppBadge(
        variant: entry.variant,
        size: entry.size,
        label: entry.label,
        hostSurface: ComponentGallery.badgeHostSurface
      )
    }
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier(entry.testId)
  }
}
