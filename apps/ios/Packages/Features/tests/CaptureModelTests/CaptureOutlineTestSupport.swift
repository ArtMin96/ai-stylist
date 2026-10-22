// Shared by the live-outline tests: the parity fixture, mask rows, polygon rasterising and the test
// frames from `just capture-frames`. Masks here are drawn shapes or the generator's masks of CC0 garment
// photos; no person data.
import CaptureModel
import Foundation

/// The repository root, from this file's compile-time path
/// (`<repo>/apps/ios/Packages/Features/tests/CaptureModelTests/<file>`).
nonisolated let repositoryRoot: URL = {
  var url = URL(filePath: #filePath)
  for _ in 0..<7 {
    url.deleteLastPathComponent()
  }
  return url
}()

/// `tools/capture-frames/parity/outline-parity.json` (its README describes the fields).
struct OutlineParityFixture: Decodable {
  struct Params: Decodable, Equatable {
    let maskIntervalMs: Int
    let cropGrowDivisor: Int
    let cropGrowMinPx: Int
    let longSidePx: Int
    let foregroundAtLeast: Double
    let epsilonPx: Double
    let pointCount: Int
    let keepAtLeastIou: Double
    let switchAtAreaRatio: Double
    let snapBelowIou: Double
    let emaAlpha: Double
    let clearAfterMissedUpdates: Int
    let iouGridCells: Int
  }

  struct ContourCase: Decodable {
    let name: String
    let width: Int
    let height: Int
    let simplifiedVertexCount: Int
    let rows: [String]
    let expected: [[Double]]?

    var mask: CaptureGrayImage? { maskFromRows(rows) }
  }

  struct IouCase: Decodable {
    let name: String
    let a: [[Double]]
    let b: [[Double]]
    let expected: Double
  }

  struct Candidate: Decodable {
    let areaShare: Double
    let points: [[Double]]
  }

  struct Step: Decodable {
    let candidates: [Candidate]
    let expected: [[Double]]?
  }

  struct TemporalCase: Decodable {
    let name: String
    let steps: [Step]
  }

  let tolerance: Double
  let params: Params
  let contour: [ContourCase]
  let iou: [IouCase]
  let temporal: [TemporalCase]

  static func load() throws -> OutlineParityFixture {
    let url = repositoryRoot.appending(path: "tools/capture-frames/parity/outline-parity.json")
    return try JSONDecoder().decode(OutlineParityFixture.self, from: Data(contentsOf: url))
  }
}

/// `[[x, y], …]` as points.
nonisolated func outlinePoints(_ pairs: [[Double]]) -> [CaptureOutlinePoint] {
  pairs.map { CaptureOutlinePoint(x: $0.first ?? .nan, y: $0.dropFirst().first ?? .nan) }
}

/// Fixture rows (`#` foreground) as a 0/255 mask.
nonisolated func maskFromRows(_ rows: [String]) -> CaptureGrayImage? {
  let width = rows.first?.count ?? 0
  let pixels = rows.flatMap { row in row.map { $0 == "#" ? UInt8(255) : 0 } }
  return CaptureGrayImage(width: width, height: rows.count, pixels: pixels)
}

/// The largest per-coordinate difference of two point lists of the same length (infinity otherwise).
nonisolated func maxPointDifference(_ a: [CaptureOutlinePoint], _ b: [CaptureOutlinePoint]) -> Double {
  guard a.count == b.count else { return .infinity }
  return zip(a, b).map { max(abs($0.x - $1.x), abs($0.y - $1.y)) }.max() ?? 0
}

/// The box of a mask's foreground grown by `margin` and clamped to the image; nil when it is empty.
nonisolated func foregroundBounds(_ mask: CaptureGrayImage, margin: Int = 1) -> (
  minX: Int, maxX: Int, minY: Int, maxY: Int
)? {
  var minX = mask.width
  var maxX = -1
  var minY = mask.height
  var maxY = -1
  mask.pixels.withUnsafeBufferPointer { pixels in
    for y in 0..<mask.height {
      for x in 0..<mask.width where pixels[y * mask.width + x] > 0 {
        minX = min(minX, x)
        maxX = max(maxX, x)
        minY = min(minY, y)
        maxY = max(maxY, y)
      }
    }
  }
  guard maxX >= 0 else { return nil }
  return (
    max(0, minX - margin), min(mask.width - 1, maxX + margin), max(0, minY - margin),
    min(mask.height - 1, maxY + margin)
  )
}

/// The largest 8-connected component of `mask` with its holes filled: the outer boundary filled, the
/// reference the outline should trace. Work stays inside the mask's box (grown by 1 px).
nonisolated func filledLargestComponent(_ mask: CaptureGrayImage) -> [Bool] {
  let width = mask.width
  let height = mask.height
  var filled = [Bool](repeating: false, count: width * height)
  guard let bounds = foregroundBounds(mask) else { return filled }
  let boxWidth = bounds.maxX - bounds.minX + 1
  let boxHeight = bounds.maxY - bounds.minY + 1
  var isForeground = [Bool](repeating: false, count: boxWidth * boxHeight)
  mask.pixels.withUnsafeBufferPointer { pixels in
    for y in 0..<boxHeight {
      for x in 0..<boxWidth {
        isForeground[y * boxWidth + x] = pixels[(bounds.minY + y) * width + bounds.minX + x] > 0
      }
    }
  }
  var label = [Int](repeating: 0, count: boxWidth * boxHeight)
  var best = 0
  var bestSize = 0
  var current = 0
  var stack: [Int] = []
  for start in 0..<(boxWidth * boxHeight) where isForeground[start] && label[start] == 0 {
    current += 1
    label[start] = current
    stack.append(start)
    var size = 0
    while let index = stack.popLast() {
      size += 1
      let x = index % boxWidth
      let y = index / boxWidth
      for ny in max(0, y - 1)...min(boxHeight - 1, y + 1) {
        for nx in max(0, x - 1)...min(boxWidth - 1, x + 1) {
          let neighbour = ny * boxWidth + nx
          if isForeground[neighbour] && label[neighbour] == 0 {
            label[neighbour] = current
            stack.append(neighbour)
          }
        }
      }
    }
    if size > bestSize {
      best = current
      bestSize = size
    }
  }
  // Background reachable from the box border (4-connected) stays out; the rest is the filled item.
  var outside = [Bool](repeating: false, count: boxWidth * boxHeight)
  func visit(_ index: Int) {
    if !outside[index] && label[index] != best {
      outside[index] = true
      stack.append(index)
    }
  }
  for x in 0..<boxWidth {
    visit(x)
    visit((boxHeight - 1) * boxWidth + x)
  }
  for y in 0..<boxHeight {
    visit(y * boxWidth)
    visit(y * boxWidth + boxWidth - 1)
  }
  while let index = stack.popLast() {
    let x = index % boxWidth
    let y = index / boxWidth
    if x > 0 { visit(index - 1) }
    if x < boxWidth - 1 { visit(index + 1) }
    if y > 0 { visit(index - boxWidth) }
    if y < boxHeight - 1 { visit(index + boxWidth) }
  }
  for y in 0..<boxHeight {
    for x in 0..<boxWidth where !outside[y * boxWidth + x] {
      filled[(bounds.minY + y) * width + bounds.minX + x] = true
    }
  }
  return filled
}

/// IoU of two pixel sets of the same size.
nonisolated func intersectionOverUnion(_ a: [Bool], _ b: [Bool]) -> Double {
  var intersection = 0
  var union = 0
  a.withUnsafeBufferPointer { a in
    b.withUnsafeBufferPointer { b in
      for index in 0..<min(a.count, b.count) {
        if a[index] && b[index] { intersection += 1 }
        if a[index] || b[index] { union += 1 }
      }
    }
  }
  return union > 0 ? Double(intersection) / Double(union) : 1
}

/// The `p`-quantile (nearest rank, as the spike's `sorted[int(n × p)]`).
nonisolated func quantile(_ values: [Double], _ p: Double) -> Double {
  let sorted = values.sorted()
  guard !sorted.isEmpty else { return .nan }
  return sorted[min(sorted.count - 1, Int(Double(sorted.count) * p))]
}
