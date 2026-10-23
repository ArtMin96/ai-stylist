// The live outline over time (capture brief "Live outline", steps 2 and 10): which detected item to draw,
// how a new outline blends into the drawn one, and when it clears. One update per mask
// (`CaptureMaskOutlines.maskTimestampMs`); evaluations that reuse a mask change nothing. Pure values: the
// camera session runs it, tests run it on Linux, `outline-parity.json` "temporal" holds both apps to it.

import AIStylistKernel

/// One detected item's outline: what the platform computes per mask instance (`CaptureOutlineContour`).
nonisolated public struct CaptureOutlineCandidate: Equatable, Sendable {
  /// The item's mask pixels ÷ frame pixels (hysteresis compares these).
  public let areaShare: Double
  /// `CaptureRules.Outline.pointCount` points, normalised to the frame, clockwise on screen.
  public let points: [CaptureOutlinePoint]

  public init(areaShare: Double, points: [CaptureOutlinePoint]) {
    self.areaShare = areaShare
    self.points = points
  }
}

/// One mask's item outlines, as the platform hands them to the camera session.
nonisolated public struct CaptureMaskOutlines: Equatable, Sendable {
  /// Frame time of the mask; observations that reuse a mask repeat it, and only a new one updates.
  public let maskTimestampMs: Int
  /// The mask's items, largest first; empty when it shows no item.
  public let candidates: [CaptureOutlineCandidate]

  public init(maskTimestampMs: Int, candidates: [CaptureOutlineCandidate]) {
    self.maskTimestampMs = maskTimestampMs
    self.candidates = candidates
  }

  /// The outlines of a label image's instances (0 background; Vision's instance mask, or the frame
  /// generator's instance PNG).
  public init(maskTimestampMs: Int, labels: CaptureGrayImage, instances: [CaptureInstance]) {
    self.init(maskTimestampMs: maskTimestampMs, candidates: Self.candidates(labels: labels, instances: instances))
  }

  /// The outlines of a label image's instances that count as an item (`CaptureRules.Mask.minInstanceAreaShare`),
  /// the largest `maxCandidates` of them, which bounds the work per mask. `instances` largest first, as
  /// `CaptureInstanceLabels.instances(in:)` lists them.
  public static func candidates(labels: CaptureGrayImage, instances: [CaptureInstance]) -> [CaptureOutlineCandidate] {
    let frameArea = Double(labels.width * labels.height)
    return instances.prefix(maxCandidates)
      .filter { Double($0.pixelCount) / frameArea >= CaptureRules.Mask.minInstanceAreaShare }
      .compactMap { instance in
        CaptureOutlineContour.outline(of: instance, in: labels).map {
          CaptureOutlineCandidate(areaShare: Double(instance.pixelCount) / frameArea, points: $0)
        }
      }
  }

  /// At most this many instances are traced per mask (the largest ones).
  public static let maxCandidates = 3
}

/// The outline the camera screen draws.
nonisolated public struct CaptureLiveOutlineState: Equatable, Sendable {
  /// The drawn polygon, normalised to the frame (0–1, origin top-left).
  public let points: [CaptureOutlinePoint]
  /// Counts snaps: the screen animates a change only while this stays the same (a snap jumps).
  public let snapCount: Int
}

