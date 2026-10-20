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
      Text(section.title)
        .font(theme.font(theme.typography.title3))
        .foregroundStyle(theme.color(.text))
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
    }
  }
}
