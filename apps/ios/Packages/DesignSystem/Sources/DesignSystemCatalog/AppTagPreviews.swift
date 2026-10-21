// Xcode previews of AppTag: the gallery's C03 Tags section (every ComponentGallery.tag cell, in generated
// order, tagged with its test ID), light then dark, and a playground with live controls. Synthetic samples
// only. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

#Preview("AppTag states, light") {
  GallerySectionPreview(component: .tag)
    .appTheme()
    .environment(\.colorScheme, .light)
}

#Preview("AppTag states, dark") {
  GallerySectionPreview(component: .tag)
    .appTheme()
    .environment(\.colorScheme, .dark)
}

#Preview("AppTag playground") {
  @Previewable @State var variant = TagVariant.planPlus
  @Previewable @State var size = TagSize.regular
  @Previewable @State var label = ComponentGallery.tagLabel

  // The allowed sizes are the same in every context, so the light spec answers for all of them.
  let sizes = TagSize.allCases.filter {
    AppTheme.light.tags.appearance(variant: variant, size: $0, state: .enabled) != nil
  }

  Form {
    Section {
      AppTag(label, variant: variant, size: size, leadingIcon: ComponentGallery.tagLeadingIcon)
    }
    Section {
      Picker("Variant", selection: $variant) {
        ForEach(TagVariant.allCases, id: \.self) { Text($0.rawValue) }
      }
      Picker("Size", selection: $size) {
        ForEach(sizes, id: \.self) { Text($0.rawValue) }
      }
      TextField("Label", text: $label)
    }
  }
  .onChange(of: variant) {
    if !sizes.contains(size), let first = sizes.first {
      size = first
    }
  }
  .appTheme()
}
