// The camera's error states and sheets (capture brief §7 C23, §8; board SC20): permission denied
// (`cap-screen-permission`), no camera (`cap-screen-no-camera`), the help sheet with the flat-lay
// technique, and the camera menu with the underwear worn-photo toggle (`cap-camera-underwear-worn-toggle`).
#if os(iOS)
  import CaptureModel
  import DesignSystem
  import DesignTokens
  import SwiftUI
  import UIKit

  /// The C04 state template on the modal: icon, title, body, actions.
  private struct CaptureStateScreen<Actions: View>: View {
    let screenID: String
    let glyph: AppIconName
    let titleKey: String
    let bodyKey: String
    let onClose: () -> Void
    @ViewBuilder let actions: () -> Actions
    @Environment(\.appTheme) private var theme

    var body: some View {
      let card = CaptureTokens(theme: theme).stateCard
      VStack(spacing: 0) {
        CaptureModalHeader(
          title: CaptureText.localized("capture.access.header"),
          closeID: "cap-camera-close",
          onClose: onClose
        )
        ScrollView {
          VStack(alignment: .leading, spacing: AppSpacing.space12) {
            AppIcon(glyph, size: .xl, tint: .textSecondary)
            Text(CaptureText.localized(titleKey))
              .font(theme.font(AppTypography.title3))
              .foregroundStyle(theme.color(.text))
              .accessibilityAddTraits(.isHeader)
            Text(CaptureText.localized(bodyKey))
              .font(theme.font(card.typography))
              .foregroundStyle(theme.color(.textSecondary))
              .fixedSize(horizontal: false, vertical: true)
            VStack(spacing: AppSpacing.space12) {
              actions()
            }
            .padding(.top, AppSpacing.space8)
          }
          .padding(.top, card.paddingTop)
          .padding(.horizontal, card.paddingStart)
          .padding(.bottom, card.paddingBottom)
          .background(RoundedRectangle(cornerRadius: card.rounded).fill(theme.color(.surface)))
          .padding(AppSpacing.space20)
        }
      }
      .background(theme.color(.background).ignoresSafeArea())
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier(screenID)
    }
  }

  /// `cap-screen-permission`: the camera is off for this app; Settings or import.
  struct CapturePermissionView: View {
    let model: CaptureModel
    @Environment(\.openURL) private var openURL

    var body: some View {
      CaptureStateScreen(
        screenID: "cap-screen-permission",
        glyph: .privacy,
        titleKey: "capture.access.permission.title",
        bodyKey: "capture.access.permission.body",
        onClose: model.close
      ) {
        AppButton(
          CaptureText.localized("capture.access.permission.settings"),
          variant: .primary,
          size: .card,
          fullWidth: true
        ) {
          if let url = URL(string: UIApplication.openSettingsURLString) {
            openURL(url)
          }
        }
        .accessibilityIdentifier("cap-permission-settings")
        AppButton(
          CaptureText.localized("capture.access.import"),
          variant: .secondary,
          size: .large,
          leadingIcon: .photo,
          fullWidth: true,
          action: model.startImport
        )
        .accessibilityIdentifier("cap-permission-import")
      }
    }
  }

  /// `cap-screen-no-camera`: no camera on this device (the Simulator); import still works.
  struct CaptureNoCameraView: View {
    let model: CaptureModel

    var body: some View {
      CaptureStateScreen(
        screenID: "cap-screen-no-camera",
        glyph: .photo,
        titleKey: "capture.access.noCamera.title",
        bodyKey: "capture.access.noCamera.body",
        onClose: model.close
      ) {
        AppButton(
          CaptureText.localized("capture.access.import"),
          variant: .primary,
          size: .card,
          leadingIcon: .photo,
          fullWidth: true,
          action: model.startImport
        )
        .accessibilityIdentifier("cap-no-camera-import")
      }
    }
  }

  /// A short C09 sheet: title, content, pinned actions.
  private struct CaptureSheet<Content: View>: View {
    let sheetID: String
    let titleKey: String
    @ViewBuilder let content: () -> Content
    @Environment(\.appTheme) private var theme

    var body: some View {
      let sheet = CaptureTokens(theme: theme).sheet
      ScrollView {
        VStack(alignment: .leading, spacing: AppSpacing.space12) {
          Text(CaptureText.localized(titleKey))
            .font(theme.font(AppTypography.title3))
            .foregroundStyle(theme.color(sheet.textColor))
            .accessibilityAddTraits(.isHeader)
          content()
        }
        .padding(.top, sheet.paddingTop + AppSpacing.space20)
        .padding(.horizontal, sheet.paddingStart)
        .padding(.bottom, sheet.paddingBottom)
      }
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier(sheetID)
      .presentationDetents([.medium, .large])
      .presentationDragIndicator(.visible)
      .presentationCornerRadius(sheet.rounded)
      .presentationBackground(theme.color(sheet.backgroundColor))
    }
  }

  /// `cap-camera-help`'s sheet: the flat-lay technique for blind users (capture brief §8).
  struct CaptureHelpSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.appTheme) private var theme

    var body: some View {
      CaptureSheet(sheetID: "cap-help-sheet", titleKey: "capture.help.title") {
        Text(CaptureText.localized("capture.help.body"))
          .font(theme.font(AppTypography.callout))
          .foregroundStyle(theme.color(.textSecondary))
          .fixedSize(horizontal: false, vertical: true)
        AppButton(
          CaptureText.localized("capture.help.done"),
          variant: .primary,
          size: .large,
          fullWidth: true,
          action: { dismiss() }
        )
        .accessibilityIdentifier("cap-help-done")
        .padding(.top, AppSpacing.space12)
      }
    }
  }

  /// The camera menu (underwear and swimwear only): "Allow worn photos", stored on this phone.
  struct CaptureCameraMenuSheet: View {
    let model: CaptureModel
    @State private var isWornAllowed: Bool
    @Environment(\.appTheme) private var theme

    init(model: CaptureModel) {
      self.model = model
      _isWornAllowed = State(initialValue: model.isUnderwearWornAllowed)
    }

    var body: some View {
      CaptureSheet(sheetID: "cap-camera-menu", titleKey: "capture.a11y.more") {
        HStack(spacing: AppSpacing.space12) {
          VStack(alignment: .leading, spacing: AppSpacing.space4) {
            Text(CaptureText.localized("capture.menu.allowWorn"))
              .font(theme.font(AppTypography.body))
              .foregroundStyle(theme.color(.text))
            Text(CaptureText.localized("capture.menu.allowWorn.helper"))
              .font(theme.font(AppTypography.footnote))
              .foregroundStyle(theme.color(.textSecondary))
              .fixedSize(horizontal: false, vertical: true)
          }
          Spacer(minLength: AppSpacing.space8)
          Text(CaptureText.localized(isWornAllowed ? "capture.menu.on" : "capture.menu.off"))
            .font(theme.font(AppTypography.callout))
            .foregroundStyle(theme.color(.textSecondary))
            .accessibilityHidden(true)
          Toggle(CaptureText.localized("capture.menu.allowWorn"), isOn: $isWornAllowed)
            .labelsHidden()
            .tint(theme.color(.primary))
            .accessibilityIdentifier("cap-camera-underwear-worn-toggle")
        }
        .frame(minHeight: RowToggleTokens.light.height)
        .onChange(of: isWornAllowed) { _, isAllowed in
          model.setUnderwearWornAllowed(isAllowed)
        }
      }
    }
  }
#endif
