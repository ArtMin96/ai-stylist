// AppIconGeometry without rendering (contract .impeccable/components/icon.yaml): glyph scaling, the
// stroke maths of the icon scale, and that every generated glyph replays at every step and text size.
import DesignTokens
import Testing

private let tolerance = 1e-9

private func isClose(_ actual: Double, _ expected: Double) -> Bool {
  abs(actual - expected) < tolerance
}

/// The number of coordinates each command carries: one x, y pair for move and line, three for cubic.
private func coordinateCount(_ command: AppIconCommand) -> Int {
  switch command {
  case .move, .line: 2
  case .cubic: 6
  case .close: 0
  }
}

@Test("scaling multiplies every point and keeps shapes, paints and commands")
func scalingTheTodayGlyph() throws {
  let original = AppIconGlyphs.Today.glyph
  let scaled = AppIconGeometry.scaled(original, by: AppIconGeometry.unitScale(AppIconSize.xs.size))

  let firstCubic = try #require(scaled.shapes.flatMap(\.segments).first { $0.command == .cubic })
  let expected = [9.5785, 2.5, 10.25, 3.1715, 10.25, 4.0]
  #expect(firstCubic.points.count == expected.count)
  #expect(zip(firstCubic.points, expected).allSatisfy(isClose))

  #expect(scaled.shapes.count == original.shapes.count)
  #expect(scaled.shapes.map(\.paint) == original.shapes.map(\.paint))
  #expect(scaled.shapes.map { $0.segments.map(\.command) } == original.shapes.map { $0.segments.map(\.command) })
}

@Test(
  "at 100 % text size the drawn stroke is the token stroke times size over the viewBox",
  arguments: AppIconSize.allCases
)
func strokeAtTokenSize(step: AppIconSize) {
  let drawn = AppIconGeometry.strokeWidth(step, renderedSize: step.size)
  #expect(isClose(drawn, step.strokeWidth * step.size / AppIconMetrics.viewBox))
}

@Test("stroke spot values, and the stroke grows with a larger text size")
func strokeSpotValues() {
  #expect(isClose(AppIconGeometry.strokeWidth(.lg, renderedSize: AppIconSize.lg.size), 1.7))
  #expect(isClose(AppIconGeometry.strokeWidth(.md, renderedSize: AppIconSize.md.size), 1.7 * 20 / 24))
  #expect(isClose(AppIconGeometry.strokeWidth(.xs, renderedSize: AppIconSize.xs.size), 1.1))
  #expect(isClose(AppIconGeometry.strokeWidth(.lg, renderedSize: 36), 2.55))
}

@Test("every glyph replays at every step, at 100 % and 200 % text size", arguments: AppIconName.allCases)
func everyGlyphBuilds(name: AppIconName) {
  let glyph = name.glyph
  for step in AppIconSize.allCases {
    for rendered in [step.size, step.size * 2] {
      let scaled = AppIconGeometry.scaled(glyph, by: AppIconGeometry.unitScale(rendered))
      #expect(scaled.shapes.count == glyph.shapes.count, "\(name) \(step) \(rendered)")
      for shape in scaled.shapes {
        #expect(shape.segments.first?.command == .move, "\(name) \(step) \(rendered)")
        for segment in shape.segments {
          #expect(segment.points.count == coordinateCount(segment.command), "\(name) \(step) \(rendered)")
          #expect(
            segment.points.allSatisfy { $0.isFinite && (0...rendered).contains($0) },
            "\(name) \(step) \(rendered)"
          )
        }
      }
    }
  }
}
