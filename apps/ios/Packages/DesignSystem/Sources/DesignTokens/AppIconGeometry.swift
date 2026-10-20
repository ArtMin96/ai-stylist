// The C02 icon maths (contract .impeccable/components/icon.yaml, DESIGN.md "Icons (C02)"): how a generated
// glyph, drawn in its viewBox, scales to a rendered size, and how wide its stroke is there. Hand-written
// beside generated/, not in it (lead decision, 2026-10-21), and UI-free, so it builds and tests on Linux;
// `AppIcon` in DesignSystem replays the result. `package`: visible to DesignSystem and the tests, never to
// the app or the features. `nonisolated`: pure functions over Sendable token values.

/// Scales `AppIcon` glyphs from viewBox units to a rendered size. Every size argument is the final
/// rendered size in points, after Dynamic Type.
nonisolated package enum AppIconGeometry {
  /// Points per viewBox unit at `renderedSize`.
  package static func unitScale(_ renderedSize: Double) -> Double {
    renderedSize / AppIconMetrics.viewBox
  }

  /// The drawn stroke width of `step` at `renderedSize`. The token stroke is in viewBox units, so it
  /// grows with the rendered size and keeps its ratio to it.
  package static func strokeWidth(_ step: AppIconSize, renderedSize: Double) -> Double {
    step.strokeWidth * renderedSize / AppIconMetrics.viewBox
  }

  /// `glyph` with every point coordinate multiplied by `factor`; shapes, paints, commands and their
  /// order are unchanged.
  package static func scaled(_ glyph: AppIconGlyph, by factor: Double) -> AppIconGlyph {
    AppIconGlyph(
      shapes: glyph.shapes.map { shape in
        AppIconShape(
          paint: shape.paint,
          segments: shape.segments.map { segment in
            AppIconSegment(command: segment.command, points: segment.points.map { $0 * factor })
          }
        )
      }
    )
  }
}
