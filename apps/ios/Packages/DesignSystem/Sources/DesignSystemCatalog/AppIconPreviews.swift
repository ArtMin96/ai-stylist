// Xcode previews of AppIcon: the gallery's C02 section (the size and tint playground, then every glyph
// grouped by set and tagged with its test ID), light, dark, and at the largest Dynamic Type size. The
// largest-text preview first draws one glyph at every step, so the gentler growth of xl and hero shows
// beside the body-text steps. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

/// The gallery's C02 section on the theme background, scrollable; optionally one glyph at every step above it.
private struct IconSectionPreview: View {
  var showsEveryStep = false

  @Environment(\.appTheme) private var theme

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: theme.spacing.space24) {
        if showsEveryStep {
          IconStepsRow()
        }
        GallerySectionView(section: GallerySection(component: .icon))
      }
      .padding(theme.spacing.space20)
    }
    .background(theme.color(.background))
  }
}

/// One glyph at each icon step, xs to hero, captioned with the step.
private struct IconStepsRow: View {
  @Environment(\.appTheme) private var theme

  var body: some View {
    GalleryFlowLayout(spacing: theme.spacing.space12) {
      ForEach(AppIconSize.allCases, id: \.self) { size in
        VStack(spacing: theme.spacing.space4) {
          AppIcon(.today, size: size)
          Text(size.rawValue)
            .font(theme.font(theme.typography.caption))
            .foregroundStyle(theme.color(.textSecondary))
        }
      }
    }
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
  IconSectionPreview(showsEveryStep: true)
    .appTheme()
    .environment(\.dynamicTypeSize, .accessibility5)
}