/// Steps 2 and 10: choose, blend, snap and clear.
nonisolated public struct CaptureLiveOutline: Sendable {
  public private(set) var state: CaptureLiveOutlineState?
  private var lastMaskTimestampMs: Int?
  private var missedUpdates = 0
  private var snapCount = 0

  public init() {}

  /// Forgets the outline (camera restart, background, mode change).
  public mutating func reset() {
    state = nil
    lastMaskTimestampMs = nil
    missedUpdates = 0
  }

  /// One observation's outlines. Only a new mask (`maskTimestampMs`) updates.
  public mutating func observe(_ outlines: CaptureMaskOutlines) {
    observe(maskTimestampMs: outlines.maskTimestampMs, candidates: outlines.candidates)
  }

  /// One observation. `candidates` are the mask's items, largest first; empty means no item. Only a new
  /// `maskTimestampMs` updates.
  public mutating func observe(maskTimestampMs: Int, candidates: [CaptureOutlineCandidate]) {
    guard maskTimestampMs != lastMaskTimestampMs else { return }
    lastMaskTimestampMs = maskTimestampMs
    update(candidates)
  }

  /// One mask update.
  mutating func update(_ candidates: [CaptureOutlineCandidate]) {
    guard let largest = candidates.first else {
      missedUpdates += 1
      if missedUpdates >= CaptureRules.Outline.clearAfterMissedUpdates { state = nil }
      return
    }
    missedUpdates = 0
    guard let drawn = state?.points else {
      snap(to: largest.points)
      return
    }
    let chosen = Self.choose(candidates, largest: largest, drawn: drawn).points
    // Position and shape blend apart, so a moving item keeps its shape: centroid = vertex mean, shape = the
    // points around it, the new shape cyclically aligned to the drawn shape.
    let alpha = CaptureRules.Outline.emaAlpha
    let new = Shape(chosen)
    let old = Shape(drawn)
    let shape = CaptureOutlineGeometry.aligned(new.points, to: old.points)
    var centre = new.centroid
    if CaptureOutlineGeometry.intersectionOverUnion(chosen, drawn) >= CaptureRules.Outline.snapBelowIou {
      centre = CaptureOutlinePoint(
        x: alpha * new.centroid.x + (1 - alpha) * old.centroid.x,
        y: alpha * new.centroid.y + (1 - alpha) * old.centroid.y)
    } else if CaptureOutlineGeometry.intersectionOverUnion(shape, old.points)
      < CaptureRules.Outline.snapKeepsShapeAtLeastIou
    {
      snap(to: chosen)  // another shape: replaced
      return
    } else {
      snapCount += 1  // the same shape moved far: the position jumps, the shape still blends
    }
    let blended = zip(shape, old.points).map { new, old in
      CaptureOutlinePoint(
        x: centre.x + alpha * new.x + (1 - alpha) * old.x, y: centre.y + alpha * new.y + (1 - alpha) * old.y)
    }
    state = CaptureLiveOutlineState(points: blended, snapCount: snapCount)
  }

  /// An outline split into its centroid (the vertex mean) and its points relative to it.
  private struct Shape {
    let centroid: CaptureOutlinePoint
    let points: [CaptureOutlinePoint]

    init(_ outline: [CaptureOutlinePoint]) {
      let count = Double(max(1, outline.count))
      let centroid = CaptureOutlinePoint(
        x: outline.map(\.x).reduce(0, +) / count, y: outline.map(\.y).reduce(0, +) / count)
      self.centroid = centroid
      points = outline.map { CaptureOutlinePoint(x: $0.x - centroid.x, y: $0.y - centroid.y) }
    }
  }

  private mutating func snap(to points: [CaptureOutlinePoint]) {
    snapCount += 1
    state = CaptureLiveOutlineState(points: points, snapCount: snapCount)
  }

  /// Step 2: the candidate overlapping the drawn outline most (IoU ≥ `keepAtLeastIou`) stays, unless the
  /// largest is at least `switchAtAreaRatio` times its area; with none overlapping, the largest.
  private static func choose(
    _ candidates: [CaptureOutlineCandidate],
    largest: CaptureOutlineCandidate,
    drawn: [CaptureOutlinePoint]
  ) -> CaptureOutlineCandidate {
    var kept: CaptureOutlineCandidate?
    var keptIou = -1.0
    for candidate in candidates {
      let overlap = CaptureOutlineGeometry.intersectionOverUnion(candidate.points, drawn)
      if overlap >= CaptureRules.Outline.keepAtLeastIou && overlap > keptIou {
        kept = candidate
        keptIou = overlap
      }
    }
    guard let kept, largest.areaShare < CaptureRules.Outline.switchAtAreaRatio * kept.areaShare else {
      return largest
    }
    return kept
  }
}

