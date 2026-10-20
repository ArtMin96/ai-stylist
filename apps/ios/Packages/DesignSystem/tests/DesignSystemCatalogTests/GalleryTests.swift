// The design-system gallery's data without rendering (AI-195): section ids, titles and order equal
// the cross-platform parity table, and every item comes from the generated tokens, in order.
import DesignSystem
import DesignSystemCatalog
import DesignTokens
import Testing

/// The parity table of the AI-195 brief: (id, title), in display order. Android asserts the same.
private let paritySections: [(id: String, title: String)] = [
  ("ds-gallery-section-colours", "Colours"),
  ("ds-gallery-section-typography", "Typography"),
  ("ds-gallery-section-spacing", "Spacing"),
  ("ds-gallery-section-radius", "Radius"),
  ("ds-gallery-section-c01-buttons", "C01 Buttons"),
  ("ds-gallery-section-c02-icons", "C02 Icons"),
]

private func section(_ id: String) throws -> GallerySection {
  try #require(GallerySection.all.first { $0.id == id })
}

@Test("section ids, titles and order equal the parity table")
func sectionsMatchParity() {
  #expect(GallerySection.all.map(\.id) == paritySections.map(\.id))
  #expect(GallerySection.all.map(\.title) == paritySections.map(\.title))
}

@Test("every section id is the prefix plus its slug; component sections use the generated slug")
func sectionIds() {
  let tokenSlugs = ["colours", "typography", "spacing", "radius"]
  let slugs = tokenSlugs + GalleryComponent.allCases.map(\.slug)
  #expect(GallerySection.all.map(\.id) == slugs.map { "ds-gallery-section-" + $0 })
  let componentTitles = GalleryComponent.allCases.map { GallerySection(component: $0).title }
  #expect(componentTitles == GalleryComponent.allCases.map(\.title))
}

@Test("the token sections list every generated colour role, text style, spacing step and radius, in order")
func tokenItems() throws {
  #expect(try section("ds-gallery-section-colours").kind.itemLabels == AppColorRole.allCases.map(\.rawValue))
  #expect(try section("ds-gallery-section-typography").kind.itemLabels == AppTypography.all.map(\.name))
  #expect(try section("ds-gallery-section-spacing").kind.itemLabels == AppSpacing.all.map(\.name))
  #expect(try section("ds-gallery-section-radius").kind.itemLabels == AppRadius.all.map(\.name))
}

@Test("the C01 section's cells are the generated button gallery, in order, with unique test ids")
func buttonCells() throws {
  let ids = try section("ds-gallery-section-c01-buttons").kind.itemLabels
  #expect(ids == ComponentGallery.button.map(\.testId))
  #expect(Set(ids).count == ids.count)
  #expect(!ids.isEmpty)
}

@Test("the C02 section's cells are every generated glyph, in order, with unique test ids")
func iconCells() throws {
  let ids = try section("ds-gallery-section-c02-icons").kind.itemLabels
  #expect(ids == AppIconName.allCases.map(\.testId))
  #expect(Set(ids).count == ids.count)
  #expect(!ids.isEmpty)
}

@Test("every C01 cell resolves a look in every context, so no forced state is skipped")
func everyCellDraws() {
  for spec in [ButtonSpec.light, .dark, .hcLight, .hcDark] {
    for entry in ComponentGallery.button {
      #expect(spec.appearance(variant: entry.variant, size: entry.size, state: entry.state) != nil, "\(entry.testId)")
    }
  }
}
