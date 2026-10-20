// Xcode previews of AppIcon: the gallery's C02 section (the size and tint playground, then every glyph
// grouped by set and tagged with its test ID), light, dark, and at the largest Dynamic Type size. They live
// in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

/// The gallery's C02 section on the theme background, scrollable.
private struct IconSectionPreview: View {
  @Environment(\.appTheme) private var theme

  var body: some View {
    ScrollView {
      GallerySectionView(section: GallerySection(component: .icon))
        .padding(theme.spacing.space20)
    }
    .background(theme.color(.background))
  }
}

#Preview("AppIcon set, light") {
  IconSectionPreview()
    .appTheme()
    .environment(\.colorScheme, .light)
}

#Preview("AppIcon set, dark") {
  IconSectionPreview()
    .appTheme()
    .environment(\.colorScheme, .dark)
}

#Preview("AppIcon set, largest text") {
  IconSectionPreview()
    .appTheme()
    .environment(\.dynamicTypeSize, .accessibility5)
}