/// Polygon measures the live outline reads.
nonisolated public enum CaptureOutlineGeometry {
  /// IoU of two polygons: both rasterised on `iouGridCells` × `iouGridCells` cells over their joint box; a
  /// cell counts when its centre is inside (even-odd). 0 when the joint box is empty.
  public static func intersectionOverUnion(_ a: [CaptureOutlinePoint], _ b: [CaptureOutlinePoint]) -> Double {
    let all = a + b
    guard let minX = all.map(\.x).min(), let maxX = all.map(\.x).max(), let minY = all.map(\.y).min(),
      let maxY = all.map(\.y).max(), maxX > minX, maxY > minY
    else { return 0 }
    let cells = CaptureRules.Outline.iouGridCells
    let cellWidth = (maxX - minX) / Double(cells)
    let cellHeight = (maxY - minY) / Double(cells)
    var intersection = 0
    var union = 0
    for row in 0..<cells {
      let y = minY + (Double(row) + 0.5) * cellHeight
      let insideA = rowCells(a, y: y, minX: minX, cellWidth: cellWidth, cells: cells)
      let insideB = rowCells(b, y: y, minX: minX, cellWidth: cellWidth, cells: cells)
      for column in 0..<cells {
        if insideA[column] && insideB[column] { intersection += 1 }
        if insideA[column] || insideB[column] { union += 1 }
      }
    }
    return union > 0 ? Double(intersection) / Double(union) : 0
  }

  /// The cells of one row whose centre lies inside `polygon` (even-odd; an edge crosses the row's centre
  /// line when exactly one of its ends lies below it).
  private static func rowCells(
    _ polygon: [CaptureOutlinePoint],
    y: Double,
    minX: Double,
    cellWidth: Double,
    cells: Int
  ) -> [Bool] {
    var crossings: [Double] = []
    for index in polygon.indices {
      let a = polygon[index]
      let b = polygon[(index + 1) % polygon.count]
      if (a.y > y) != (b.y > y) {
        crossings.append(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x))
      }
    }
    crossings.sort()
    var inside = [Bool](repeating: false, count: cells)
    var pair = 0
    while pair + 1 < crossings.count {
      for column in 0..<cells {
        let x = minX + (Double(column) + 0.5) * cellWidth
        if crossings[pair] <= x && x < crossings[pair + 1] { inside[column] = true }
      }
      pair += 2
    }
    return inside
  }

  /// `polygon` (normalised) filled on a `width` × `height` pixel grid, row-major: a pixel counts when its
  /// centre is inside (even-odd).
  public static func rasterise(_ polygon: [CaptureOutlinePoint], width: Int, height: Int) -> [Bool] {
    var inside = [Bool](repeating: false, count: width * height)
    let points = polygon.map { CaptureOutlinePoint(x: $0.x * Double(width), y: $0.y * Double(height)) }
    var crossings: [Double] = []
    for row in 0..<height {
      let y = Double(row) + 0.5
      crossings.removeAll(keepingCapacity: true)
      for index in points.indices {
        let a = points[index]
        let b = points[(index + 1) % points.count]
        if (a.y > y) != (b.y > y) {
          crossings.append(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x))
        }
      }
      crossings.sort()
      var pair = 0
      while pair + 1 < crossings.count {
        let first = max(0, Int((crossings[pair] - 0.5).rounded(.up)))
        let last = min(width - 1, Int((crossings[pair + 1] - 0.5).rounded(.up)) - 1)
        if first <= last {
          for column in first...last { inside[row * width + column] = true }
        }
        pair += 2
      }
    }
    return inside
  }

  /// IoU of `polygon` (normalised) with the pixels of `mask` that are > 0, at the mask's resolution.
  public static func intersectionOverUnion(_ polygon: [CaptureOutlinePoint], mask: CaptureGrayImage) -> Double {
    let inside = rasterise(polygon, width: mask.width, height: mask.height)
    var intersection = 0
    var union = 0
    mask.pixels.withUnsafeBufferPointer { pixels in
      for index in 0..<pixels.count {
        let isItem = pixels[index] > 0
        if isItem && inside[index] { intersection += 1 }
        if isItem || inside[index] { union += 1 }
      }
    }
    return union > 0 ? Double(intersection) / Double(union) : 0
  }

  /// The polygon moved so its area centroid sits at the frame centre: the stability measure's shape
  /// comparison without position. The area centroid, unlike the vertex mean, does not drift with the edge's
  /// jaggies on an unchanged shape (owner 2026-10-22). The tracker's blend keeps the vertex mean (`Shape`).
  /// A degenerate polygon (area under 1e-9) falls back to the vertex mean.
  public static func centred(_ points: [CaptureOutlinePoint]) -> [CaptureOutlinePoint] {
    guard !points.isEmpty else { return points }
    let centre =
      CaptureOutlineContour.areaCentroid(points)
      ?? CaptureOutlinePoint(
        x: points.map(\.x).reduce(0, +) / Double(points.count),
        y: points.map(\.y).reduce(0, +) / Double(points.count))
    return points.map { CaptureOutlinePoint(x: $0.x - centre.x + 0.5, y: $0.y - centre.y + 0.5) }
  }

  /// `points` cyclically shifted to the least summed squared distance to `reference` (same count; ties
  /// keep the smallest shift).
  public static func aligned(_ points: [CaptureOutlinePoint], to reference: [CaptureOutlinePoint])
    -> [CaptureOutlinePoint]
  {
    let count = points.count
    guard count == reference.count, count > 0 else { return points }
    var bestShift = 0
    var bestDistance = Double.infinity
    for shift in 0..<count {
      var distance = 0.0
      for index in 0..<count {
        distance += CaptureOutlineContour.squaredDistance(points[(index + shift) % count], reference[index])
      }
      if distance < bestDistance {
        bestDistance = distance
        bestShift = shift
      }
    }
    return (0..<count).map { points[($0 + bestShift) % count] }
  }
}
