// The pixel measurements both observation sources share (capture brief §3): synthetic byte images only,
// no photo.
import AIStylistKernel
import CaptureModel
import Testing

/// A `width × height` image whose pixels inside the pixel rectangle are `inside`, the rest `outside`.
private func image(
  width: Int,
  height: Int,
  rect: (x: Int, y: Int, width: Int, height: Int),
  inside: UInt8 = 255,
  outside: UInt8 = 0
) throws -> CaptureGrayImage {
  var pixels = [UInt8](repeating: outside, count: width * height)
  for y in rect.y..<(rect.y + rect.height) {
    for x in rect.x..<(rect.x + rect.width) {
      pixels[y * width + x] = inside
    }
  }
  return try #require(CaptureGrayImage(width: width, height: height, pixels: pixels))
}

@Suite("Capture image metrics")
struct CaptureImageMetricsTests {
  @Test("a pixel buffer of the wrong size is rejected")
  func rejectsWrongSize() {
    #expect(CaptureGrayImage(width: 4, height: 4, pixels: [0, 1, 2]) == nil)
    #expect(CaptureGrayImage(width: 0, height: 4, pixels: []) == nil)
  }

  @Test("mean luma and clipped share read the whole frame")
  func lightMetrics() throws {
    let half = try image(width: 10, height: 10, rect: (0, 0, 10, 5), inside: 255, outside: 0)
    #expect(CaptureLumaMetrics.meanLuma(of: half) == 127.5)
    #expect(CaptureLumaMetrics.clippedShare(of: half) == 0.5)
  }

  @Test("a flat image has no sharpness; a hard edge inside the box has some")
  func sharpness() throws {
    let flat = try image(width: 320, height: 240, rect: (0, 0, 1, 1), inside: 128, outside: 128)
    let whole = NormalizedRect(x: 0, y: 0, width: 1, height: 1)
    #expect(CaptureLumaMetrics.sharpness(of: flat, inside: whole) == 0)
    let edged = try image(width: 320, height: 240, rect: (100, 60, 120, 120))
    #expect(CaptureLumaMetrics.sharpness(of: edged, inside: whole) > CaptureRules.Steady.minSharpness)
  }

  @Test("an empty mask has no profile")
  func emptyMask() throws {
    let empty = try image(width: 48, height: 64, rect: (0, 0, 0, 0))
    #expect(CaptureMaskProfile(mask: empty) == nil)
  }

  @Test("a centred mask gives its box, its area share and no edge contact")
  func centredMask() throws {
    let mask = try image(width: 100, height: 200, rect: (25, 50, 50, 100))
    let measure = try #require(CaptureMaskProfile(mask: mask)?.measure())
    #expect(measure.box == NormalizedRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5))
    #expect(measure.maskAreaShare == 0.25)
    #expect(measure.edgeContact == EdgeContact())
  }

  @Test("a mask on the left edge touches that edge for its height share")
  func leftEdgeContact() throws {
    let mask = try image(width: 100, height: 200, rect: (0, 50, 40, 100))
    let measure = try #require(CaptureMaskProfile(mask: mask)?.measure())
    #expect(measure.edgeContact == EdgeContact(left: 0.5))
  }

  @Test("an offset moves the box, clips it, and measures the new edge contact")
  func offsetMask() throws {
    let mask = try image(width: 100, height: 200, rect: (10, 50, 50, 100))
    let profile = try #require(CaptureMaskProfile(mask: mask))
    let moved = try #require(profile.measure(offsetX: -20, offsetY: 10))
    #expect(moved.box == NormalizedRect(x: 0, y: 0.3, width: 0.4, height: 0.5))
    #expect(moved.maskAreaShare == 0.2)
    #expect(moved.edgeContact == EdgeContact(left: 0.5))
    #expect(profile.measure(offsetX: 200) == nil)
  }

  @Test("instance labels: largest first, each with its pixel count and box; background and empty labels skipped")
  func instanceLabels() throws {
    var pixels = [UInt8](repeating: 0, count: 100 * 100)
    for y in 10..<70 {
      for x in 10..<70 { pixels[y * 100 + x] = 2 }
    }
    for y in 30..<40 {
      for x in 30..<50 { pixels[y * 100 + x] = 5 }
    }
    let labels = try #require(CaptureGrayImage(width: 100, height: 100, pixels: pixels))
    let instances = CaptureInstanceLabels.instances(in: labels)
    #expect(instances.map(\.label) == [2, 5])
    #expect(instances.map(\.pixelCount) == [3400, 200])
    #expect(instances[0].box == NormalizedRect(x: 0.1, y: 0.1, width: 0.6, height: 0.6))
    #expect(instances[1].box == NormalizedRect(x: 0.3, y: 0.3, width: 0.2, height: 0.1))
    let mask = try #require(CaptureInstanceLabels.mask(of: 5, in: labels))
    #expect(CaptureMaskProfile(mask: mask)?.measure()?.box == instances[1].box)
    #expect(CaptureInstanceLabels.instances(in: try image(width: 4, height: 4, rect: (0, 0, 0, 0))).isEmpty)
  }
}
