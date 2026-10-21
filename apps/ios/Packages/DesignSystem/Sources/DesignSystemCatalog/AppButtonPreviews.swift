// Xcode previews of AppButton: the gallery's C01 section (every ComponentGallery.button cell, in
// generated order, tagged with its test ID), light then dark, and a playground with live controls.
// Synthetic label only. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

#Preview("AppButton states, light") {
  GallerySectionPreview(component: .button)
    .previewFrame(.light)
}

#Preview("AppButton states, dark") {
  GallerySectionPreview(component: .button)
    .previewFrame(.dark)
}

#Preview("AppButton playground") {
  @Previewable @State var variant = ButtonVariant.primary
  @Previewable @State var size = ButtonSize.large
  @Previewable @State var enabled = true
  @Previewable @State var loading = false
  @Previewable @State var fullWidth = false
  @Previewable @State var label = ComponentGallery.buttonLabel
  @Previewable @State var leadingIcon: AppIconName? = nil

  Form {
    Section {
      AppButton(
        label,
        variant: variant,
        size: size,
        leadingIcon: leadingIcon,
        fullWidth: fullWidth,
        enabled: enabled,
        loading: loading
      ) {}
    }
    Section {
      PlaygroundPickers(
        variant: $variant,
        size: $size,
        sizes: ButtonSize.allCases.filter { AppButtonRules.isAllowed(variant, $0, in: AppTheme.light.buttons) }
      )
      Picker("Leading icon", selection: $leadingIcon) {
        Text("none").tag(AppIconName?.none)
        ForEach(AppIconName.allCases, id: \.self) { Text($0.rawValue).tag(AppIconName?.some($0)) }
      }
      Toggle("Enabled", isOn: $enabled)
      Toggle("Loading", isOn: $loading)
      Toggle("Full width", isOn: $fullWidth)
      TextField("Label", text: $label)
    }
  }
  .appTheme()
}
