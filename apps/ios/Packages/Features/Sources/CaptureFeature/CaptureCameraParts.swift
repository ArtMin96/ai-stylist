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

  /// The guide outline (`cap-guide-<family>-<mode>[-back|-pair]`): the family's C11 silhouette, faint (one
  /// camera-paper stroke, no halo) until an item is found; dashed while locked, solid once unlocked. While
  /// the live outline shows it fades out but stays an element, so its ID and instruction remain.
  /// It fills the preview: the C11 paths already sit inside the guide box (top 68, sides 32, bottom 104).
  struct CaptureGuideOutlineView: View {
    let guide: CaptureGuide
    let isUnlocked: Bool
    let isOutlineShown: Bool
    @Environment(\.appTheme) private var theme

    var body: some View {
      Color.clear
        .overlay {
          CaptureGuideShape(outline: CaptureGuideOutline(guide: guide))
            .stroke(
              theme.color(.cameraPaper),
              style: CaptureOutlineStroke.style(width: CaptureMetrics.guideStroke, isUnlocked: isUnlocked)
            )
            .opacity(isOutlineShown ? 0 : 1)
        }
        .accessibilityElement()
        .accessibilityLabel(CaptureText.instruction(for: guide))
        .accessibilityIdentifier(guide.testID)
    }
  }

  /// The live outline (`cap-outline`, value `locked` or `unlocked`; capture brief "Live outline"): the item
  /// as the camera sees it, two-tone so it reads over any video (camera-paper 2 over camera-ink 4), dashed
  /// while locked, solid once unlocked. Between masks it moves over one mask interval; a snap jumps (a new
  /// view per snap); with reduced motion it never moves, it is replaced.
  struct CaptureLiveOutlineView: View {
    let outline: CaptureLiveOutlineState
    let isUnlocked: Bool
    @Environment(\.appTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
      let shape = CaptureLiveOutlineShape(points: CaptureOutlineVector(outline.points))
      ZStack {
        shape.stroke(
          theme.color(.cameraInk),
          style: CaptureOutlineStroke.style(width: CaptureMetrics.guideHalo, isUnlocked: isUnlocked))
        shape.stroke(
          theme.color(.cameraPaper),
          style: CaptureOutlineStroke.style(width: CaptureMetrics.guideStroke, isUnlocked: isUnlocked))
      }
      .animation(
        reduceMotion ? nil : .linear(duration: Double(CaptureRules.Ios.maskIntervalMs) / 1000),
        value: shape.points
      )
      .id(outline.snapCount)
      .accessibilityElement()
      .accessibilityLabel(CaptureText.localized("capture.a11y.outline"))
      .accessibilityValue(Text(verbatim: isUnlocked ? "unlocked" : "locked"))
      .accessibilityIdentifier("cap-outline")
    }
  }

  /// The guide's and the live outline's stroke: dashed while locked, solid once unlocked (never colour alone).
  enum CaptureOutlineStroke {
    static func style(width: Double, isUnlocked: Bool) -> StrokeStyle {
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

  /// Where the analysis frame (portrait, `CaptureRules.AnalysisFrame`) lands in a preview that fills its
  /// rect with it, as the camera layer (`resizeAspectFill`) and the debug frames (`scaledToFill`) do.
  nonisolated struct CaptureFrameFill {
    let origin: CGPoint
    let size: CGSize

    init(in rect: CGRect) {
      // The frame is landscape in the registry; the preview shows it portrait.
      let frameWidth = Double(CaptureRules.AnalysisFrame.heightPx)
      let frameHeight = Double(CaptureRules.AnalysisFrame.widthPx)
      let scale = max(rect.width / frameWidth, rect.height / frameHeight)
      size = CGSize(width: frameWidth * scale, height: frameHeight * scale)
      origin = CGPoint(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2)
    }

    /// A normalised frame point (0–1, origin top-left) in the preview.
    func point(x: Double, y: Double) -> CGPoint {
      CGPoint(x: origin.x + x * size.width, y: origin.y + y * size.height)
    }
  }

  /// The live outline's points as one animatable vector (x0, y0, x1, y1, …), so SwiftUI moves each point.
  nonisolated struct CaptureOutlineVector: VectorArithmetic {
    var values: [Double]

    init(_ points: [CaptureOutlinePoint]) {
      values = points.flatMap { [$0.x, $0.y] }
    }

    private init(values: [Double]) {
      self.values = values
    }

    static var zero: Self { Self(values: []) }

    static func + (lhs: Self, rhs: Self) -> Self { combine(lhs, rhs, +) }

    static func - (lhs: Self, rhs: Self) -> Self { combine(lhs, rhs, -) }

    mutating func scale(by rhs: Double) {
      values = values.map { $0 * rhs }
    }

    var magnitudeSquared: Double { values.reduce(0) { $0 + $1 * $1 } }

    /// Element-wise; the shorter vector counts as zeros (`zero` is empty).
    private static func combine(_ lhs: Self, _ rhs: Self, _ operation: (Double, Double) -> Double) -> Self {
      let count = max(lhs.values.count, rhs.values.count)
      return Self(
        values: (0..<count).map { index in
          operation(
            index < lhs.values.count ? lhs.values[index] : 0, index < rhs.values.count ? rhs.values[index] : 0)
        })
    }
  }

  /// The live outline closed through its points, placed where the preview shows the frame.
  nonisolated struct CaptureLiveOutlineShape: Shape {
    var points: CaptureOutlineVector

    var animatableData: CaptureOutlineVector {
      get { points }
      set { points = newValue }
    }

    func path(in rect: CGRect) -> Path {
      let fill = CaptureFrameFill(in: rect)
      let values = points.values
      var path = Path()
      for index in stride(from: 0, to: values.count - 1, by: 2) {
        let point = fill.point(x: values[index], y: values[index + 1])
        if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
      }
      path.closeSubpath()
      return path
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
