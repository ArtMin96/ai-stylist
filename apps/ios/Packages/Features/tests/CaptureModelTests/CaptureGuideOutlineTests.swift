// The guide outlines of board C11 (surface brief sc16): one per shape family and mode, the back step
// reusing the front outline, the shoes' pair outline, and every path drawn inside the preview.
import AIStylistKernel
import CaptureModel
import Testing

/// Every guide a camera screen can show: each family's offered modes (front and back), and the shoes'
/// pair step instead of a back step.
private var allGuides: [CaptureGuide] {
  CaptureShapeFamily.allCases.flatMap { family in
    family.modes.flatMap { mode in
      [
        CaptureGuide(family: family, mode: mode, side: .front),
        CaptureGuide(family: family, mode: mode, side: family == .shoes ? .pair : .back),
      ]
    }
  }
}

private func bounds(_ outline: CaptureGuideOutline) -> (minX: Double, maxX: Double, minY: Double, maxY: Double) {
  let xs = outline.points.map(\.x)
  let ys = outline.points.map(\.y)
  return (xs.min() ?? 0, xs.max() ?? 0, ys.min() ?? 0, ys.max() ?? 0)
}

@Suite("Capture guide outline")
struct CaptureGuideOutlineTests {
  @Test("every guide has an outline inside the preview")
  func everyGuideDrawsInsideThePreview() {
    for guide in allGuides {
      let outline = CaptureGuideOutline(guide: guide)
      #expect(!outline.segments.isEmpty, "no outline for \(guide.testID)")
      let box = bounds(outline)
      #expect(box.minX >= 0 && box.maxX <= CaptureGuideOutline.canvasWidth, "\(guide.testID) leaves the preview")
      #expect(box.minY >= 0 && box.maxY <= CaptureGuideOutline.canvasHeight, "\(guide.testID) leaves the preview")
    }
  }

  @Test("each family has its own flat outline")
  func flatOutlinesDiffer() {
    let outlines = CaptureShapeFamily.allCases.map {
      CaptureGuideOutline(guide: CaptureGuide(family: $0, mode: .flat, side: .front))
    }
    #expect(Set(outlines).count == CaptureShapeFamily.allCases.count)
  }

  @Test("each mode of a family has its own outline")
  func modesDiffer() {
    for family in CaptureShapeFamily.allCases where family.modes.count > 1 {
      let outlines = family.modes.map {
        CaptureGuideOutline(guide: CaptureGuide(family: family, mode: $0, side: .front))
      }
      #expect(Set(outlines).count == family.modes.count, "\(family.rawValue) modes share an outline")
    }
  }

  @Test("the back step reuses the front outline")
  func backReusesFront() {
    for guide in allGuides where guide.side == .back {
      let front = CaptureGuide(family: guide.family, mode: guide.mode, side: .front)
      #expect(CaptureGuideOutline(guide: guide) == CaptureGuideOutline(guide: front))
    }
  }

  @Test("the shoes' pair step draws two shoes, one above the other")
  func pairDrawsTwoShoes() {
    let pair = CaptureGuideOutline(guide: CaptureGuide(family: .shoes, mode: .flat, side: .pair))
    let one = CaptureGuideOutline(guide: CaptureGuide(family: .shoes, mode: .flat, side: .front))
    let moves = pair.segments.filter { if case .move = $0 { true } else { false } }
    #expect(moves.count == 2)
    #expect(pair != one)
  }

  @Test("generic worn reuses the outerwear worn crop")
  func genericWornIsOuterwearWorn() {
    let generic = CaptureGuideOutline(guide: CaptureGuide(family: .generic, mode: .worn, side: .front))
    let outerwear = CaptureGuideOutline(guide: CaptureGuide(family: .outerwear, mode: .worn, side: .front))
    #expect(generic == outerwear)
  }

  @Test("the worn head arcs make a closed circle of the drawn radius")
  func headArcIsACircle() {
    // top worn starts with two half arcs of radius 28 around (175, 112).
    let outline = CaptureGuideOutline(guide: CaptureGuide(family: .top, mode: .worn, side: .front))
    let head = outline.segments.prefix { $0 != .close }
    guard case .move(let start) = head.first, case .cubic(_, _, let end) = head.last else {
      Issue.record("the head does not start with a move and end with a curve")
      return
    }
    #expect(start == end)
    let ends = head.compactMap { segment -> CaptureOutlinePoint? in
      if case .cubic(_, _, let point) = segment { point } else { nil }
    }
    for point in ends {
      let distance = ((point.x - 175) * (point.x - 175) + (point.y - 112) * (point.y - 112)).squareRoot()
      #expect(abs(distance - 28) < 0.001)
    }
    #expect(ends.contains { abs($0.y - 84) < 0.001 }, "the head's top point is missing")
  }

  @Test("the hanger hook curls over the top, right of its stem")
  func hookCurlsOverTheTop() {
    // hook(84): stem 175,84 → 175,72, then a radius-9 arc to 184,63 around (175, 63) the long way.
    let points = CaptureGuideOutline(guide: CaptureGuide(family: .top, mode: .hanger, side: .front)).points
    #expect(points.first == CaptureOutlinePoint(x: 175, y: 84))
    // The long way round passes the circle's left (166, 63) and top (175, 54).
    #expect(points.contains { abs($0.x - 166) < 0.001 && abs($0.y - 63) < 0.001 })
    #expect(points.contains { abs($0.x - 175) < 0.001 && abs($0.y - 54) < 0.001 })
  }
}
