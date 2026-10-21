// One gallery section: its header, then its items laid out by kind (AI-195).
import DesignSystem
import DesignTokens
import SwiftUI

/// A titled gallery section, tagged with its `ds-gallery-section-<slug>` id.
struct GallerySectionView: View {
  let section: GallerySection

  @Environment(\.appTheme) private var theme

  var body: some View {
    VStack(alignment: .leading, spacing: theme.spacing.space12) {
      AppComponentText(text: section.title, style: theme.typography.title3, color: .text)
        .accessibilityAddTraits(.isHeader)
      items
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier(section.id)
  }

  @ViewBuilder private var items: some View {
    switch section.kind {
    case .colours(let roles):
      ForEach(roles, id: \.self) { GalleryColourItem(role: $0) }
    case .typography(let styles):
      ForEach(styles, id: \.name) { GalleryTypeItem(style: $0) }
    case .spacing(let steps):
      ForEach(steps, id: \.name) { GallerySpacingItem(step: $0) }
    case .radius(let steps):
      ForEach(steps, id: \.name) { GalleryRadiusItem(step: $0) }
    case .buttons(let entries):
      ForEach(entries, id: \.testId) { GalleryButtonCell(entry: $0) }
    case .icons(let names):
      GalleryIconSection(names: names)
    case .badges(let entries):
      // The badges sit on their host surface, the colour their outer ring takes.
      GalleryFlowLayout(spacing: theme.spacing.space12) {
        ForEach(entries, id: \.testId) { GalleryBadgeCell(entry: $0) }
      }
      .padding(theme.spacing.space12)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(theme.color(ComponentGallery.badgeHostSurface), in: .rect(cornerRadius: theme.radius.radius12))
    case .chips(let entries):
      GalleryFlowLayout(spacing: theme.spacing.space12) {
        ForEach(entries, id: \.testId) { GalleryChipCell(entry: $0) }
      }
    case .reasonRows(let entries):
      ForEach(entries, id: \.testId) { GalleryReasonRowCell(entry: $0) }
    case .tags(let entries):
      GalleryFlowLayout(spacing: theme.spacing.space12) {
        ForEach(entries, id: \.testId) { GalleryTagCell(entry: $0) }
      }
    }
  }
}
