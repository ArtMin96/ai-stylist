// AppIcon without rendering (contract .impeccable/components/icon.yaml): the Dynamic Type text style of
// each step, and the path replay (the SwiftUI path of a scaled shape has the same elements and points as
// its segments, in order).
import CoreGraphics
import DesignSystem
import DesignTokens
import SwiftUI
import Testing

/// One replayed path element as a generated command and its coordinates.
private typealias Replayed = (command: AppIconCommand, points: [Double])

private func coordinates(_ points: CGPoint...) -> [Double] {
  points.flatMap { [Double($0.x), Double($0.y)] }
}

private func replayed(_ path: Path) -> [Replayed] {
  var elements: [Replayed] = []
  func record(_ element: Path.Element) {
    switch element {
    case .move(let end): elements.append((.move, coordinates(end)))
    case .line(let end): elements.append((.line, coordinates(end)))
    case .curve(let end, let control1, let control2): elements.append((.cubic, coordinates(control1, control2, end)))
    case .closeSubpath: elements.append((.close, []))
    case .quadCurve: Issue.record("the replay never draws a quadratic curve")
    }
  }
  path.forEach(record)
  return elements
}

@Test("xs to lg grow with body text, xl with title 2 and hero with large title (owner, 2026-10-21)")
func eachStepGrowsWithItsTextStyle() {
  let expected: [AppIconSize: Font.TextStyle] = [
    .xs: .body, .sm: .body, .md: .body, .lg: .body, .xl: .title2, .hero: .largeTitle,
  ]
  let styles = Dictionary(uniqueKeysWithValues: AppIconSize.allCases.map { ($0, AppIcon.scalingStyle(for: $0)) })
  #expect(styles == expected)
}

@Test("the replayed path of every shape has the scaled segments' commands and points, in order")
func replayMatchesScaledSegments() {
  let rendered = AppIconSize.xl.size
  let glyph = AppIconGeometry.scaled(AppIconName.today.glyph, by: AppIconGeometry.unitScale(rendered))
  for shape in glyph.shapes {
    let elements = replayed(AppIcon.path(for: shape))
    #expect(elements.map { $0.command } == shape.segments.map(\.command))
    // Path keeps its points as Float on the iOS 26 SDK (Xcode 27.1), so both sides compare at that
    // precision: each replayed point must be exactly the Float rounding of its segment point.
    #expect(elements.map { $0.points.map(Float.init) } == shape.segments.map { $0.points.map(Float.init) })
  }
}
