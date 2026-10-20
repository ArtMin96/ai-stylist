// The gallery's section list as pure data (AI-195): the four token sections in a fixed order (they
// are token categories, not components), then one section per generated `GalleryComponent`, in board
// order. Titles and ids are the cross-platform parity contract (Android testTags).
package import DesignTokens

/// One section of the design-system gallery: its accessibility id, title and items.
nonisolated package struct GallerySection: Equatable, Sendable, Identifiable {
  /// Every section id is this prefix followed by the section slug.
  package static let idPrefix = "ds-gallery-section-"

  /// Every section, in display order.
  package static let all: [GallerySection] =
    [
      GallerySection(slug: "colours", title: "Colours", kind: .colours(AppColorRole.allCases)),
      GallerySection(slug: "typography", title: "Typography", kind: .typography(AppTypography.all)),
      GallerySection(slug: "spacing", title: "Spacing", kind: .spacing(AppSpacing.all)),
      GallerySection(slug: "radius", title: "Radius", kind: .radius(AppRadius.all)),
    ] + GalleryComponent.allCases.map(GallerySection.init(component:))

  /// `ds-gallery-section-<slug>`: the iOS accessibilityIdentifier and the Android testTag.
  package let id: String
  package let title: String
  package let kind: GallerySectionKind

  /// The section of one component contract. The switch is exhaustive, so a new generated component
  /// fails the build until it has a renderer here.
  package init(component: GalleryComponent) {
    let kind: GallerySectionKind =
      switch component {
      case .button: .buttons(ComponentGallery.button)
      case .icon: .icons(AppIconName.allCases)
      }
    self.init(slug: component.slug, title: component.title, kind: kind)
  }

  private init(slug: String, title: String, kind: GallerySectionKind) {
    id = Self.idPrefix + slug
    self.title = title
    self.kind = kind
  }
}
