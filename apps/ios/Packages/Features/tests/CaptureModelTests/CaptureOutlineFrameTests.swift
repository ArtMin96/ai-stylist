// The live outline on the stored masks of `just capture-frames` (capture brief "Live outline", tests).
// Thresholds come from the feasibility spike's `stability.py` runs; never loosen them. The frames are
// generated, not committed (artifacts/ is gitignored), and tracing about 2000 full-size masks takes
// minutes in a debug build, so these tests run only when `CAPTURE_FRAMES_DIR` names a frames folder:
//   CAPTURE_FRAMES_DIR=$PWD/artifacts/capture-camera/frames just ios-test-packages features
// Otherwise (and on Linux) they skip with a message.
#if canImport(ImageIO)
  import AIStylistKernel
  import CaptureModel
  import CoreGraphics
  import Foundation
  import ImageIO
  import Testing

  nonisolated private let framesDirectory: URL? = ProcessInfo.processInfo.environment["CAPTURE_FRAMES_DIR"]
    .flatMap { $0.isEmpty ? nil : URL(filePath: $0, directoryHint: .isDirectory) }

  nonisolated private let hasFrames =
    framesDirectory.map {
      FileManager.default.fileExists(atPath: $0.appending(path: "index.json").path(percentEncoded: false))
    } ?? false

  /// The parts of `index.json` these tests read.
  nonisolated private struct FrameIndex: Decodable, Sendable {
    struct Segment: Decodable, Sendable {
      let mask: String?
      let instances: String?
      let offsets: [[Double]]?
    }

    struct FrameSet: Decodable, Sendable {
      let id: String
      let mode: String
      let kind: String
      let variant: String?
      let segments: [Segment]
    }

    let sets: [FrameSet]

    static func load() throws -> FrameIndex {
      let directory = try framesFolder()
      return try JSONDecoder().decode(FrameIndex.self, from: Data(contentsOf: directory.appending(path: "index.json")))
    }

    /// Flat single-item sets with a stored mask, optionally of one variant.
    func flatSingles(variant: String? = nil) -> [(id: String, segment: Segment)] {
      sets.compactMap { set in
        guard set.kind == "single", set.mode == "flat", let segment = set.segments.first, segment.mask != nil,
          segment.instances == nil, variant.map({ $0 == set.variant }) ?? true
        else { return nil }
        return (set.id, segment)
      }
    }
  }

  nonisolated private struct FrameError: Error {
    let reason: String
  }

  nonisolated private func framesFolder() throws -> URL {
    guard let framesDirectory else { throw FrameError(reason: "CAPTURE_FRAMES_DIR is not set") }
    return framesDirectory
  }

  /// An 8-bit grey PNG as a mask or label image.
  nonisolated private func loadGray(_ relativePath: String) throws -> CaptureGrayImage {
    let url = try framesFolder().appending(path: relativePath)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else { throw FrameError(reason: "unreadable \(relativePath)") }
    let width = image.width
    let height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height)
    let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard
        let context = CGContext(
          data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width,
          space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)
      else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn, let gray = CaptureGrayImage(width: width, height: height, pixels: pixels) else {
      throw FrameError(reason: "undrawable \(relativePath)")
    }
    return gray
  }

  /// A 3 × 3 dilation (`grow`) or erosion of the mask; only the mask's box (grown by 1 px) can change.
  nonisolated private func morphed(_ mask: CaptureGrayImage, grow: Bool) -> CaptureGrayImage {
    guard let bounds = foregroundBounds(mask) else { return mask }
    let width = mask.width
    let height = mask.height
    var pixels = mask.pixels
    mask.pixels.withUnsafeBufferPointer { source in
      pixels.withUnsafeMutableBufferPointer { target in
        for y in bounds.minY...bounds.maxY {
          for x in bounds.minX...bounds.maxX {
            var any = false
            var all = true
            for ny in (y - 1)...(y + 1) {
              for nx in (x - 1)...(x + 1) {
                let isSet = ny >= 0 && ny < height && nx >= 0 && nx < width && source[ny * width + nx] > 0
                any = any || isSet
                all = all && isSet
              }
            }
            target[y * width + x] = (grow ? any : all) ? 255 : 0
          }
        }
      }
    }
    return CaptureGrayImage(width: width, height: height, pixels: pixels) ?? mask
  }

  /// The symmetric Hausdorff distance between two point sets (normalised units).
  nonisolated private func hausdorff(_ a: [CaptureOutlinePoint], _ b: [CaptureOutlinePoint]) -> Double {
    func directed(_ from: [CaptureOutlinePoint], _ to: [CaptureOutlinePoint]) -> Double {
      from.map { p in to.map { q in ((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)).squareRoot() }.min() ?? 0 }
        .max() ?? 0
    }
    return max(directed(a, b), directed(b, a))
  }

  /// A deterministic generator (SplitMix64), so a run repeats exactly.
  nonisolated private struct SeededGenerator: RandomNumberGenerator {
    var state: UInt64

    mutating func next() -> UInt64 {
      state &+= 0x9E37_79B9_7F4A_7C15
      var z = state
      z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
      z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
      return z ^ (z >> 31)
    }
  }

  /// `transform` on every item at once (the masks are independent; a debug build traces slowly).
  nonisolated private func concurrentMap<Item: Sendable, Result: Sendable>(
    _ items: [Item],
    _ transform: @escaping @Sendable (Item) throws -> Result
  ) async throws -> [Result] {
    try await withThrowingTaskGroup(of: (Int, Result).self) { group in
      for (number, item) in items.enumerated() {
        group.addTask { (number, try transform(item)) }
      }
      var results: [(Int, Result)] = []
      for try await result in group { results.append(result) }
      return results.sorted { $0.0 < $1.0 }.map(\.1)
    }
  }

  /// The playback frames the debug harness takes a mask from, as `CaptureFrameSetCamera` does: 30 fps, a
  /// new mask once the playback time has advanced by `maskIntervalMs`, over a single set's 11.5 s
  /// (anyway delay + tolerance + 1 s).
  nonisolated private let harnessMaskFrames: [Int] = {
    var frames: [Int] = []
    var lastMs: Int?
    for frame in 0..<345 {
      let timeMs = Int((Double(frame) * 1000 / 30).rounded())
      if lastMs.map({ timeMs - $0 >= CaptureRules.Mask.intervalMs }) ?? true {
        frames.append(frame)
        lastMs = timeMs
      }
    }
    return frames
  }()

  /// One mask per playback update at the mask cadence, as the tracker sees them: the drawn outlines.
  nonisolated private func drawnOutlines(_ masks: [CaptureGrayImage]) -> [[CaptureOutlinePoint]?] {
    var outline = CaptureLiveOutline()
    return masks.enumerated().map { update, mask in
      let candidates = CaptureOutlineContour.outline(of: mask).map {
        [CaptureOutlineCandidate(areaShare: 0, points: $0)]
      }
      outline.observe(maskTimestampMs: update * CaptureRules.Mask.intervalMs, candidates: candidates ?? [])
      return outline.state?.points
    }
  }

  @Suite(
    "Live outline: stored test frames",
    .enabled(if: hasFrames, "set CAPTURE_FRAMES_DIR to a `just capture-frames` folder to run these")
  )
  struct CaptureOutlineFrameTests {
    private let index: FrameIndex

    init() throws {
      index = try FrameIndex.load()
    }

    @Test("every flat single-item mask: outline IoU ≥ 0.92 with the filled item; an empty mask draws none")
    func staticOutline() async throws {
      let sets = index.flatSingles()
      #expect(sets.count > 100)
      let results = try await concurrentMap(sets.map(\.segment)) { segment -> (isEmpty: Bool, iou: Double?) in
        let mask = try loadGray(segment.mask ?? "")
        let isEmpty = !mask.pixels.contains { $0 > 0 }
        let iou = CaptureOutlineContour.outline(of: mask).map { outline in
          intersectionOverUnion(
            CaptureOutlineGeometry.rasterise(outline, width: mask.width, height: mask.height),
            filledLargestComponent(mask))
        }
        return (isEmpty, iou)
      }
      var worst = (id: "", iou: 1.0)
      for (set, result) in zip(sets, results) {
        guard let iou = result.iou else {
          #expect(result.isEmpty, "\(set.id): no outline for a non-empty mask")
          continue
        }
        #expect(!result.isEmpty, "\(set.id): an outline for an empty mask")
        #expect(iou >= 0.92, "\(set.id): IoU \(iou)")
        if iou < worst.iou { worst = (set.id, iou) }
      }
      let traced = results.filter { $0.iou != nil }.count
      print("static outline: \(traced) masks traced, lowest IoU \(worst.iou) (\(worst.id))")
    }

    @Test("jitter sets at the mask cadence: centroid-aligned IoU of successive drawn outlines ≥ 0.95")
    func jitterStability() async throws {
      let sets = index.flatSingles(variant: "jitter")
      let perSet = try await concurrentMap(sets.map(\.segment)) { segment -> [Double] in
        let mask = try loadGray(segment.mask ?? "")
        let offsets = segment.offsets ?? [[0, 0]]
        let masks = harnessMaskFrames.map { frame in
          let offset = offsets[frame % offsets.count]
          return mask.shifted(
            byX: Int((offset[0] * Double(mask.width)).rounded()),
            y: Int((offset[1] * Double(mask.height)).rounded()))
        }
        let drawn = drawnOutlines(masks).map { $0 ?? [] }
        return zip(drawn.dropFirst(), drawn).map { current, previous in
          intersectionOverUnion(
            CaptureOutlineGeometry.rasterise(
              CaptureOutlineGeometry.centred(current), width: mask.width, height: mask.height),
            CaptureOutlineGeometry.rasterise(
              CaptureOutlineGeometry.centred(previous), width: mask.width, height: mask.height))
        }
      }
      for (set, values) in zip(sets, perSet) {
        #expect(values.allSatisfy { $0 >= 0.95 }, "\(set.id): lowest \(values.min() ?? .nan)")
      }
      let values = perSet.flatMap(\.self)
      #expect(values.count > 100)
      print("jitter shape stability: n=\(values.count) min=\(values.min() ?? .nan) p5=\(quantile(values, 0.05))")
    }

    @Test("still frames with 1 px noise per mask: Hausdorff between successive outlines, median ≤ 0.01, p95 ≤ 0.04")
    func stillNoise() async throws {
      let sets = index.flatSingles(variant: "good")
      let seeded = sets.enumerated().map { (seed: UInt64($0.offset + 7), segment: $0.element.segment) }
      let perSet = try await concurrentMap(seeded) { item -> [Double] in
        let mask = try loadGray(item.segment.mask ?? "")
        var generator = SeededGenerator(state: item.seed)
        let masks = (0..<12).map { _ in
          let moved = mask.shifted(
            byX: Int.random(in: -1...1, using: &generator), y: Int.random(in: -1...1, using: &generator))
          switch Int.random(in: 0...2, using: &generator) {
          case 0: return morphed(moved, grow: true)
          case 1: return morphed(moved, grow: false)
          default: return moved
          }
        }
        let drawn = drawnOutlines(masks).map { $0 ?? [] }
        return zip(drawn.dropFirst(), drawn).map { hausdorff($0, $1) }
      }
      let distances = perSet.flatMap(\.self)
      #expect(distances.count > 100)
      let median = quantile(distances, 0.5)
      let p95 = quantile(distances, 0.95)
      print("still noise Hausdorff: n=\(distances.count) median=\(median) p95=\(p95) max=\(distances.max() ?? .nan)")
      #expect(median <= 0.01)
      #expect(p95 <= 0.04)
    }

    @Test("two items: the outline traces one item (IoU ≥ 0.92) and hysteresis keeps it when the order flips")
    func twoItems() async throws {
      let sets = index.sets.filter { $0.variant == "two-items" }
      #expect(sets.count > 10)
      // Per set: the item index and IoU after the first mask, then after each of 3 masks listing the other
      // item first (as if it had become the largest); hysteresis must keep the drawn one.
      let perSet = try await concurrentMap(sets) { set -> [(index: Int, iou: Double)] in
        let labels = try loadGray(set.segments.first?.instances ?? "")
        let instances = CaptureInstanceLabels.instances(in: labels)
        let total = Double(labels.width * labels.height)
        var candidates: [CaptureOutlineCandidate] = []
        var filled: [[Bool]] = []
        for instance in instances {
          guard let mask = CaptureInstanceLabels.mask(of: instance.label, in: labels),
            let points = CaptureOutlineContour.outline(of: mask)
          else { continue }
          candidates.append(CaptureOutlineCandidate(areaShare: Double(instance.pixelCount) / total, points: points))
          filled.append(filledLargestComponent(mask))
        }
        guard candidates.count >= 2 else { return [] }
        func tracedItem(_ outline: CaptureLiveOutline) -> (index: Int, iou: Double) {
          let drawn = CaptureOutlineGeometry.rasterise(
            outline.state?.points ?? [], width: labels.width, height: labels.height)
          let ious = filled.map { intersectionOverUnion(drawn, $0) }
          let best = ious.indices.max { ious[$0] < ious[$1] } ?? 0
          return (best, ious[best])
        }
        var outline = CaptureLiveOutline()
        outline.observe(maskTimestampMs: 0, candidates: candidates)
        var traced = [tracedItem(outline)]
        for update in 1...3 {
          outline.observe(maskTimestampMs: update * CaptureRules.Mask.intervalMs, candidates: candidates.reversed())
          traced.append(tracedItem(outline))
        }
        return traced
      }
      var lowest = 1.0
      for (set, traced) in zip(sets, perSet) {
        #expect(traced.count == 4, "\(set.id): fewer than two items traced")
        for (update, item) in traced.enumerated() {
          #expect(item.index == 0 && item.iou >= 0.92, "\(set.id) update \(update): \(item)")
          lowest = min(lowest, item.iou)
        }
      }
      print("two items: \(perSet.count) sets, lowest IoU \(lowest)")
    }
  }
#endif
