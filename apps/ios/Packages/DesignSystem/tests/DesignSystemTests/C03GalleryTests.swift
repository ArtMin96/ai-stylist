// The C03 galleries without rendering (chip.yaml, tag.yaml, badge.yaml, reason-row.yaml): the brief's cell
// counts, unique test IDs that spell ds-<component>-<variant>-<size>-<state>, a look for every cell in all five
// contexts (`expectGallery`), and the sample label each gallery cell draws (`entry.label`).
import DesignSystem
import DesignTokens
import Testing

@Test("each C03 gallery has the brief's count, unique ids spelling ds-<component>-<variant>-<size>-<state>, all looks")
func c03GalleryCells() {
  expectGallery(ComponentGallery.chip, of: .chip, count: 84)
  expectGallery(ComponentGallery.tag, of: .tag, count: 12)
  expectGallery(ComponentGallery.badge, of: .badge, count: 4)
  expectGallery(ComponentGallery.reasonRow, of: .reasonRow, count: 1)
}

@Test("a cell's sample label is its entry's: the trial pills have their own words, the rest the shared sample")
func gallerySampleLabels() {
  #expect(ComponentGallery.chip.allSatisfy { $0.label == ComponentGallery.chipLabel })
  #expect(ComponentGallery.tag.allSatisfy { $0.label == ComponentGallery.tagLabel })
  #expect(ComponentGallery.reasonRow.allSatisfy { $0.label == ComponentGallery.reasonRowLabel })
  let badgeLabels = Dictionary(uniqueKeysWithValues: ComponentGallery.badge.map { ($0.variant, $0.label) })
  #expect(badgeLabels[.dot] == ComponentGallery.badgeLabel)
  #expect(badgeLabels[.count] == ComponentGallery.badgeLabel)
  // The component-wide sample is the count "2"; a trial pill drawn from it would read "2" (F5).
  for trial in [BadgeVariant.trial, .trialLastDay] {
    #expect(badgeLabels[trial] != ComponentGallery.badgeLabel, "\(trial)")
  }
  #expect(badgeLabels[.trial] != badgeLabels[.trialLastDay])
}
