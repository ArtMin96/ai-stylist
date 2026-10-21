// Xcode previews of AppBadge: the gallery's C03 Badges section (every ComponentGallery.badge cell, in
// generated order, tagged with its test ID, on the host surface), light then dark, and a playground with live
// controls. Synthetic samples only. They live in the dev-only catalog: the DesignSystem target holds no
// previews.
import DesignSystem
import DesignTokens
import SwiftUI

#Preview("AppBadge states, light") {
  GallerySectionPreview(component: .badge)
    .appTheme()
    .environment(\.colorScheme, .light)
}

#Preview("AppBadge states, dark") {
  GallerySectionPreview(component: .badge)
    .appTheme()
    .environment(\.colorScheme, .dark)
}

#Preview("AppBadge playground") {
  @Previewable @State var variant = BadgeVariant.count
  @Previewable @State var size = BadgeSize.medium
  @Previewable @State var label = ComponentGallery.badgeLabel

  // The allowed sizes are the same in every context, so the light spec answers for all of them.
  let sizes = BadgeSize.allCases.filter {
    AppTheme.light.badges.appearance(variant: variant, size: $0, state: .enabled) != nil
  }

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
      Picker("Variant", selection: $variant) {
        ForEach(BadgeVariant.allCases, id: \.self) { Text($0.rawValue) }
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
