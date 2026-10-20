// AppIcon: the C02 icon (contract .impeccable/components/icon.yaml, DESIGN.md "Icons (C02)"). It draws a
// generated glyph at a step of the icon scale, grown with Dynamic Type (owner decision 11, 2026-10-21: like
// the platform's own icons, no cap), in the host's foreground style or a colour role. It is decorative:
// the host control names the action and owns the 44 pt touch target.
import CoreGraphics
public import DesignTokens
public import SwiftUI

/// One C02 glyph at an icon-scale step, scaled with Dynamic Type like body text.
///
/// The frame is exactly the rendered size, with no padding and no minimum touch target. The icon is
/// hidden from VoiceOver.
public struct AppIcon: View {
  private let name: AppIconName
  private let size: AppIconSize
  private let tint: AppColorRole?

  /// The token size scaled with Dynamic Type; equal to `size.size` at 100 % text size.
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
    _renderedSize = ScaledMetric(wrappedValue: size.size, relativeTo: .body)
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
      switch segment.command {
      case .move:
        if let end = points.first {
          path.move(to: end)
        }
      case .line:
        if let end = points.first {
          path.addLine(to: end)
        }
      case .cubic:
        // Generated order: control 1, control 2, end (tools/codegen/tokens/README.md "Icon sets").
        if points.count == 3 {
          path.addCurve(to: points[2], control1: points[0], control2: points[1])
        }
      case .close:
        path.closeSubpath()
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
