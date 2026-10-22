// The camera screen's parts (surface brief sc16 "Measured values", board SC17–SC18 and C11 proposed): the
// guide outline, the shutter with its ring, the hint card, the C05 mode switch, the step pill, the batch
// count chip and the camera buttons. State is never colour alone: dashed vs solid guide, the ring and the
// lock glyph, and an icon with words on every hint (capture brief §8).
#if os(iOS)
  import AIStylistKernel
  import AVFoundation
  import CaptureModel
  import DesignSystem
  import DesignTokens
  import SwiftUI
  import UIKit

  /// The guide outline (`cap-guide-<family>-<mode>[-back|-pair]`): the family's C11 silhouette, two-tone so
  /// it reads over any video (camera-paper 2 over camera-ink 4); dashed while locked, solid once unlocked.
  /// It fills the preview: the C11 paths already sit inside the guide box (top 68, sides 32, bottom 104).
  struct CaptureGuideOutlineView: View {
    let guide: CaptureGuide
    let isUnlocked: Bool
    @Environment(\.appTheme) private var theme

    var body: some View {
      let shape = CaptureGuideShape(outline: CaptureGuideOutline(guide: guide))
      ZStack {
        shape.stroke(theme.color(.cameraInk), style: style(width: CaptureMetrics.guideHalo))
        shape.stroke(theme.color(.cameraPaper), style: style(width: CaptureMetrics.guideStroke))
      }
      .accessibilityElement()
      .accessibilityLabel(CaptureText.instruction(for: guide))
      .accessibilityIdentifier(guide.testID)
    }

    private func style(width: Double) -> StrokeStyle {
      isUnlocked
        ? StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)
        : StrokeStyle(
          lineWidth: width,
          lineCap: .butt,
          lineJoin: .round,
          dash: [CaptureMetrics.guideDash, CaptureMetrics.guideDash]
        )
    }
  }

  /// A guide outline scaled into its frame: the C11 350 × 506 preview fitted whole and centred, so the
  /// silhouette keeps its proportions on every phone.
  /// `nonisolated`: `Shape.path(in:)` is nonisolated; the outline is a pure value.
  nonisolated struct CaptureGuideShape: Shape {
    let outline: CaptureGuideOutline

    func path(in rect: CGRect) -> Path {
      let width = CaptureGuideOutline.canvasWidth
      let height = CaptureGuideOutline.canvasHeight
      let scale = min(rect.width / width, rect.height / height)
      let originX = rect.midX - width * scale / 2
      let originY = rect.midY - height * scale / 2
      func point(_ point: CaptureOutlinePoint) -> CGPoint {
        CGPoint(x: originX + point.x * scale, y: originY + point.y * scale)
      }
      var path = Path()
      for segment in outline.segments {
        switch segment {
        case .move(let to):
          path.move(to: point(to))
        case .line(let to):
          path.addLine(to: point(to))
        case .quad(let control, let to):
          path.addQuadCurve(to: point(to), control: point(control))
        case .cubic(let control1, let control2, let to):
          path.addCurve(to: point(to), control1: point(control1), control2: point(control2))
        case .close:
          path.closeSubpath()
        }
      }
      return path
    }
  }

  /// The shutter (76): ring track camera-track, fill camera-paper from 12 o'clock clockwise; disc 60
  /// (capturing 52); locked shows a camera-track disc with the lock glyph. Its test ID follows its state.
  struct CaptureShutterButton: View {
    let shutter: ShutterState?
    let ringProgress: Double
    let label: String
    let action: () -> Void
    @Environment(\.appTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Look {
      case locked
      case unlocked
      case capturing
    }

    private var look: Look {
      switch shutter {
      case .unlocked: .unlocked
      case .capturing: .capturing
      case .idle, .warmingUp, .locked, .cooldown, nil: .locked
      }
    }

    private var testID: String {
      switch look {
      case .locked: "cap-shutter-locked"
      case .unlocked: "cap-shutter-unlocked"
      case .capturing: "cap-shutter-capturing"
      }
    }

    var body: some View {
      let ringDiameter = CaptureMetrics.shutterSize - CaptureMetrics.shutterRing
      ZStack {
        Circle()
          .stroke(theme.color(.cameraTrack), lineWidth: CaptureMetrics.shutterRing)
          .frame(width: ringDiameter, height: ringDiameter)
        Circle()
          .trim(from: 0, to: ringProgress)
          .stroke(
            theme.color(.cameraPaper),
            style: StrokeStyle(lineWidth: CaptureMetrics.shutterRing, lineCap: .butt)
          )
          .rotationEffect(.degrees(-90))
          .frame(width: ringDiameter, height: ringDiameter)
          .animation(reduceMotion ? nil : .linear(duration: AppMotion.Press.duration / 1000), value: ringProgress)
          .accessibilityElement()
          .accessibilityLabel(label)
          .accessibilityValue(CaptureText.formatted("capture.ring.value", Int((ringProgress * 100).rounded())))
          .accessibilityIdentifier("cap-ring")
        Button(action: action) {
          disc
            .frame(width: CaptureMetrics.shutterSize, height: CaptureMetrics.shutterSize)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(testID)
      }
      .frame(width: CaptureMetrics.shutterSize, height: CaptureMetrics.shutterSize)
    }

    @ViewBuilder private var disc: some View {
      switch look {
      case .locked:
        Circle()
          .fill(theme.color(.cameraTrack))
          .frame(width: CaptureMetrics.shutterDisc, height: CaptureMetrics.shutterDisc)
          .overlay { AppIcon(.lock, size: .lg, tint: .cameraPaper) }
      case .unlocked:
        Circle()
          .fill(theme.color(.cameraPaper))
          .frame(width: CaptureMetrics.shutterDisc, height: CaptureMetrics.shutterDisc)
      case .capturing:
        Circle()
          .fill(theme.color(.cameraPaper))
          .frame(width: CaptureMetrics.shutterDiscCapturing, height: CaptureMetrics.shutterDiscCapturing)
      }
    }
  }

  /// The hint card: icon md + text in subhead-medium, up to 3 lines and never truncated; its test ID is
  /// the hint key.
  struct CaptureHintCard: View {
    let hint: CaptureHint
    let guide: CaptureGuide
    @Environment(\.appTheme) private var theme

    var body: some View {
      let tokens = CaptureTokens(theme: theme)
      HStack(alignment: .firstTextBaseline, spacing: CaptureMetrics.hintGap) {
        AppIcon(Self.glyph(for: hint), size: .md, tint: .cameraPaper)
        Text(CaptureText.hint(hint, guide: guide))
          .font(theme.font(AppTypography.subheadMedium))
          .foregroundStyle(theme.color(.cameraPaper))
          .fixedSize(horizontal: false, vertical: true)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding(.vertical, CaptureMetrics.hintPaddingVertical)
      .padding(.horizontal, CaptureMetrics.hintPaddingHorizontal)
      .background(
        RoundedRectangle(cornerRadius: AppRadius.radius16)
          .fill(theme.color(.cameraGround))
          .shadow(color: tokens.snackbarShadowColor, radius: tokens.snackbarShadowRadius, y: tokens.snackbarShadowY)
      )
      .overlay {
        if tokens.isDark {
          RoundedRectangle(cornerRadius: AppRadius.radius16).strokeBorder(theme.color(.divider), lineWidth: 1)
        }
      }
      .accessibilityElement(children: .combine)
      .accessibilityIdentifier(hint.rawValue)
    }

    /// Every hint has an icon as well as words (capture brief §8).
    static func glyph(for hint: CaptureHint) -> AppIconName {
      switch hint {
      case .warmingUp: .processing
      case .noItem: .search
      case .cutOffMultiple, .cutOffTop, .cutOffBottom, .cutOffLeft, .cutOffRight: .zoomOut
      case .bodyShouldersHips, .bodyHipsAnkles, .bodyHipsKnees, .bodyShouldersKnees: .poseNeutral
      case .covered: .layers
      case .tooSmall: .zoomIn
      case .notSteady: .pause
      case .tooDark: .evening
      case .tooBright: .sun
      case .tilt: .rotateLeft
      case .guide: .info
      case .ready: .check
      case .capturing: .capture
      case .nextItem: .arrowRight
      }
    }
  }

  /// The C05 camera mode switch (Flat / Hanger / Worn); hidden when only one mode is offered.
  struct CaptureModeSwitch: View {
    let modes: [CaptureMode]
    let selected: CaptureMode
    let onSelect: (CaptureMode) -> Void
    @Environment(\.appTheme) private var theme

    var body: some View {
      let tokens = CaptureTokens(theme: theme)
      let track = tokens.modeSwitch
      HStack(spacing: CaptureMetrics.modeSwitchGap) {
        ForEach(modes, id: \.self) { mode in
          let isSelected = mode == selected
          Button {
            onSelect(mode)
          } label: {
            Text(CaptureText.modeLabel(mode))
              .font(theme.font(isSelected ? tokens.modeSelected.typography : AppTypography.subheadMedium))
              .foregroundStyle(theme.color(isSelected ? tokens.modeSelected.textColor : track.textColor))
              .padding(.horizontal, track.paddingStart)
              .frame(minHeight: track.height)
              .background(Capsule().fill(isSelected ? theme.color(tokens.modeSelected.backgroundColor) : .clear))
              .contentShape(Capsule())
          }
          .buttonStyle(.plain)
          .accessibilityAddTraits(isSelected ? .isSelected : [])
          .accessibilityValue(CaptureText.localized(isSelected ? "capture.mode.selected" : "capture.mode.notSelected"))
          .accessibilityIdentifier("cap-mode-\(mode.rawValue)")
        }
      }
      .padding(CaptureMetrics.modeSwitchTrackPadding)
      .background(Capsule().fill(theme.color(track.backgroundColor)))
    }
  }

  /// The step pill: "Back" / "Pair" (`cap-step-back`, `cap-step-pair`) or, on a single front step, the
  /// item's name with no test ID (boards SC16–SC18); 32, label-sm, camera-ground / camera-paper.
  struct CaptureStepPill: View {
    let label: CaptureStepLabel
    @Environment(\.appTheme) private var theme

    var body: some View {
      Text(CaptureText.localized(textKey))
        .font(theme.font(AppTypography.labelSm))
        .foregroundStyle(theme.color(.cameraPaper))
        .padding(.horizontal, CaptureMetrics.pillPaddingHorizontal)
        .frame(minHeight: CaptureMetrics.pillHeight)
        .background(Capsule().fill(theme.color(.cameraGround)))
        .accessibilityIdentifier(testID ?? "")
    }

    private var textKey: String {
      switch label {
      case .back: "capture.step.back"
      case .pair: "capture.step.pair"
      case .family(let family): "capture.family.\(family.rawValue)"
      case .underwear(let pick): "capture.underwear.\(pick.rawValue)"
      }
    }

    private var testID: String? {
      switch label {
      case .back: "cap-step-back"
      case .pair: "cap-step-pair"
      case .family, .underwear: nil
      }
    }
  }

  /// The batch count chip (C05 upload badge): 36, 1.5 ring, check md, label-md; camera-paper (dark:
  /// camera-yellow).
  struct CaptureCountChip: View {
    let count: Int
    @Environment(\.appTheme) private var theme

    var body: some View {
      let accent = CaptureTokens(theme: theme).cameraAccent
      HStack(spacing: AppSpacing.space4) {
        AppIcon(.check, size: .md, tint: accent)
        Text(CaptureText.itemCount(count))
          .font(theme.font(AppTypography.labelMd))
          .foregroundStyle(theme.color(accent))
      }
      .padding(.horizontal, CaptureMetrics.countChipPaddingHorizontal)
      .frame(minHeight: CaptureMetrics.countChipHeight)
      .overlay(Capsule().strokeBorder(theme.color(accent), lineWidth: CaptureMetrics.countChipRing))
      .accessibilityElement(children: .combine)
      .accessibilityIdentifier("cap-batch-count")
    }
  }

  /// The proposed camera tonal button (Compact 44 on camera-track: "Take photo anyway", "Next item").
  struct CaptureCameraTonalButton: View {
    let title: String
    let action: () -> Void
    @Environment(\.appTheme) private var theme

    var body: some View {
      Button(action: action) {
        Text(title)
          .font(theme.font(AppTypography.subhead))
          .foregroundStyle(theme.color(.cameraPaper))
          .multilineTextAlignment(.center)
          .padding(.horizontal, AppSpacing.space20)
          .frame(minHeight: CaptureMetrics.minTouchTarget)
          .background(Capsule().fill(theme.color(.cameraTrack)))
          .contentShape(Capsule())
      }
      .buttonStyle(.plain)
    }
  }

  /// The camera's text button (44, padding 0 12, subhead, camera-paper): "Skip", "Done".
  struct CaptureCameraTextButton: View {
    let title: String
    let action: () -> Void
    @Environment(\.appTheme) private var theme

    var body: some View {
      Button(action: action) {
        Text(title)
          .font(theme.font(AppTypography.subhead))
          .foregroundStyle(theme.color(.cameraPaper))
          .padding(.horizontal, AppSpacing.space12)
          .frame(minHeight: CaptureMetrics.minTouchTarget)
          .contentShape(Rectangle())
      }
      .buttonStyle(CapturePressStyle(shape: Capsule(), pressedFill: theme.color(.cameraTrack)))
    }
  }

  /// The live preview: an `AVCaptureVideoPreviewLayer` filling the view, portrait.
  struct CaptureSessionPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
      let view = PreviewView()
      view.previewLayer.videoGravity = .resizeAspectFill
      view.previewLayer.session = session
      view.rotateToPortrait()
      return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
      guard view.previewLayer.session !== session else { return }
      view.previewLayer.session = session
      view.rotateToPortrait()
    }

    final class PreviewView: UIView {
      let previewLayer = AVCaptureVideoPreviewLayer()

      override init(frame: CGRect) {
        super.init(frame: frame)
        layer.addSublayer(previewLayer)
      }

      required init?(coder: NSCoder) {
        nil
      }

      override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer.frame = bounds
      }

      func rotateToPortrait() {
        if let connection = previewLayer.connection, connection.isVideoRotationAngleSupported(90) {
          connection.videoRotationAngle = 90
        }
      }
    }
  }
#endif
