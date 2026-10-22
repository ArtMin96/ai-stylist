// The category picker (`cap-screen-picker`, capture brief §2, board SC16), the underwear and swimwear
// sub-pick, and the once-only opt-in sheet (`cap-optin-sheet`, §7 C19).
#if os(iOS)
  import AIStylistKernel
  import CaptureModel
  import DesignSystem
  import DesignTokens
  import SwiftUI

  /// One picker tile: a family, the underwear tile or "Not sure".
  private enum PickerTile: Hashable {
    case family(CaptureShapeFamily)
    case underwear

    /// §2 order: the eight families, then underwear. "Not sure" (`generic`) is the button under the grid
    /// (SC16).
    static let all: [PickerTile] =
      [.top, .longBottom, .shortBottom, .onePiece, .outerwear, .shoes, .bag, .smallItem].map(PickerTile.family)
      + [.underwear]

    var testID: String {
      switch self {
      case .family(let family): "cap-picker-family-\(family.rawValue)"
      case .underwear: "cap-picker-family-underwear"
      }
    }

    var label: String {
      switch self {
      case .family(let family): CaptureText.familyLabel(family)
      case .underwear: CaptureText.localized("capture.picker.underwear")
      }
    }

    var subtitle: String? {
      if case .family(let family) = self { CaptureText.familySubtitle(family) } else { nil }
    }

    /// Placeholder art: C10 garment art has no iOS component yet, so a C02 glyph stands in.
    var glyph: AppIconName {
      switch self {
      case .family(.outerwear): .coat
      case .family(.bag): .packed
      case .family(.smallItem): .tag
      case .family, .underwear: .closet
      }
    }
  }

  /// `cap-screen-picker`.
  struct CapturePickerView: View {
    let model: CaptureModel
    @Environment(\.appTheme) private var theme

    var body: some View {
      VStack(spacing: 0) {
        CaptureModalHeader(
          title: CaptureText.localized("capture.picker.title"),
          closeID: "cap-picker-close",
          onClose: model.close
        )
        ScrollView {
          VStack(spacing: AppSpacing.space16) {
            LazyVGrid(columns: CaptureMetrics.pickerColumns, spacing: AppSpacing.space12) {
              ForEach(PickerTile.all, id: \.self) { tile in
                tileButton(tile)
              }
            }
            // SC16: "Not sure" secondary Large 52, then batch and import as tonal Compact 44.
            VStack(spacing: AppSpacing.space12) {
              AppButton(
                CaptureText.familyLabel(.generic),
                variant: .secondary,
                size: .large,
                fullWidth: true,
                action: model.chooseNotSure
              )
              .accessibilityIdentifier("cap-picker-not-sure")
              VStack(spacing: CaptureMetrics.sheetActionGap) {
                AppButton(
                  CaptureText.localized("capture.picker.batch"),
                  variant: .tonal,
                  size: .compact,
                  leadingIcon: .collection,
                  fullWidth: true,
                  action: model.startBatch
                )
                .accessibilityIdentifier("cap-picker-batch")
                AppButton(
                  CaptureText.localized("capture.picker.import"),
                  variant: .tonal,
                  size: .compact,
                  leadingIcon: .photo,
                  fullWidth: true,
                  action: model.startImport
                )
                .accessibilityIdentifier("cap-picker-import")
              }
            }
          }
          .padding(.horizontal, AppSpacing.space20)
          .padding(.top, AppSpacing.space16)
          .padding(.bottom, AppSpacing.space24)
        }
      }
      .background(theme.color(.background).ignoresSafeArea())
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("cap-screen-picker")
    }

    private func tileButton(_ tile: PickerTile) -> some View {
      Button {
        switch tile {
        case .family(let family): model.chooseFamily(family)
        case .underwear: model.chooseUnderwear()
        }
      } label: {
        VStack(alignment: .leading, spacing: AppSpacing.space4) {
          RoundedRectangle(cornerRadius: AppRadius.radius16)
            .fill(theme.color(.surface2))
            .aspectRatio(1, contentMode: .fit)
            .overlay {
              AppIcon(tile.glyph, size: .xl, tint: .textSecondary)
            }
          Text(tile.label)
            .font(theme.font(AppTypography.captionStrong))
            .foregroundStyle(theme.color(.text))
          if let subtitle = tile.subtitle {
            Text(subtitle)
              .font(theme.font(AppTypography.caption))
              .foregroundStyle(theme.color(.textSecondary))
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityElement(children: .combine)
      .accessibilityAddTraits(.isButton)
      .accessibilityIdentifier(tile.testID)
    }
  }

  /// The underwear and swimwear sub-pick (§2): each maps to the family whose rules it uses.
  struct CaptureUnderwearPickerView: View {
    let model: CaptureModel
    @Environment(\.appTheme) private var theme

    var body: some View {
      VStack(spacing: 0) {
        CaptureModalHeader(
          title: CaptureText.localized("capture.underwear.title"),
          closeID: "cap-picker-close",
          onClose: model.backToPicker
        )
        ScrollView {
          VStack(spacing: 0) {
            ForEach(UnderwearPick.allCases, id: \.self) { pick in
              Button {
                model.chooseUnderwear(pick)
              } label: {
                HStack(spacing: AppSpacing.space12) {
                  Text(CaptureText.underwearLabel(pick))
                    .font(theme.font(AppTypography.body))
                    .foregroundStyle(theme.color(.text))
                  Spacer(minLength: AppSpacing.space8)
                  AppIcon(.chevronRight, size: .md, tint: .textSecondary)
                }
                .frame(minHeight: RowSettingsHeight.value)
                .contentShape(Rectangle())
              }
              .buttonStyle(.plain)
              .accessibilityIdentifier(pick.testID)
              Rectangle().fill(theme.color(.divider)).frame(height: 1)
            }
          }
          .padding(.horizontal, AppSpacing.space20)
        }
      }
      .background(theme.color(.background).ignoresSafeArea())
    }
  }

  /// C07 plain list row height (52), from the generated settings-row token.
  private enum RowSettingsHeight {
    static let value = RowSettingsTokens.light.height
  }

  /// `cap-optin-sheet` (§7 C19): asked once; the answer stays on the device.
  struct CaptureOptInSheet: View {
    let model: CaptureModel
    /// The content's height: a short sheet fits its content (DESIGN.md "Bottom sheet").
    @State private var contentHeight = 0.0
    @Environment(\.appTheme) private var theme

    var body: some View {
      let sheet = CaptureTokens(theme: theme).sheet
      ScrollView {
        VStack(alignment: .leading, spacing: AppSpacing.space12) {
          Text(CaptureText.localized("capture.optin.title"))
            .font(theme.font(AppTypography.title3))
            .foregroundStyle(theme.color(.text))
            .accessibilityAddTraits(.isHeader)
          Text(CaptureText.localized("capture.optin.body"))
            .font(theme.font(AppTypography.callout))
            .foregroundStyle(theme.color(.text))
          VStack(spacing: CaptureMetrics.sheetActionGap) {
            AppButton(
              CaptureText.localized("capture.optin.flatOnly"),
              variant: .tonal,
              size: .large,
              fullWidth: true
            ) { model.answerUnderwearOptIn(.flatAndHangerOnly) }
            .accessibilityIdentifier("cap-optin-flat-only")
            AppButton(
              CaptureText.localized("capture.optin.allowWorn"),
              variant: .tonal,
              size: .large,
              fullWidth: true
            ) { model.answerUnderwearOptIn(.allowWorn) }
            .accessibilityIdentifier("cap-optin-allow-worn")
          }
          .padding(.top, AppSpacing.space12)
        }
        .padding(.top, sheet.paddingTop + AppSpacing.space20)
        .padding(.horizontal, sheet.paddingStart)
        .padding(.bottom, sheet.paddingBottom)
        .onGeometryChange(for: Double.self) { proxy in
          proxy.size.height
        } action: { height in
          contentHeight = height
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("cap-optin-sheet")
      // Taller than the screen at the largest text sizes: the system caps the detent and the content
      // scrolls.
      .presentationDetents(contentHeight > 0 ? [.height(contentHeight)] : [.medium])
      .presentationDragIndicator(.visible)
      .presentationCornerRadius(sheet.rounded)
      .presentationBackground(theme.color(sheet.backgroundColor))
    }
  }
#endif
