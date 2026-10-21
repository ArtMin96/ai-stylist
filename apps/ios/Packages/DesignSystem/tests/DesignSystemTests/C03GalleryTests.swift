// The C03 galleries without rendering (chip.yaml, tag.yaml, badge.yaml, reason-row.yaml): the brief's cell
// counts, unique test IDs that spell ds-<component>-<variant>-<size>-<state>, and a look for every cell in
// all five contexts, so no gallery cell or forced state is skipped.
import DesignSystem
import DesignTokens
import Testing

/// One gallery cell as these tests see it: its test ID, the ID its fields spell, and whether all five
/// contexts resolve its look.
private struct Cell {
  let testId: String
  let spelledId: String
  let resolvesEverywhere: Bool
}

/// `entries` as cells: `ids` gives an entry's test ID and its variant, size and state ids; `resolves` says
/// whether one context's spec has the entry's look.
private func cells<Entry, Spec>(
  _ component: GalleryComponent,
  _ entries: [Entry],
  in specs: [Spec],
  ids: (Entry) -> (testId: String, variant: String, size: String, state: String),
  resolves: (Spec, Entry) -> Bool
) -> [Cell] {
  entries.map { entry in
    let id = ids(entry)
    return Cell(
      testId: id.testId,
      spelledId: "ds-\(component.rawValue)-\(id.variant)-\(id.size)-\(id.state)",
      resolvesEverywhere: specs.allSatisfy { resolves($0, entry) }
    )
  }
}

/// The cells of a C03 component's gallery, in generated order, checked in all five contexts.
private func cells(of component: GalleryComponent) -> [Cell] {
  switch component {
  case .chip:
    cells(component, ComponentGallery.chip, in: [ChipSpec.light, .dark, .brand, .hcLight, .hcDark]) {
      ($0.testId, $0.variant.rawValue, $0.size.rawValue, $0.state.rawValue)
    } resolves: {
      $0.appearance(variant: $1.variant, size: $1.size, state: $1.state) != nil
    }
  case .tag:
    cells(component, ComponentGallery.tag, in: [TagSpec.light, .dark, .brand, .hcLight, .hcDark]) {
      ($0.testId, $0.variant.rawValue, $0.size.rawValue, $0.state.rawValue)
    } resolves: {
      $0.appearance(variant: $1.variant, size: $1.size, state: $1.state) != nil
    }
  case .badge:
    cells(component, ComponentGallery.badge, in: [BadgeSpec.light, .dark, .brand, .hcLight, .hcDark]) {
      ($0.testId, $0.variant.rawValue, $0.size.rawValue, $0.state.rawValue)
    } resolves: {
      $0.appearance(variant: $1.variant, size: $1.size, state: $1.state) != nil
    }
  case .reasonRow:
    cells(component, ComponentGallery.reasonRow, in: [ReasonRowSpec.light, .dark, .brand, .hcLight, .hcDark]) {
      ($0.testId, $0.variant.rawValue, $0.size.rawValue, $0.state.rawValue)
    } resolves: {
      $0.appearance(variant: $1.variant, size: $1.size, state: $1.state) != nil
    }
  case .button, .icon:
    []
  }
}

@Test(
  "each C03 gallery has the brief's count, unique ids spelling ds-<component>-<variant>-<size>-<state>, five-context looks",
  arguments: [(GalleryComponent.chip, 84), (.tag, 12), (.badge, 4), (.reasonRow, 1)]
)
func c03GalleryCells(component: GalleryComponent, count: Int) {
  let cells = cells(of: component)
  #expect(cells.count == count)
  #expect(Set(cells.map(\.testId)).count == cells.count)
  for cell in cells {
    #expect(cell.testId == cell.spelledId)
    #expect(cell.resolvesEverywhere, "\(cell.testId)")
  }
}
