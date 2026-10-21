// The camera screen (`cap-screen-camera`, capture brief §4–§8, boards SC17–SC20): top bar, preview with
// the guide, step pill and hint card, the reserved "Take photo anyway" slot, the mode switch, and the
// bottom row (import, shutter, Skip or Done). It renders `CaptureModel.camera`; the controller runs the
// camera in `.task`, which stops when the screen goes or the app goes to the background.
#if os(iOS)
  import AIStylistKernel
  import AVKit
  import CaptureModel
  import DesignSystem
  import DesignTokens
  import SwiftUI

  struct CaptureCameraView: View {
    let controller: CaptureCameraController
    let setup: CaptureCameraSetup
    @State private var availability: CaptureCameraAvailability?
    @State private var isHelpShown = false
    @State private var isMenuShown = false
    /// This camera screen has run once: a later run is a return from the background.
    @State private var hasRun = false
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.appTheme) private var theme

    private var model: CaptureModel { controller.model }

    var body: some View {
      Group {
        switch availability {
        case .permissionDenied:
          CapturePermissionView(model: model)
        case .noCamera:
          CaptureNoCameraView(model: model)
        case .ready, nil:
          cameraScreen
        }
      }
      .task(id: scenePhase != .background) {
        // Background: the previous run was cancelled (camera stopped); the model goes idle. Return:
        // a new run starts the camera and the model warms up again.
        guard scenePhase != .background else {
          if hasRun { controller.backgrounded() }
          return
        }
        let isFirstRun = !hasRun
        hasRun = true
        await controller.run(setup: currentSetup, isFirstRun: isFirstRun) { availability = $0 }
      }
    }

    /// The setup now (the mode may have changed since the screen opened).
    private var currentSetup: CaptureCameraSetup {
      if case .camera(let setup) = model.screen { setup } else { setup }
    }

    private var cameraScreen: some View {
      let output = model.camera
      return VStack(spacing: CaptureMetrics.chromeGap) {
        topBar
        preview(output)
        anywaySlot(output)
        if model.modesOffered.count > 1 {
          CaptureModeSwitch(modes: model.modesOffered, selected: currentSetup.mode, onSelect: controller.selectMode)
        }
        bottomRow(output)
      }
      .padding(.top, CaptureMetrics.chromeTop)
      .padding(.horizontal, AppSpacing.space20)
      .padding(.bottom, CaptureMetrics.chromeBottom)
      .ignoresSafeArea(edges: .bottom)
      .background(theme.color(.cameraGround).ignoresSafeArea())
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("cap-screen-camera")
      .onCameraCaptureEvent(isEnabled: output?.isHardwareShutterEnabled ?? false) { event in
        if event.phase == .ended {
          controller.hardwareShutter()
        }
      }
      // Every mode change reaches the camera (the switch, or the menu's worn toggle falling back to flat),
      // so the body-pose check runs in worn mode only.
      .onChange(of: currentSetup.mode) {
        controller.camera.update(for: currentSetup)
      }
      .sheet(isPresented: $isHelpShown) {
        CaptureHelpSheet()
      }
      .sheet(isPresented: $isMenuShown) {
        CaptureCameraMenuSheet(model: model)
      }
    }

    // MARK: - Top bar

    private var topBar: some View {
      ZStack {
        if currentSetup.flow == .batch {
          CaptureCountChip(count: model.batchPhotos.count)
        }
        HStack(spacing: 0) {
          CaptureIconButton(label: CaptureText.localized("capture.a11y.close"), action: model.close) {
            AppIcon(.close, size: .lg)
          }
          .accessibilityIdentifier("cap-camera-close")
          Spacer(minLength: AppSpacing.space8)
          // SC17–SC18 order: more (underwear only), speaker, torch, help.
          if model.isUnderwear {
            CaptureIconButton(label: CaptureText.localized("capture.a11y.more"), action: { isMenuShown = true }) {
              AppIcon(.more, size: .lg)
            }
            .accessibilityIdentifier("cap-camera-more")
          }
          speechButton
          if controller.camera.hasTorch {
            torchButton
          }
          CaptureIconButton(label: CaptureText.localized("capture.a11y.help"), action: { isHelpShown = true }) {
            AppIcon(.info, size: .lg)
          }
          .accessibilityIdentifier("cap-camera-help")
        }
      }
      .frame(minHeight: CaptureMetrics.minTouchTarget)
    }

    /// Shows whether hints are spoken: on with the screen reader (SC18) or the toggle; the tap flips the
    /// toggle.
    private var speechButton: some View {
      let isOn = model.isSpeechToggledOn || model.isScreenReaderOn
      return CaptureIconButton(
        label: CaptureText.localized(isOn ? "capture.a11y.speech.on" : "capture.a11y.speech.off"),
        action: { model.setSpeechToggled(!model.isSpeechToggledOn) }
      ) {
        CaptureSpeakerGlyph(isOn: isOn)
          .stroke(style: StrokeStyle(lineWidth: AppIconGlyphStroke.lg, lineCap: .round, lineJoin: .round))
          .frame(width: AppIconSize.lg.size, height: AppIconSize.lg.size)
      }
      .accessibilityAddTraits(isOn ? .isSelected : [])
      .accessibilityIdentifier("cap-camera-speech")
    }

    private var torchButton: some View {
      let isOn = controller.camera.isTorchOn
      return CaptureIconButton(
        label: CaptureText.localized("capture.a11y.torch"),
        action: { controller.camera.setTorch(!isOn) }
      ) {
        AppIcon(.flash, size: .lg)
      }
      .accessibilityAddTraits(isOn ? .isSelected : [])
      .accessibilityIdentifier("cap-camera-torch")
    }

    // MARK: - Preview

    private func preview(_ output: CaptureCameraOutput?) -> some View {
      let shape = RoundedRectangle(cornerRadius: AppRadius.radius24)
      return ZStack {
        CapturePreviewContent(preview: controller.camera.preview)
        if let output {
          CaptureGuideOutlineView(guide: output.guide, isUnlocked: output.isUnlockedLook)
        }
        VStack(spacing: 0) {
          CaptureStepPill(side: currentSetup.side)
            .padding(.top, CaptureMetrics.pillTop)
          Spacer(minLength: 0)
          if let output, let hint = output.hint {
            CaptureHintCard(hint: hint, guide: output.guide)
              .padding(.horizontal, AppSpacing.space16)
              .padding(.bottom, CaptureMetrics.hintBottom)
          }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(theme.color(.cameraTrack))
      .clipShape(shape)
      .overlay {
        if CaptureTokens(theme: theme).isDark {
          shape.strokeBorder(theme.color(.divider), lineWidth: 1)
        }
      }
    }

    // MARK: - Anyway slot

    private func anywaySlot(_ output: CaptureCameraOutput?) -> some View {
      VStack(spacing: AppSpacing.space8) {
        if let output, output.isAnywayVisible {
          if let reason = output.anywayReason {
            Text(CaptureText.anywayReason(reason, guide: output.guide))
              .font(theme.font(AppTypography.footnote))
              .foregroundStyle(theme.color(.cameraPaper))
              .multilineTextAlignment(.center)
              .fixedSize(horizontal: false, vertical: true)
              .accessibilityIdentifier("cap-anyway-reason")
          }
          CaptureCameraTonalButton(title: CaptureText.localized("capture.anyway"), action: controller.anywayTapped)
            .accessibilityIdentifier("cap-anyway-button")
        } else if output?.shutter == .cooldown {
          CaptureCameraTonalButton(
            title: CaptureText.localized("capture.batch.next"),
            action: controller.nextItemTapped
          )
          .accessibilityIdentifier("cap-batch-next")
        }
      }
      .frame(maxWidth: .infinity, minHeight: CaptureMetrics.anywaySlotHeight)
    }

    // MARK: - Bottom row

    private func bottomRow(_ output: CaptureCameraOutput?) -> some View {
      HStack(spacing: 0) {
        HStack {
          importButton
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        CaptureShutterButton(
          shutter: output?.shutter,
          ringProgress: output?.ringProgress ?? 0,
          label: shutterLabel(output),
          action: controller.shutterTapped
        )
        HStack {
          Spacer(minLength: 0)
          rightSlot
        }
        .frame(maxWidth: .infinity)
      }
      .padding(.horizontal, AppSpacing.space8)
      .frame(minHeight: CaptureMetrics.bottomRowHeight)
    }

    private var importButton: some View {
      Button(action: model.startImport) {
        AppIcon(.photo, size: .lg, tint: .cameraPaper)
          .frame(width: CaptureMetrics.importButtonSize, height: CaptureMetrics.importButtonSize)
          .background(Circle().fill(theme.color(.cameraTrack)))
          .contentShape(Circle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(CaptureText.localized("capture.a11y.import"))
      .accessibilityIdentifier("cap-camera-import")
    }

    @ViewBuilder private var rightSlot: some View {
      if currentSetup.flow == .batch {
        CaptureCameraTextButton(title: CaptureText.localized("capture.batch.done"), action: model.batchDone)
          .accessibilityIdentifier("cap-batch-done")
      } else if currentSetup.side != .front {
        CaptureCameraTextButton(title: CaptureText.localized("capture.camera.skip"), action: model.skipSecondPhoto)
          .accessibilityIdentifier("cap-camera-skip-back")
      }
    }

    /// "Take photo", or "Take photo, unavailable: <hint text>" while locked (capture brief §8).
    private func shutterLabel(_ output: CaptureCameraOutput?) -> String {
      guard let output else { return CaptureText.shutterLabel(lockedBecause: nil) }
      switch output.shutter {
      case .unlocked, .capturing:
        return CaptureText.shutterLabel(lockedBecause: nil)
      case .idle, .warmingUp, .locked, .cooldown:
        if output.isAnywayVisible { return CaptureText.shutterLabel(lockedBecause: nil) }
        let hintText = output.hint.map { CaptureText.hint($0, guide: output.guide) }
        return CaptureText.shutterLabel(lockedBecause: hintText ?? "")
      }
    }
  }

  extension CaptureCameraOutput {
    /// The guide is solid while unlocked or capturing, dashed otherwise.
    fileprivate var isUnlockedLook: Bool {
      switch shutter {
      case .unlocked, .capturing: true
      case .idle, .warmingUp, .locked, .cooldown: false
      }
    }
  }

  /// The stroke of a drawn glyph at the lg step (DESIGN.md "Icons": 1.7 grid units at 24).
  private enum AppIconGlyphStroke {
    static let lg = IconLgTokens.light.strokeWidth * AppIconSize.lg.size / 24
  }

  /// What the preview area draws: the live layer, the debug frame (moved by its jitter), or nothing.
  private struct CapturePreviewContent: View {
    let preview: CapturePreview

    var body: some View {
      switch preview {
      case .none:
        Color.clear
      case .session(let session):
        CaptureSessionPreview(session: session)
      case .frames(let frames):
        GeometryReader { proxy in
          if let image = frames.image {
            Image(decorative: image, scale: 1)
              .resizable()
              .scaledToFill()
              .frame(width: proxy.size.width, height: proxy.size.height)
              .offset(
                x: frames.offset.width * proxy.size.width,
                y: frames.offset.height * proxy.size.height
              )
          }
        }
      }
    }
  }
#endif
