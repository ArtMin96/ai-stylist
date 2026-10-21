// Xcode previews of AppReasonRow: the gallery's C03 Reason row section (the ComponentGallery.reasonRow cell,
// tagged with its test ID), light then dark, and a playground with live text controls. Synthetic samples
// only. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

#Preview("AppReasonRow states, light") {
  GallerySectionPreview(component: .reasonRow)
    .appTheme()
    .environment(\.colorScheme, .light)
}

#Preview("AppReasonRow states, dark") {
  GallerySectionPreview(component: .reasonRow)
    .appTheme()
    .environment(\.colorScheme, .dark)
}

#Preview("AppReasonRow playground") {
  @Previewable @State var label = ComponentGallery.reasonRowLabel
  @Previewable @State var fact = ComponentGallery.reasonRowFact
  @Previewable @State var freshness = ComponentGallery.reasonRowFreshness

  Form {
    Section {
      AppReasonRow(
        label,
        fact: fact,
        factIcon: ComponentGallery.reasonRowFactIcon,
        freshness: freshness,
        accessibilityLabel: ComponentGallery.reasonRowAccessibilityLabel
      )
    }
    Section {
      TextField("Label", text: $label, axis: .vertical)
      TextField("Fact", text: $fact)
      TextField("Freshness", text: $freshness)
    }
  }
  .appTheme()
}
