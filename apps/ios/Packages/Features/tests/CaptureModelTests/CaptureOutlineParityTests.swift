// The live outline against the shared parity fixture (`tools/capture-frames/parity/outline-parity.json`),
// which the Android tests read too. Always runs, Linux included: the fixture is committed.
import AIStylistKernel
import CaptureModel
import Foundation
import Testing

@Suite("Live outline: parity fixture")
struct CaptureOutlineParityTests {
  private let fixture: OutlineParityFixture

  init() throws {
    fixture = try OutlineParityFixture.load()
  }

  @Test("the generated mask cadence and outline numbers equal the fixture's params")
  func paramsMatch() {
    let expected = OutlineParityFixture.Params(
      maskIntervalMs: CaptureRules.Mask.intervalMs,
      cropGrowDivisor: CaptureRules.Outline.cropGrowDivisor,
      cropGrowMinPx: CaptureRules.Outline.cropGrowMinPx,
      longSidePx: CaptureRules.Outline.longSidePx,
      foregroundAtLeast: CaptureRules.Outline.foregroundAtLeast,
      epsilonPx: CaptureRules.Outline.epsilonPx,
      pointCount: CaptureRules.Outline.pointCount,
      keepAtLeastIou: CaptureRules.Outline.keepAtLeastIou,
      switchAtAreaRatio: CaptureRules.Outline.switchAtAreaRatio,
      snapBelowIou: CaptureRules.Outline.snapBelowIou,
      snapKeepsShapeAtLeastIou: CaptureRules.Outline.snapKeepsShapeAtLeastIou,
      emaAlpha: CaptureRules.Outline.emaAlpha,
      clearAfterMissedUpdates: CaptureRules.Outline.clearAfterMissedUpdates,
      iouGridCells: CaptureRules.Outline.iouGridCells
    )
    #expect(fixture.params == expected)
    #expect(fixture.tolerance <= 0.005)
  }

  @Test("each mask's outline matches the reference within the tolerance")
  func contours() throws {
    #expect(fixture.contour.count >= 10)
    for testCase in fixture.contour {
      let mask = try #require(testCase.mask, "\(testCase.name): unreadable rows")
      #expect(mask.width == testCase.width && mask.height == testCase.height, "\(testCase.name)")
      let traced = CaptureOutlineContour.trace(mask)
      guard let expected = testCase.expected else {
        #expect(traced == nil, "\(testCase.name): expected no outline")
        continue
      }
      let outline = try #require(traced, "\(testCase.name): no outline")
      #expect(outline.simplifiedVertexCount == testCase.simplifiedVertexCount, "\(testCase.name)")
      let difference = maxPointDifference(outline.points, outlinePoints(expected))
      #expect(difference <= fixture.tolerance, "\(testCase.name): max difference \(difference)")
    }
  }

  @Test("the static IoU reads the filled outer boundary, not the raw mask, as the reference does")
  func staticIouReference() throws {
    let cases = fixture.contour.filter { $0.staticIouFilled != nil }
    #expect(cases.contains { ($0.staticIouRaw ?? 1) < ($0.staticIouFilled ?? 0) - 0.05 })
    for testCase in cases {
      let mask = try #require(testCase.mask)
      let outline = try #require(CaptureOutlineContour.outline(of: mask))
      let drawn = CaptureOutlineGeometry.rasterise(outline, width: mask.width, height: mask.height)
      let filled = CaptureModelTests.intersectionOverUnion(drawn, filledLargestComponent(mask))
      let raw = CaptureOutlineGeometry.intersectionOverUnion(outline, mask: mask)
      #expect(abs(filled - (testCase.staticIouFilled ?? .nan)) <= 1e-6, "\(testCase.name): filled \(filled)")
      #expect(abs(raw - (testCase.staticIouRaw ?? .nan)) <= 1e-6, "\(testCase.name): raw \(raw)")
    }
  }

