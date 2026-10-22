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

  @Test("every spec number equals the fixture's params")
  func paramsMatch() {
    let expected = OutlineParityFixture.Params(
      maskIntervalMs: CaptureRules.Ios.maskIntervalMs,
      cropGrowDivisor: CaptureOutlineSpec.cropGrowDivisor,
      cropGrowMinPx: CaptureOutlineSpec.cropGrowMinPx,
      longSidePx: CaptureOutlineSpec.longSidePx,
      foregroundAtLeast: CaptureOutlineSpec.foregroundAtLeast,
      epsilonPx: CaptureOutlineSpec.epsilonPx,
      pointCount: CaptureOutlineSpec.pointCount,
      keepAtLeastIou: CaptureOutlineSpec.keepAtLeastIou,
      switchAtAreaRatio: CaptureOutlineSpec.switchAtAreaRatio,
      snapBelowIou: CaptureOutlineSpec.snapBelowIou,
      emaAlpha: CaptureOutlineSpec.emaAlpha,
      clearAfterMissedUpdates: CaptureOutlineSpec.clearAfterMissedUpdates,
      iouGridCells: CaptureOutlineSpec.iouGridCells
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

  @Test("polygon IoU matches the reference")
  func intersectionOverUnion() {
    for testCase in fixture.iou {
      let value = CaptureOutlineGeometry.intersectionOverUnion(outlinePoints(testCase.a), outlinePoints(testCase.b))
      #expect(abs(value - testCase.expected) <= 1e-6, "\(testCase.name): \(value)")
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
