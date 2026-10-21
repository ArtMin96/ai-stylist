// The state grid the component previews show, and the light and dark frames they show it in: one component's
// gallery section on the theme background, scrollable. One copy for every component previews file.
import DesignSystem
import DesignTokens
import SwiftUI

/// The gallery section of `component` (every generated cell, in order, tagged with its test ID), scrollable, with
/// optional `leading` content above it.
struct GallerySectionPreview<Leading: View>: View {
  let component: GalleryComponent
  @ViewBuilder let leading: Leading

  @Environment(\.appTheme) private var theme

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: theme.spacing.space24) {
        leading
        GallerySectionView(section: GallerySection(component: component))
      }
      .padding(theme.spacing.space20)
    }
    .background(theme.color(.background))
  }
}

extension GallerySectionPreview where Leading == EmptyView {
  /// The section alone.
  init(component: GalleryComponent) {
    self.init(component: component) { EmptyView() }
  }
}

extension View {
  /// A preview's frame: the view under `.appTheme()` in the light or dark scheme.
  func previewFrame(_ scheme: ColorScheme) -> some View {
    appTheme()
      .environment(\.colorScheme, scheme)
  }
}
