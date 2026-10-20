// Xcode previews of AppButton: the gallery's C01 section (every ComponentGallery.button cell, in
// generated order, tagged with its test ID), light then dark, and a playground with live controls.
// Synthetic label only. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

/// The gallery's C01 section on the theme background, scrollable.
private struct ButtonSectionPreview: View {
  @Environment(\.appTheme) private var theme

  var body: some View {
    ScrollView {
      GallerySectionView(section: GallerySection(component: .button))
        .padding(theme.spacing.space20)
    }
    .background(theme.color(.background))
  }
}

#Preview("AppButton states, light") {
  ButtonSectionPreview()
    .appTheme()
    .environment(\.colorScheme, .light)
}

#Preview("AppButton states, dark") {
  ButtonSectionPreview()
    .appTheme()
    .environment(\.colorScheme, .dark)
}

#Preview("AppButton playground") {
  @Previewable @State var variant = ButtonVariant.primary
  @Previewable @State var size = ButtonSize.large
  @Previewable @State var enabled = true
  @Previewable @State var loading = false
  @Previewable @State var fullWidth = false
  @Previewable @State var label = ComponentGallery.buttonLabel

  // The allowed pairs are the same in every context, so the light spec answers for all of them.
  let sizes = ButtonSize.allCases.filter { AppButtonRules.isAllowed(variant, $0, in: AppTheme.light.buttons) }

  Form {
    Section {
      AppButton(
        label,
        variant: variant,
        size: size,
        fullWidth: fullWidth,
        enabled: enabled,
        loading: loading
      ) {}
    }
    Section {
      Picker("Variant", selection: $variant) {
        ForEach(ButtonVariant.allCases, id: \.self) { Text($0.rawValue) }
      }
      Picker("Size", selection: $size) {
        ForEach(sizes, id: \.self) { Text($0.rawValue) }
      }
      Toggle("Enabled", isOn: $enabled)
      Toggle("Loading", isOn: $loading)
      Toggle("Full width", isOn: $fullWidth)
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
