// AppIcon: the C02 icon (contract .impeccable/components/icon.yaml, DESIGN.md "Icons (C02)"). It draws a
// generated glyph at a step of the icon scale, grown with Dynamic Type (owner decision 11, 2026-10-21: like
// the platform's own icons, no cap), in the host's foreground style or a colour role. It is decorative:
// the host control names the action and owns the 44 pt touch target.
import CoreGraphics
public import DesignTokens
public import SwiftUI

/// One C02 glyph at an icon-scale step, scaled with Dynamic Type: xs to lg like body text, xl and hero
/// more gently (`scalingStyle(for:)`).
///
/// The frame is exactly the rendered size, with no padding and no minimum touch target. The icon is
/// hidden from VoiceOver.
public struct AppIcon: View {
  private let name: AppIconName
  private let size: AppIconSize
  private let tint: AppColorRole?

  /// The token size scaled with Dynamic Type by the step's text style; equal to `size.size` at 100 % text
  /// size.
  @ScaledMetric private var renderedSize: Double

  @Environment(\.appTheme) private var theme

  /// - Parameters:
  ///   - name: the glyph.
  ///   - size: the icon-scale step at 100 % text size.
  ///   - tint: a colour role of the current theme; nil draws in the inherited foreground style.
  public init(_ name: AppIconName, size: AppIconSize = AppIconMetrics.defaultSize, tint: AppColorRole? = nil) {
    self.name = name
    self.size = size
    self.tint = tint
    _renderedSize = ScaledMetric(wrappedValue: size.size, relativeTo: Self.scalingStyle(for: size))
  }

  /// The text style a step grows with under Dynamic Type. DESIGN.md "Icons (C02)": icons grow with the
  /// user's text size as the platform's own icons do; the owner decided on 2026-10-21 that on iOS the
  /// large steps grow more gently, like the system's large symbols. `AppButtonFace` sizes its leading
  /// slot (icon or spinner) through this function too, so the two never drift apart. No `default`: a
  /// new step must choose its style.
  package static func scalingStyle(for size: AppIconSize) -> Font.TextStyle {
    switch size {
    case .xs, .sm, .md, .lg: .body
    case .xl: .title2
    case .hero: .largeTitle
    }
  }

  public var body: some View {
    let glyph = AppIconGeometry.scaled(name.glyph, by: AppIconGeometry.unitScale(renderedSize))
    let lineWidth = AppIconGeometry.strokeWidth(size, renderedSize: renderedSize)
    let shading = tint.map { GraphicsContext.Shading.color(theme.color($0)) } ?? .foreground
    Canvas { context, _ in
      Self.draw(glyph, lineWidth: lineWidth, shading: shading, in: &context)
    }
    .frame(width: renderedSize, height: renderedSize)
    .accessibilityHidden(true)
  }

  /// The path of one shape whose points are already in rendered points: its segments replayed in order.
  nonisolated package static func path(for shape: AppIconShape) -> Path {
    var path = Path()
    for segment in shape.segments {
      let points = stride(from: 0, to: segment.points.count - 1, by: 2).map { index in
        CGPoint(x: segment.points[index], y: segment.points[index + 1])
      }
      switch (segment.command, segment.points.count) {
      case (.move, 2):
        path.move(to: points[0])
      case (.line, 2):
        path.addLine(to: points[0])
      case (.cubic, 6):
        // Generated order: control 1, control 2, end (tools/codegen/tokens/README.md "Icon sets").
        path.addCurve(to: points[2], control1: points[0], control2: points[1])
      case (.close, 0):
        path.closeSubpath()
      default:
        // Unreachable for a generated glyph: CC-11 (tools/codegen/tokens/README.md) admits only paths
        // that compile, and the compiler emits one end point per move and line, control 1, control 2
        // and end per cubic, and none for close. Debug builds stop on a broken table; release builds
        // skip the segment rather than crash the screen.
        assertionFailure("AppIcon: malformed \(segment.command) segment with \(segment.points.count) coordinates")
      }
    }
    return path
  }

  /// Paints the shapes in table order: `stroke` with round caps and joins, `fill` with the non-zero rule
  /// (the SVG default; the contract sets none), `both` filled, then stroked (SVG's paint order).
  nonisolated private static func draw(
    _ glyph: AppIconGlyph,
    lineWidth: Double,
    shading: GraphicsContext.Shading,
    in context: inout GraphicsContext
  ) {
    let stroke = StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
    let fill = FillStyle(eoFill: false)
    for shape in glyph.shapes {
      let path = path(for: shape)
      switch shape.paint {
      case .stroke:
        context.stroke(path, with: shading, style: stroke)
      case .fill:
        context.fill(path, with: shading, style: fill)
      case .both:
        context.fill(path, with: shading, style: fill)
        context.stroke(path, with: shading, style: stroke)
      }
    }
  }
}
