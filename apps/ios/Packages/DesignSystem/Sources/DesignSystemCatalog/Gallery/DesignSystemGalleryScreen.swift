// The debug-only "Design system gallery" (AI-195): every colour role, text style, spacing step and
// radius, then every generated component cell in its forced state. The app opens it from Home's debug
// section in the Dev build only (App/AIStylistApp.swift). Strings and ids equal the Android testTags.
import DesignSystem
import DesignTokens
public import SwiftUI

/// The design-system gallery. One non-lazy scroll view, so every id is in the tree at once.
public struct DesignSystemGalleryScreen: View {
  private let onClose: () -> Void

  @Environment(\.appTheme) private var theme

  /// - Parameter onClose: called by "Close"; the presenter dismisses the gallery.
  public init(onClose: @escaping () -> Void) {
    self.onClose = onClose
  }

  public var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: theme.spacing.space24) {
        header
        ForEach(GallerySection.all) { section in
          GallerySectionView(section: section)
        }
      }
      .padding(.horizontal, theme.spacing.space20)
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("ds-gallery")
    }
    .background(theme.color(.background))
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline, spacing: theme.spacing.space12) {
      AppComponentText(text: "Design system gallery", style: theme.typography.title2, color: .text)
        .accessibilityAddTraits(.isHeader)
      Spacer()
      AppButton("Close", variant: .text, size: .compact, action: onClose)
        .accessibilityIdentifier("debug_close_ds_gallery")
    }
  }
}

#Preview("Design system gallery, light") {
  DesignSystemGalleryScreen {}
    .previewFrame(.light)
}

#Preview("Design system gallery, dark") {
  DesignSystemGalleryScreen {}
    .previewFrame(.dark)
}
