// Shared look of the capture screens. Colours, type, spacing and radii come from the generated tokens
// (`\.appTheme`, `AppSpacing`, `AppRadius`, the component tokens). The camera parts the surface brief
// `.impeccable/surfaces/sc16-capture-camera.md` lists under "Proposed values" are not in DESIGN.md yet, so
// `CaptureMetrics` holds their measured canvas values, each named after its proposed token, until
// ui-designer lands them in DESIGN.md and `just generate` emits them; then this enum goes.
#if os(iOS)
  import DesignSystem
  import DesignTokens
  import SwiftUI

  /// The surface brief's measured values for the proposed capture tokens (pt).
  enum CaptureMetrics {
    // capture-guide: strokeWidth 2 (camera-paper) over haloWidth 4 (camera-ink), dash 6 / 6.
    static let guideStroke = 2.0
    static let guideHalo = AppSpacing.space4
    static let guideDash = 6.0
    // Guide box inside the preview: top 68, sides 32, bottom 104.
    static let guideInsetTop = 68.0
    static let guideInsetSide = AppSpacing.space32
    static let guideInsetBottom = 104.0
    // capture-shutter: size 76, ringWidth 4 (centre line r 36), disc 60, discCapturing 52.
    static let shutterSize = 76.0
    static let shutterRing = AppSpacing.space4
    static let shutterDisc = 60.0
    static let shutterDiscCapturing = 52.0
    // capture-hint-card: padding 10 14, radius 16, gap 10, left/right 16, bottom 18.
    static let hintPaddingVertical = 10.0
    static let hintPaddingHorizontal = 14.0
    static let hintGap = 10.0
    static let hintBottom = 18.0
    static let hintMaxLines = 3
    // capture-step-pill: height 32, padding 0 14, top 18.
    static let pillHeight = 32.0
    static let pillPaddingHorizontal = 14.0
    static let pillTop = 18.0
    // camera-icon-button: the 52 import circle on camera-track.
    static let importButtonSize = 52.0
    // camera-upload-badge (batch count chip): 36, 1.5 ring, padding 0 14.
    static let countChipHeight = 36.0
    static let countChipRing = 1.5
    static let countChipPaddingHorizontal = 14.0
    // Anyway slot: 70 high, reserved so the layout never jumps.
    static let anywaySlotHeight = 70.0
    // Camera chrome: padding 18 20 30, column gap 14; top bar 44; bottom row 76; preview radius 24.
    static let chromeTop = 18.0
    static let chromeBottom = 30.0
    static let chromeGap = 14.0
    static let bottomRowHeight = 76.0
    // C05 camera mode switch: track padding 4, segment gap 2.
    static let modeSwitchTrackPadding = AppSpacing.space4
    static let modeSwitchGap = 2.0
    // Picker grid (SC16): tiles in 3 columns, row gap 12, column gap 10.
    static let pickerColumnGap = 10.0
    // Review photo (SC19): one photo 350 high; front and back side by side 220 high.
    static let reviewPhotoHeight = 350.0
    static let reviewPairPhotoHeight = 220.0
    // Sheet actions: stacked 52 buttons, gap 10 (C09).
    static let sheetActionGap = 10.0
    /// Every control's minimum touch target (DESIGN.md "Touch targets").
    static let minTouchTarget = 44.0
  }

  /// The component tokens of the current context (light, dark, high contrast).
  struct CaptureTokens {
    let theme: AppTheme

    var isDark: Bool { theme == .dark || theme == .highContrastDark }

    var modeSwitch: CameraModeSwitchTokens {
      switch theme {
      case .dark: .dark
      case .highContrastLight: .hcLight
      case .highContrastDark: .hcDark
      default: .light
      }
    }

    var modeSelected: CameraModeSelectedTokens {
      switch theme {
      case .dark: .dark
      case .highContrastLight: .hcLight
      case .highContrastDark: .hcDark
      default: .light
      }
    }

    var sheet: SheetTokens {
      switch theme {
      case .dark: .dark
      case .highContrastLight: .hcLight
      case .highContrastDark: .hcDark
      default: .light
      }
    }

    var stateCard: StateCardTokens {
      switch theme {
      case .dark: .dark
      case .highContrastLight: .hcLight
      case .highContrastDark: .hcDark
      default: .light
      }
    }

    var tile: TileItemTokens {
      switch theme {
      case .dark: .dark
      case .highContrastLight: .hcLight
      case .highContrastDark: .hcDark
      default: .light
      }
    }

    /// The camera accent: camera-paper in light, camera-yellow in dark (the count chip, C05 selected).
    var cameraAccent: AppColorRole { isDark ? .cameraYellow : .cameraPaper }

    /// The snackbar shadow colour (the hint card's elevation).
    var snackbarShadowColor: Color {
      Color(argb: isDark ? AppElevation.SnackbarDark.color : AppElevation.SnackbarLight.color)
    }

    /// The snackbar shadow blur radius; SwiftUI's radius is half the CSS blur.
    var snackbarShadowRadius: Double {
      (isDark ? AppElevation.SnackbarDark.blur : AppElevation.SnackbarLight.blur) / 2
    }

    /// The snackbar shadow's vertical offset.
    var snackbarShadowY: Double {
      isDark ? AppElevation.SnackbarDark.offsetY : AppElevation.SnackbarLight.offsetY
    }
  }

  extension Color {
    /// A generated ARGB token value (alpha in the top byte), e.g. an elevation shadow colour.
    init(argb: UInt32) {
      self.init(
        .sRGB,
        red: Double((argb >> 16) & 0xFF) / 255,
        green: Double((argb >> 8) & 0xFF) / 255,
        blue: Double(argb & 0xFF) / 255,
        opacity: Double((argb >> 24) & 0xFF) / 255
      )
    }
  }

  /// The proposed C02 glyphs "speaker" and "speaker-off" (surface brief sc16, C11 proposed), drawn on the
  /// 24 grid with the icon set's stroke rule (1.7 grid units, round caps and joins) until the icon set
  /// gains them.
  /// `nonisolated`: `Shape.path(in:)` is nonisolated; the glyph is a pure value.
  nonisolated struct CaptureSpeakerGlyph: Shape {
    let isOn: Bool

    func path(in rect: CGRect) -> Path {
      let unit = min(rect.width, rect.height) / 24
      func point(_ x: Double, _ y: Double) -> CGPoint {
        CGPoint(x: rect.minX + x * unit, y: rect.minY + y * unit)
      }
      var path = Path()
      path.move(to: point(4, 9.5))
      path.addLine(to: point(7.5, 9.5))
      path.addLine(to: point(12, 5.5))
      path.addLine(to: point(12, 18.5))
      path.addLine(to: point(7.5, 14.5))
      path.addLine(to: point(4, 14.5))
      path.closeSubpath()
      if isOn {
        path.move(to: point(15.5, 9))
        path.addQuadCurve(to: point(15.5, 15), control: point(17.5, 12))
        path.move(to: point(18, 6.5))
        path.addQuadCurve(to: point(18, 17.5), control: point(22, 12))
      } else {
        path.move(to: point(16, 9.5))
        path.addLine(to: point(21, 14.5))
        path.move(to: point(21, 9.5))
        path.addLine(to: point(16, 14.5))
      }
      return path
    }
  }

  /// A 44 pt round icon button on the camera ground (close, help, torch, speech, more): ghost, icon lg in
  /// camera-paper, pressed camera-track.
  struct CaptureIconButton<Glyph: View>: View {
    let label: String
    let action: () -> Void
    @ViewBuilder let glyph: () -> Glyph
    @Environment(\.appTheme) private var theme

    var body: some View {
      Button(action: action) {
        glyph()
          .foregroundStyle(theme.color(.cameraPaper))
          .frame(width: CaptureMetrics.minTouchTarget, height: CaptureMetrics.minTouchTarget)
          .contentShape(Circle())
      }
      .buttonStyle(CapturePressStyle(shape: Circle(), pressedFill: theme.color(.cameraTrack)))
      .accessibilityLabel(label)
    }
  }

  /// Fills `shape` while pressed (motion.press, reduced motion: no animation).
  struct CapturePressStyle<S: Shape>: ButtonStyle {
    let shape: S
    let pressedFill: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
      configuration.label
        .background(shape.fill(configuration.isPressed ? pressedFill : Color.clear))
        .animation(
          reduceMotion ? nil : .linear(duration: AppMotion.Press.duration / 1000),
          value: configuration.isPressed
        )
    }
  }

  /// The C09 full-screen modal header (56): close 44 left, Headline title centred.
  struct CaptureModalHeader: View {
    let title: String
    let closeID: String
    let onClose: () -> Void
    @Environment(\.appTheme) private var theme

    var body: some View {
      ZStack {
        Text(title)
          .font(theme.font(TopBarModalTokens.light.typography))
          .foregroundStyle(theme.color(.text))
          .multilineTextAlignment(.center)
          .padding(.horizontal, CaptureMetrics.minTouchTarget + AppSpacing.space8)
          .accessibilityAddTraits(.isHeader)
        HStack {
          Button(action: onClose) {
            AppIcon(.close, size: .lg)
              .frame(width: CaptureMetrics.minTouchTarget, height: CaptureMetrics.minTouchTarget)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .foregroundStyle(theme.color(.text))
          .accessibilityLabel(CaptureText.localized("capture.a11y.close"))
          .accessibilityIdentifier(closeID)
          Spacer()
        }
      }
      .frame(minHeight: TopBarModalTokens.light.height)
      .padding(.horizontal, AppSpacing.space8)
      .overlay(alignment: .bottom) {
        Rectangle().fill(theme.color(.divider)).frame(height: 1)
      }
    }
  }
#endif
