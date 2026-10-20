// Xcode previews of AppButton: the state grid (every ComponentGallery.button cell, in generated order,
// light then dark) and a playground with live controls. Synthetic label only.
import DesignTokens
import SwiftUI

/// Every gallery cell, one row per variant and size, each cell tagged with its test ID. Forced states
/// are drawn with `AppButtonFace`, since a live button cannot be held pressed or focused.
private struct AppButtonStateGrid: View {
  @Environment(\.appTheme) private var theme

  /// The gallery split into runs of consecutive entries with the same variant and size.
  private var rows: [[ButtonGalleryEntry]] {
    ComponentGallery.button.reduce(into: []) { rows, entry in
      if let last = rows.last?.last, last.variant == entry.variant, last.size == entry.size {
        rows[rows.count - 1].append(entry)
      } else {
        rows.append([entry])
      }
    }
  }

  var body: some View {
    ScrollView([.horizontal, .vertical]) {
      Grid(alignment: .leading, horizontalSpacing: theme.spacing.space16, verticalSpacing: theme.spacing.space16) {
        ForEach(rows, id: \.first?.testId) { row in
          GridRow {
            ForEach(row, id: \.testId) { entry in
              cell(entry)
            }
          }
        }
      }
      .padding(theme.spacing.space20)
    }
    .background(theme.color(.background))
  }

  @ViewBuilder
  private func cell(_ entry: ButtonGalleryEntry) -> some View {
    if let appearance = theme.buttons.appearance(variant: entry.variant, size: entry.size, state: entry.state) {
      VStack(spacing: theme.spacing.space4) {
        AppButtonFace(
          label: ComponentGallery.buttonLabel,
          appearance: appearance,
          loading: entry.state == .loading
        )
        .accessibilityIdentifier(entry.testId)
        Text(entry.testId)
          .font(theme.font(theme.typography.caption))
          .foregroundStyle(theme.color(.textSecondary))
      }
    }
  }
}

#Preview("AppButton states, light") {
  AppButtonStateGrid()
    .appTheme()
    .environment(\.colorScheme, .light)
}

#Preview("AppButton states, dark") {
  AppButtonStateGrid()
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
