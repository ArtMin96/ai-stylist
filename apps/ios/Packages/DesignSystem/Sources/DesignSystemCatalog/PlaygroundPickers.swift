// The variant and size rows of the component playgrounds: one copy for the AppButton, AppChip, AppTag and
// AppBadge previews.
import SwiftUI

/// The playground's "Variant" picker over every generated variant and its "Size" picker over the sizes the
/// variant takes. Picking a variant that does not take the current size moves to its first allowed size.
struct PlaygroundPickers<Variant, Size>: View
where
  Variant: CaseIterable & Hashable & RawRepresentable<String>,
  Variant.AllCases: RandomAccessCollection,
  Size: Hashable & RawRepresentable<String>
{
  @Binding var variant: Variant
  @Binding var size: Size
  /// The sizes the current variant takes, in generated order; the same in every context, so the light spec
  /// answers for all of them.
  let sizes: [Size]

  var body: some View {
    Picker("Variant", selection: $variant) {
      ForEach(Variant.allCases, id: \.self) { Text($0.rawValue) }
    }
    Picker("Size", selection: $size) {
      ForEach(sizes, id: \.self) { Text($0.rawValue) }
    }
    .onChange(of: variant) {
      if !sizes.contains(size), let first = sizes.first {
        size = first
      }
    }
  }
}