  @Test("polygon IoU matches the reference")
  func intersectionOverUnion() {
    for testCase in fixture.iou {
      let value = CaptureOutlineGeometry.intersectionOverUnion(outlinePoints(testCase.a), outlinePoints(testCase.b))
      #expect(abs(value - testCase.expected) <= 1e-6, "\(testCase.name): \(value)")
    }
  }

  // Regression (capture-sim run 2026-10-22-1502): a jittered item only moves, yet successive drawn outlines
  // changed shape (centroid-aligned IoU 0.93) because a move past the snap limit replaced the blended
  // outline with the raw one, whose shape the crop grid changes with every position.
  @Test("a purely translated item keeps its drawn shape: centroid-aligned IoU of successive outlines ≥ 0.95")
  func translationKeepsShape() throws {
    let testCase = try #require(fixture.temporal.first { $0.name == "translation-jitter" })
    var outline = CaptureLiveOutline()
    var previous: [CaptureOutlinePoint]?
    for (number, step) in testCase.steps.enumerated() {
      let candidates = step.candidates.map {
        CaptureOutlineCandidate(areaShare: $0.areaShare, points: outlinePoints($0.points))
      }
      outline.observe(maskTimestampMs: number * fixture.params.maskIntervalMs, candidates: candidates)
      let drawn = try #require(outline.state?.points)
      if let previous {
        let stability = CaptureOutlineGeometry.intersectionOverUnion(
          CaptureOutlineGeometry.centred(drawn), CaptureOutlineGeometry.centred(previous))
        #expect(stability >= 0.95, "step \(number): \(stability)")
      }
      previous = drawn
    }
  }

