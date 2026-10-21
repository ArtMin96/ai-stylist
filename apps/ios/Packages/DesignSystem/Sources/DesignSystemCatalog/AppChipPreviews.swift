// Xcode previews of AppChip: the gallery's C03 Chips section (every ComponentGallery.chip cell, in generated
// order, tagged with its test ID), light then dark, and a playground with live controls. Synthetic samples
// only. They live in the dev-only catalog: the DesignSystem target holds no previews.
import DesignSystem
import DesignTokens
import SwiftUI

#Preview("AppChip states, light") {
  GallerySectionPreview(component: .chip)
    .appTheme()
    .environment(\.colorScheme, .light)
}

#Preview("AppChip states, dark") {
  GallerySectionPreview(component: .chip)
    .appTheme()
    .environment(\.colorScheme, .dark)
}

#Preview("AppChip playground") {
  @Previewable @State var variant = ChipVariant.filter
  @Previewable @State var size = ChipSize.medium
  @Previewable @State var selected = false
  @Previewable @State var expanded = false
  @Previewable @State var enabled = true
  @Previewable @State var selection = ChipSelection.multiple
  @Previewable @State var label = ComponentGallery.chipLabel
  @Previewable @State var prefix = ComponentGallery.chipPrefix
  @Previewable @State var detail = ComponentGallery.chipDetail

  // The allowed sizes are the same in every context, so the light spec answers for all of them.
  let sizes = ChipSize.allCases.filter {
    AppChipRules.isAllowed(variant, $0, selected: false, expanded: false, enabled: true, in: AppTheme.light.chips)
  }

  Form {
    Section {
      AppChip(
        label,
        variant: variant,
        size: size,
        leadingIcon: ComponentGallery.chipLeadingIcon,
        selected: selected,
        expanded: expanded,
        enabled: enabled,
        selection: selection,
        prefix: prefix.isEmpty ? nil : prefix,
        detail: detail.isEmpty ? nil : detail,
        // camera-ink is a fixed role: the same colour in every context.
        swatch: AppTheme.light.color(ComponentGallery.chipSwatch)
      ) {
        // A tap flips the chip's own toggle, so the playground shows the live state change.
        switch variant.role {
        case .selectable: selected.toggle()
        case .disclosure: expanded.toggle()
        case .button, .menu: break
        }
      }
    }
    Section {
      Picker("Variant", selection: $variant) {
        ForEach(ChipVariant.allCases, id: \.self) { Text($0.rawValue) }
      }
      Picker("Size", selection: $size) {
        ForEach(sizes, id: \.self) { Text($0.rawValue) }
      }
      Picker("Selection", selection: $selection) {
        ForEach(ChipSelection.allCases, id: \.self) { Text($0.rawValue) }
      }
      // The contract's prop names; a toggle the variant does not take renders nothing.
      Toggle("selected", isOn: $selected)
      Toggle("expanded", isOn: $expanded)
      Toggle("enabled", isOn: $enabled)
      TextField("Label", text: $label)
      TextField("Prefix", text: $prefix)
      TextField("Detail", text: $detail)
    }
  }
  .onChange(of: variant) {
    if !sizes.contains(size), let first = sizes.first {
      size = first
    }
  }
  .appTheme()
}
