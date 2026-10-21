// Xcode previews of AppBadge: the gallery's C03 Badges section (every ComponentGallery.badge cell, in
// generated order, tagged with its test ID, on the host surface), light then dark, and a playground with live
// controls. Synthetic samples only. They live in the dev-only catalog: the DesignSystem target holds no
// previews.
import DesignSystem
import DesignTokens
import SwiftUI

#Preview("AppBadge states, light") {
  GallerySectionPreview(component: .badge)
    .previewFrame(.light)
}

#Preview("AppBadge states, dark") {
  GallerySectionPreview(component: .badge)
    .previewFrame(.dark)
}

#Preview("AppBadge playground") {
  @Previewable @State var variant = BadgeVariant.count
  @Previewable @State var size = BadgeSize.medium
  @Previewable @State var label = ComponentGallery.badgeLabel

  Form {
    Section {
      AppBadge(
        variant: variant,
        size: size,
        label: label.isEmpty ? nil : label,
        hostSurface: ComponentGallery.badgeHostSurface
      )
    }
    Section {
      PlaygroundPickers(
        variant: $variant,
        size: $size,
        sizes: BadgeSize.allCases.filter {
          AppTheme.light.badges.appearance(variant: variant, size: $0, state: .enabled) != nil
        }
      )
      // An empty label is nil: a count or trial pill without one renders nothing.
      TextField("Label", text: $label)
    }
  }
  .appTheme()
}