  // Owner 2026-10-22: the stability measure centres on the area centroid. The vertex mean drifts with the
  // edge's jaggies on an unchanged shape (these raw outlines read 0.932 centred on it).
  @Test("the raw outlines of an unchanged real mask, translated by its stored offsets, keep centred IoU ≥ 0.95")
  func stabilityCentresOnAreaCentroid() throws {
    let testCase = try #require(fixture.temporal.first { $0.name == "translation-jitter" })
    let raw = try testCase.steps.map { try outlinePoints(#require($0.candidates.first).points) }
    #expect(raw.count >= 3)
    for (number, pair) in zip(raw.dropFirst(), raw).enumerated() {
      let stability = CaptureOutlineGeometry.intersectionOverUnion(
        CaptureOutlineGeometry.centred(pair.0), CaptureOutlineGeometry.centred(pair.1))
      #expect(stability >= 0.95, "step \(number + 1): \(stability)")
    }
  }

  @Test("the tracker draws what the reference draws after every mask update")
  func temporal() {
    #expect(!fixture.temporal.isEmpty)
    for testCase in fixture.temporal {
      var outline = CaptureLiveOutline()
      for (number, step) in testCase.steps.enumerated() {
        let candidates = step.candidates.map {
          CaptureOutlineCandidate(areaShare: $0.areaShare, points: outlinePoints($0.points))
        }
        outline.observe(maskTimestampMs: number * fixture.params.maskIntervalMs, candidates: candidates)
        let label = "\(testCase.name) step \(number)"
        guard let expected = step.expected else {
          #expect(outline.state == nil, "\(label): expected no outline")
          continue
        }
        let drawn = outline.state?.points ?? []
        let difference = maxPointDifference(drawn, outlinePoints(expected))
        #expect(difference <= fixture.tolerance, "\(label): max difference \(difference)")
      }
    }
  }
}

@Suite("Live outline: tracker")
struct CaptureLiveOutlineTests {
  private let square = outlinePoints([[0.2, 0.2], [0.6, 0.2], [0.6, 0.6], [0.2, 0.6]])
  private let farSquare = outlinePoints([[0.7, 0.7], [0.9, 0.7], [0.9, 0.9], [0.7, 0.9]])

  @Test("a reused mask changes nothing; a new one updates")
  func oneUpdatePerMask() {
    var outline = CaptureLiveOutline()
    outline.observe(maskTimestampMs: 0, candidates: [CaptureOutlineCandidate(areaShare: 0.16, points: square)])
    let first = outline.state
    outline.observe(maskTimestampMs: 0, candidates: [CaptureOutlineCandidate(areaShare: 0.04, points: farSquare)])
    #expect(outline.state == first)
    outline.observe(maskTimestampMs: 250, candidates: [CaptureOutlineCandidate(areaShare: 0.04, points: farSquare)])
    #expect(outline.state?.points == farSquare)
    #expect(outline.state?.snapCount == 2)
  }

  @Test("empty updates clear the outline only after the third one in a row")
  func clearsAfterThreeMissedMasks() {
    var outline = CaptureLiveOutline()
    let item = [CaptureOutlineCandidate(areaShare: 0.16, points: square)]
    outline.observe(maskTimestampMs: 0, candidates: item)
    outline.observe(maskTimestampMs: 250, candidates: [])
    outline.observe(maskTimestampMs: 500, candidates: [])
    outline.observe(maskTimestampMs: 500, candidates: [])  // the same mask again does not count…
    #expect(outline.state != nil)
    outline.observe(maskTimestampMs: 750, candidates: item)  // …and an item resets the count
    for time in [1000, 1250] { outline.observe(maskTimestampMs: time, candidates: []) }
    #expect(outline.state != nil)
    outline.observe(maskTimestampMs: 1500, candidates: [])
    #expect(outline.state == nil)
  }

  @Test("reset forgets the outline and the last mask")
  func reset() {
    var outline = CaptureLiveOutline()
    let item = [CaptureOutlineCandidate(areaShare: 0.16, points: square)]
    outline.observe(maskTimestampMs: 0, candidates: item)
    outline.reset()
    #expect(outline.state == nil)
    outline.observe(maskTimestampMs: 0, candidates: item)
    #expect(outline.state?.points == square)
  }
}

@Suite("Live outline: label images")
struct CaptureOutlineLabelTests {
  /// Two drawn instances: label 1 a 30 × 20 block, label 2 a 12 × 12 block.
  private let labels: CaptureGrayImage? = {
    let width = 60
    let height = 40
    var pixels = [UInt8](repeating: 0, count: width * height)
    for y in 5..<25 { for x in 4..<34 { pixels[y * width + x] = 1 } }
    for y in 20..<32 { for x in 40..<52 { pixels[y * width + x] = 2 } }
    return CaptureGrayImage(width: width, height: height, pixels: pixels)
  }()

  @Test("an instance traced in its label image equals its own mask traced alone")
  func instanceMatchesItsMask() throws {
    let labels = try #require(labels)
    for instance in CaptureInstanceLabels.instances(in: labels) {
      let mask = try #require(CaptureInstanceLabels.mask(of: instance.label, in: labels))
      #expect(CaptureOutlineContour.outline(of: instance, in: labels) == CaptureOutlineContour.outline(of: mask))
    }
  }

  @Test("a mask's outlines list its items largest first")
  func candidatesLargestFirst() throws {
    let labels = try #require(labels)
    let outlines = CaptureMaskOutlines(
      maskTimestampMs: 0, labels: labels, instances: CaptureInstanceLabels.instances(in: labels))
    #expect(outlines.candidates.map(\.areaShare) == [600.0 / 2400, 144.0 / 2400])
  }

  @Test("shifting moves pixels by whole steps and drops what leaves the frame")
  func shifted() throws {
    let labels = try #require(labels)
    let moved = labels.shifted(byX: 10, y: -5)
    #expect(moved.pixels[0 * 60 + 14] == 1)  // was (4, 5)
    #expect(moved.pixels[15 * 60 + 50] == 2)  // was (40, 20)
    #expect(CaptureInstanceLabels.instances(in: moved).first { $0.label == 2 }?.pixelCount == 10 * 12)
  }
}
