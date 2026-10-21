// Xcode previews of AppIcon: the gallery's C02 section (the size and tint playground, then every glyph
// grouped by set and tagged with its test ID), light, dark, and at the largest Dynamic Type size. The
// largest-text preview first draws one glyph at every step, so the gentler growth of xl and hero shows
// beside the body-text steps. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

/// One glyph at each icon step, xs to hero, captioned with the step.
private struct IconStepsRow: View {
  @Environment(\.appTheme) private var theme

  var body: some View {
    GalleryFlowLayout(spacing: theme.spacing.space12) {
      ForEach(AppIconSize.allCases, id: \.self) { size in
        GalleryCaptionedCell(caption: size.rawValue, alignment: .center) {
          AppIcon(.today, size: size)
        }
      }
    }
  }
}

#Preview("AppIcon set, light") {
  GallerySectionPreview(component: .icon)
    .previewFrame(.light)
}

#Preview("AppIcon set, dark") {
  GallerySectionPreview(component: .icon)
    .previewFrame(.dark)
}

#Preview("AppIcon set, largest text") {
  GallerySectionPreview(component: .icon) { IconStepsRow() }
    .previewFrame(.light)
    .environment(\.dynamicTypeSize, .accessibility5)
}
