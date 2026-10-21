// Xcode previews of AppTag: the gallery's C03 Tags section (every ComponentGallery.tag cell, in generated
// order, tagged with its test ID), light then dark, and a playground with live controls. Synthetic samples
// only. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

#Preview("AppTag states, light") {
  GallerySectionPreview(component: .tag)
    .previewFrame(.light)
}

#Preview("AppTag states, dark") {
  GallerySectionPreview(component: .tag)
    .previewFrame(.dark)
}

#Preview("AppTag playground") {
  @Previewable @State var variant = TagVariant.planPlus
  @Previewable @State var size = TagSize.regular
  @Previewable @State var label = ComponentGallery.tagLabel

  Form {
    Section {
      AppTag(label, variant: variant, size: size, leadingIcon: ComponentGallery.tagLeadingIcon)
    }
    Section {
      PlaygroundPickers(
        variant: $variant,
        size: $size,
        sizes: TagSize.allCases.filter {
          AppTheme.light.tags.appearance(variant: variant, size: $0, state: .enabled) != nil
        }
      )
      TextField("Label", text: $label)
    }
  }
  .appTheme()
}
