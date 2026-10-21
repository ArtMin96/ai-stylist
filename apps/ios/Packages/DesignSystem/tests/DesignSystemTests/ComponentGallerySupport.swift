// Test helpers shared by the component tests (AppButtonTests, AppChipTests, C03GalleryTests): the five contexts
// of a generated spec, and the checks every generated gallery list must pass, so each component's tests read the
// generated API one way. Empty conformances: the generated types already have these members.
import DesignSystem
import DesignTokens
import Testing

/// A generated `<Component>Spec`: its five contexts and the look of one combination.
protocol ComponentSpec {
  associatedtype Variant: RawRepresentable<String>
  associatedtype Size: RawRepresentable<String>
  associatedtype State: RawRepresentable<String>
  associatedtype Appearance

  static var light: Self { get }
  static var dark: Self { get }
  static var brand: Self { get }
  static var hcLight: Self { get }
  static var hcDark: Self { get }

  func appearance(variant: Variant, size: Size, state: State) -> Appearance?
}

extension ComponentSpec {
  /// Every context: S1 light, S2 dark, S3 brand, and S7 high contrast light and dark.
  static var contexts: [Self] { [light, dark, brand, hcLight, hcDark] }
}

/// A generated `<Component>GalleryEntry` and the spec that draws it.
protocol ComponentGalleryEntry {
  associatedtype Spec: ComponentSpec

  var variant: Spec.Variant { get }
  var size: Spec.Size { get }
  var state: Spec.State { get }
  var testId: String { get }
  var label: String { get }
}

extension ButtonSpec: ComponentSpec {}
extension ChipSpec: ComponentSpec {}
extension TagSpec: ComponentSpec {}
extension BadgeSpec: ComponentSpec {}
extension ReasonRowSpec: ComponentSpec {}

extension ButtonGalleryEntry: ComponentGalleryEntry { typealias Spec = ButtonSpec }
extension ChipGalleryEntry: ComponentGalleryEntry { typealias Spec = ChipSpec }
extension TagGalleryEntry: ComponentGalleryEntry { typealias Spec = TagSpec }
extension BadgeGalleryEntry: ComponentGalleryEntry { typealias Spec = BadgeSpec }
extension ReasonRowGalleryEntry: ComponentGalleryEntry { typealias Spec = ReasonRowSpec }

/// Checks one component's generated gallery: `count` cells, unique test IDs that spell
/// `ds-<component>-<variant>-<size>-<state>`, a sample label on every cell, and a look for every cell in all five
/// contexts, so no gallery cell or forced state is skipped.
func expectGallery<Entry: ComponentGalleryEntry>(_ entries: [Entry], of component: GalleryComponent, count: Int) {
  #expect(entries.count == count, "\(component)")
  #expect(Set(entries.map(\.testId)).count == entries.count, "\(component)")
  for entry in entries {
    let parts = [component.rawValue, entry.variant.rawValue, entry.size.rawValue, entry.state.rawValue]
    #expect(entry.testId == "ds-" + parts.joined(separator: "-"))
    #expect(!entry.label.isEmpty, "\(entry.testId)")
    let looks = Entry.Spec.contexts.map { $0.appearance(variant: entry.variant, size: entry.size, state: entry.state) }
    #expect(looks.allSatisfy { $0 != nil }, "\(entry.testId)")
  }
}
