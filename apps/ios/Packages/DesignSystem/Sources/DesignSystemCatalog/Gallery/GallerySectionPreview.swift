// The state grid the component previews show: one component's gallery section on the theme background,
// scrollable. One copy for the C03 previews files.
import DesignSystem
import DesignTokens
import SwiftUI

/// The gallery section of `component` (every generated cell, in order, tagged with its test ID), scrollable.
struct GallerySectionPreview: View {
  let component: GalleryComponent

  @Environment(\.appTheme) private var theme

  var body: some View {
    ScrollView {
      GallerySectionView(section: GallerySection(component: component))
        .padding(theme.spacing.space20)
    }
    .background(theme.color(.background))
  }
}
