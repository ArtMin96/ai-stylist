// The live outline's shape (capture brief "Live outline", steps 3–9): one item mask in, a closed polygon of
// `CaptureOutlineSpec.pointCount` points out, normalised to the frame (0–1, origin top-left), clockwise on
// screen. The Python reference `tools/capture-frames/parity/outline_reference.py` and the Android port
// follow the same steps; `outline-parity.json` holds both apps to it (its README pins the details).
// Pure values on byte buffers, no Apple framework: tested on Linux. `nonisolated`: the camera runs it on
// its analysis queue.

/// Every number of the live-outline spec. The parity fixture's `params` must equal these
/// (CaptureOutlineParityTests).
nonisolated public enum CaptureOutlineSpec {
  /// The crop grows by the item box's long side divided by this (integer division)…
  public static let cropGrowDivisor = 8
  /// …and by at least this many pixels.
  public static let cropGrowMinPx = 2
  /// The crop is area-averaged to this long side, in pixels.
  public static let longSidePx = 64
  /// An area-averaged cell at or above this value is foreground; also the iso value of the contour.
  public static let foregroundAtLeast = 0.5
  /// Douglas–Peucker tolerance, in downscaled pixels.
  public static let epsilonPx = 0.5
  /// Points of every outline.
  public static let pointCount = 64
  /// Hysteresis: the drawn item is kept while its new outline overlaps the drawn one by at least this IoU…
  public static let keepAtLeastIou = 0.3
  /// …unless the largest candidate has at least this many times its area.
  public static let switchAtAreaRatio = 1.5
  /// A new outline below this IoU with the drawn one snaps: its position jumps (no animation)…
  public static let snapBelowIou = 0.5
  /// …and its shape replaces the drawn shape only below this IoU of the two shapes centred on their
  /// centroids; otherwise the shape still blends (a moved item keeps its shape).
  public static let snapKeepsShapeAtLeastIou = 0.5
  /// Weight of the new outline in the moving averages of position and shape.
  public static let emaAlpha = 0.5
  /// The outline clears after this many mask updates in a row without an item.
  public static let clearAfterMissedUpdates = 3
  /// IoU rasterises both polygons on this many cells per side over their joint box.
  public static let iouGridCells = 64
}

/// Steps 3–9: mask → outline polygon.
nonisolated public enum CaptureOutlineContour {
  /// The outline of the largest item in `mask` (a pixel > 0 is foreground); nil when the mask is empty.
  public static func outline(of mask: CaptureGrayImage) -> [CaptureOutlinePoint]? {
    trace(mask)?.points
  }

  /// The outline of one instance of a label image (its pixels equal `instance.label`). Its box, already
  /// measured, saves the scan of the whole image.
  public static func outline(of instance: CaptureInstance, in labels: CaptureGrayImage) -> [CaptureOutlinePoint]? {
    let minX = Int((instance.box.x * Double(labels.width)).rounded())
    let minY = Int((instance.box.y * Double(labels.height)).rounded())
    let maxX = minX + Int((instance.box.width * Double(labels.width)).rounded()) - 1
    let maxY = minY + Int((instance.box.height * Double(labels.height)).rounded()) - 1
    guard instance.label > 0, minX >= 0, minY >= 0, maxX < labels.width, maxY < labels.height, minX <= maxX,
      minY <= maxY
    else { return nil }
    let crop = crop(labels, matching: instance.label, minX: minX, maxX: maxX, minY: minY, maxY: maxY)
    return trace(crop, frameWidth: labels.width, frameHeight: labels.height)?.points
  }

  /// The outline and the vertex count after simplification (the parity fixture checks both).
  public static func trace(_ mask: CaptureGrayImage) -> (points: [CaptureOutlinePoint], simplifiedVertexCount: Int)? {
    guard let bounds = foregroundBounds(mask) else { return nil }
    let crop = crop(mask, matching: nil, minX: bounds.minX, maxX: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY)
    return trace(crop, frameWidth: mask.width, frameHeight: mask.height)
  }

  private static func trace(
    _ crop: Crop,
    frameWidth: Int,
    frameHeight: Int
  ) -> (points: [CaptureOutlinePoint], simplifiedVertexCount: Int)? {
    let soft = downscale(crop)
    guard let component = largestComponent(soft) else { return nil }
    // Zero border, and the area-averaged value only inside the kept component.
    let fieldWidth = soft.width + 2
    let fieldHeight = soft.height + 2
    var field = [Double](repeating: 0, count: fieldWidth * fieldHeight)
    for row in 0..<soft.height {
      for column in 0..<soft.width where component[row * soft.width + column] {
        field[(row + 1) * fieldWidth + column + 1] = soft.values[row * soft.width + column]
      }
    }
    let loops = marchingSquares(field, width: fieldWidth, height: fieldHeight)
    guard var loop = loops.first else { return nil }
    for candidate in loops.dropFirst() where abs(signedArea(candidate)) > abs(signedArea(loop)) {
      loop = candidate
    }
    // Clockwise on screen: positive area with y pointing down.
    if signedArea(loop) < 0 { loop.reverse() }
    var simple = douglasPeuckerClosed(loop, epsilon: CaptureOutlineSpec.epsilonPx)
    if simple.count < 3 || abs(signedArea(simple)) < 1e-9 { simple = loop }
    let cellWidth = Double(crop.width) / Double(soft.width)
    let cellHeight = Double(crop.height) / Double(soft.height)
    // The centre of downscaled cell (c, r) sits at field index (c + 1, r + 1).
    let points = resample(simple, count: CaptureOutlineSpec.pointCount).map { point in
      CaptureOutlinePoint(
        x: (Double(crop.originX) + (point.x - 0.5) * cellWidth) / Double(frameWidth),
        y: (Double(crop.originY) + (point.y - 0.5) * cellHeight) / Double(frameHeight)
      )
    }
    return (points, simple.count)
  }

  // MARK: - Steps 3–5

  private struct Crop {
    let originX: Int
    let originY: Int
    let width: Int
    let height: Int
    /// Foreground (0 or 1) per crop pixel, row-major.
    let bits: [UInt8]
  }

  private struct SoftGrid {
    let width: Int
    let height: Int
    let values: [Double]
  }

  /// The box of the pixels > 0, in pixels; nil when there is none.
  private static func foregroundBounds(_ mask: CaptureGrayImage) -> (minX: Int, maxX: Int, minY: Int, maxY: Int)? {
    var minX = mask.width
    var maxX = -1
    var minY = mask.height
    var maxY = -1
    mask.pixels.withUnsafeBufferPointer { pixels in
      for y in 0..<mask.height {
        let row = y * mask.width
        for x in 0..<mask.width where pixels[row + x] > 0 {
          minX = min(minX, x)
          maxX = max(maxX, x)
          minY = min(minY, y)
          maxY = max(maxY, y)
        }
      }
    }
    return maxX >= 0 ? (minX, maxX, minY, maxY) : nil
  }

  /// Step 3: the item's box (inclusive pixel bounds) grown by max(2 px, long side / 8) and clamped to the
  /// frame. A pixel is the item when it equals `label`, or with no label when it is > 0.
  private static func crop(
    _ image: CaptureGrayImage,
    matching label: UInt8?,
    minX: Int,
    maxX: Int,
    minY: Int,
    maxY: Int
  ) -> Crop {
    let longSide = max(maxX + 1 - minX, maxY + 1 - minY)
    let grow = max(CaptureOutlineSpec.cropGrowMinPx, longSide / CaptureOutlineSpec.cropGrowDivisor)
    let left = max(0, minX - grow)
    let top = max(0, minY - grow)
    let right = min(image.width, maxX + 1 + grow)
    let bottom = min(image.height, maxY + 1 + grow)
    let width = right - left
    let height = bottom - top
    var bits = [UInt8](repeating: 0, count: width * height)
    image.pixels.withUnsafeBufferPointer { pixels in
      bits.withUnsafeMutableBufferPointer { bits in
        for y in 0..<height {
          let source = (top + y) * image.width + left
          for x in 0..<width {
            let pixel = pixels[source + x]
            if label.map({ pixel == $0 }) ?? (pixel > 0) { bits[y * width + x] = 1 }
          }
        }
      }
    }
    return Crop(originX: left, originY: top, width: width, height: height, bits: bits)
  }

  /// Step 4: area average to a `longSidePx` long side. Cell `i` of `n` over `size` pixels spans
  /// [round(i × size / n), max(round((i + 1) × size / n), start + 1)), rounded half to even on the exact
  /// value, the start clamped to `size − 1` (only an upsampled small crop reaches it).
  private static func downscale(_ crop: Crop) -> SoftGrid {
    let width = crop.width
    let height = crop.height
    let longSide = max(width, height)
    let target = CaptureOutlineSpec.longSidePx
    let outHeight = max(3, roundHalfEven(height * target, longSide))
    let outWidth = max(3, roundHalfEven(width * target, longSide))
    var integral = [Int](repeating: 0, count: (width + 1) * (height + 1))
    for y in 0..<height {
      var row = 0
      for x in 0..<width {
        row += Int(crop.bits[y * width + x])
        integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row
      }
    }
    func cell(_ index: Int, of count: Int, over size: Int) -> (start: Int, end: Int) {
      let start = min(roundHalfEven(index * size, count), size - 1)
      return (start, max(roundHalfEven((index + 1) * size, count), start + 1))
    }
    var values = [Double](repeating: 0, count: outWidth * outHeight)
    for row in 0..<outHeight {
      let (y0, y1) = cell(row, of: outHeight, over: height)
      for column in 0..<outWidth {
        let (x0, x1) = cell(column, of: outWidth, over: width)
        let total =
          integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1] - integral[y1 * (width + 1) + x0]
          + integral[y0 * (width + 1) + x0]
        values[row * outWidth + column] = Double(total) / Double((y1 - y0) * (x1 - x0))
      }
    }
    return SoftGrid(width: outWidth, height: outHeight, values: values)
  }

  /// `numerator ÷ denominator` rounded half to even, exactly (both non-negative, denominator > 0).
  static func roundHalfEven(_ numerator: Int, _ denominator: Int) -> Int {
    let quotient = numerator / denominator
    let twiceRemainder = 2 * (numerator % denominator)
    if twiceRemainder > denominator { return quotient + 1 }
    if twiceRemainder < denominator { return quotient }
    return quotient.isMultiple(of: 2) ? quotient : quotient + 1
  }

  /// Step 5: the largest 8-connected component of the foreground cells; ties keep the first found in
  /// row-major order. Nil when no cell is foreground.
  private static func largestComponent(_ soft: SoftGrid) -> [Bool]? {
    let width = soft.width
    let height = soft.height
    let isForeground = soft.values.map { $0 >= CaptureOutlineSpec.foregroundAtLeast }
    var label = [Int](repeating: 0, count: width * height)
    var best = 0
    var bestSize = 0
    var current = 0
    var stack: [Int] = []
    for start in 0..<(width * height) where isForeground[start] && label[start] == 0 {
      current += 1
      var size = 0
      label[start] = current
      stack.append(start)
      while let index = stack.popLast() {
        size += 1
        let y = index / width
        let x = index % width
        for dy in -1...1 {
          for dx in -1...1 {
            let ny = y + dy
            let nx = x + dx
            guard ny >= 0, ny < height, nx >= 0, nx < width else { continue }
            let neighbour = ny * width + nx
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
    guard bestSize > 0 else { return nil }
    return label.map { $0 == best }
  }

  // MARK: - Step 6: marching squares

  /// A crossed grid edge: horizontal between (r, c) and (r, c + 1), vertical between (r, c) and (r + 1, c).
  /// Ordered horizontal first, then by row, then by column (loop start order, pinned for parity).
  private struct Edge: Hashable, Comparable {
    let isVertical: Bool
    let row: Int
    let column: Int

    static func < (lhs: Edge, rhs: Edge) -> Bool {
      (lhs.isVertical ? 1 : 0, lhs.row, lhs.column) < (rhs.isVertical ? 1 : 0, rhs.row, rhs.column)
    }
  }

  /// Every closed iso line of `field` (zero border included), points in field coordinates (x, y).
  private static func marchingSquares(_ field: [Double], width: Int, height: Int) -> [[CaptureOutlinePoint]] {
    let iso = CaptureOutlineSpec.foregroundAtLeast
    func value(_ row: Int, _ column: Int) -> Double { field[row * width + column] }
    func point(_ edge: Edge) -> CaptureOutlinePoint {
      let (row2, column2) = edge.isVertical ? (edge.row + 1, edge.column) : (edge.row, edge.column + 1)
      let from = value(edge.row, edge.column)
      let to = value(row2, column2)
      let t = from == to ? 0.5 : (iso - from) / (to - from)
      return CaptureOutlinePoint(
        x: Double(edge.column) + t * Double(column2 - edge.column),
        y: Double(edge.row) + t * Double(row2 - edge.row)
      )
    }
    var neighbours: [Edge: [Edge]] = [:]
    for row in 0..<(height - 1) {
      for column in 0..<(width - 1) {
        let topLeft = value(row, column) >= iso
        let topRight = value(row, column + 1) >= iso
        let bottomRight = value(row + 1, column + 1) >= iso
        let bottomLeft = value(row + 1, column) >= iso
        // Most cells are all inside or all outside: nothing crosses them.
        if topLeft == topRight && topRight == bottomRight && bottomRight == bottomLeft { continue }
        let top = Edge(isVertical: false, row: row, column: column)
        let right = Edge(isVertical: true, row: row, column: column + 1)
        let bottom = Edge(isVertical: false, row: row + 1, column: column)
        let left = Edge(isVertical: true, row: row, column: column)
        let crossed = [
          (top, topLeft != topRight), (right, topRight != bottomRight), (bottom, bottomLeft != bottomRight),
          (left, topLeft != bottomLeft),
        ]
        .filter(\.1).map(\.0)
        let pairs: [(Edge, Edge)]
        switch crossed.count {
        case 2: pairs = [(crossed[0], crossed[1])]
        // A saddle: the foreground corners stay joined (8-connected), so the background corners are cut off.
        case 4: pairs = topLeft ? [(top, right), (bottom, left)] : [(top, left), (right, bottom)]
        default: pairs = []
        }
        for (a, b) in pairs {
          neighbours[a, default: []].append(b)
          neighbours[b, default: []].append(a)
        }
      }
    }
    var loops: [[CaptureOutlinePoint]] = []
    var seen = Set<Edge>()
    for start in neighbours.keys.sorted() where !seen.contains(start) {
      var loop: [CaptureOutlinePoint] = []
      var previous: Edge?
      var edge = start
      while !seen.contains(edge), let next = neighbours[edge], let first = next.first, let last = next.last {
        seen.insert(edge)
        loop.append(point(edge))
        let following = first == previous ? last : first
        previous = edge
        edge = following
      }
      if loop.count >= 3 { loops.append(loop) }
    }
    return loops
  }

  // MARK: - Steps 7–8

  /// Half the cross-product sum: positive for a clockwise loop on screen (y down).
  static func signedArea(_ points: [CaptureOutlinePoint]) -> Double {
    var sum = 0.0
    for index in points.indices {
      let a = points[index]
      let b = points[(index + 1) % points.count]
      sum += a.x * b.y - b.x * a.y
    }
    return sum / 2
  }

  /// The polygon's area centroid (shoelace); nil when its area is under 1e-9.
  static func areaCentroid(_ points: [CaptureOutlinePoint]) -> CaptureOutlinePoint? {
    let area = signedArea(points)
    guard abs(area) >= 1e-9 else { return nil }
    var x = 0.0
    var y = 0.0
    for index in points.indices {
      let a = points[index]
      let b = points[(index + 1) % points.count]
      let cross = a.x * b.y - b.x * a.y
      x += (a.x + b.x) * cross
      y += (a.y + b.y) * cross
    }
    return CaptureOutlinePoint(x: x / (6 * area), y: y / (6 * area))
  }

  /// Douglas–Peucker on a closed loop, split at the vertex farthest from vertex 0.
  private static func douglasPeuckerClosed(
    _ points: [CaptureOutlinePoint],
    epsilon: Double
  ) -> [CaptureOutlinePoint] {
    guard points.count >= 4 else { return points }
    var far = 0
    var farDistance = -1.0
    for index in points.indices {
      let distance = squaredDistance(points[index], points[0])
      if distance > farDistance {
        far = index
        farDistance = distance
      }
    }
    func simplify(_ run: ArraySlice<CaptureOutlinePoint>) -> [CaptureOutlinePoint] {
      guard run.count >= 3, let a = run.first, let b = run.last else { return Array(run) }
      let dx = b.x - a.x
      let dy = b.y - a.y
      let length = (dx * dx + dy * dy).squareRoot()
      var best = -1.0
      var bestIndex = run.startIndex
      for index in (run.startIndex + 1)..<(run.endIndex - 1) {
        let q = run[index]
        let distance =
          length > 0
          ? abs(dy * q.x - dx * q.y + b.x * a.y - b.y * a.x) / length : squaredDistance(q, a).squareRoot()
        if distance > best {
          best = distance
          bestIndex = index
        }
      }
      guard best > epsilon else { return [a, b] }
      return Array(simplify(run[run.startIndex...bestIndex]).dropLast()) + simplify(run[bestIndex..<run.endIndex])
    }
    let first = simplify(points[0...far])
    let second = simplify((Array(points[far...]) + [points[0]])[...])
    return Array(first.dropLast()) + Array(second.dropLast())
  }

  /// `count` points evenly spaced by arc length, starting at the top crossing of the centroid's vertical.
  private static func resample(_ points: [CaptureOutlinePoint], count: Int) -> [CaptureOutlinePoint] {
    let vertexCount = points.count
    var cumulative = [0.0]
    for index in 0..<vertexCount {
      cumulative.append(
        cumulative[index] + squaredDistance(points[index], points[(index + 1) % vertexCount]).squareRoot())
    }
    let total = cumulative[vertexCount]
    let start = topRayAnchor(points, cumulative: cumulative)
    var result: [CaptureOutlinePoint] = []
    var segment = 0
    for step in 0..<count {
      var position = (start + total * Double(step) / Double(count)).truncatingRemainder(dividingBy: total)
      if position < 0 { position += total }
      var guardCount = 0
      while !(cumulative[segment] <= position && position < cumulative[segment + 1]) && guardCount <= vertexCount {
        segment = (segment + 1) % vertexCount
        guardCount += 1
      }
      let length = cumulative[segment + 1] - cumulative[segment]
      let t = length > 0 ? (position - cumulative[segment]) / length : 0
      let a = points[segment]
      let b = points[(segment + 1) % vertexCount]
      result.append(CaptureOutlinePoint(x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y)))
    }
    return result
  }

  /// Arc length where the vertical line through the area centroid meets the loop at its smallest y.
  private static func topRayAnchor(_ points: [CaptureOutlinePoint], cumulative: [Double]) -> Double {
    guard let centroidX = areaCentroid(points)?.x else { return 0 }
    var best: (y: Double, arc: Double)?
    for index in points.indices {
      let a = points[index]
      let b = points[(index + 1) % points.count]
      guard (a.x - centroidX) * (b.x - centroidX) <= 0, a.x != b.x else { continue }
      let t = (centroidX - a.x) / (b.x - a.x)
      let y = a.y + t * (b.y - a.y)
      if best.map({ y < $0.y }) ?? true {
        best = (y, cumulative[index] + t * (cumulative[index + 1] - cumulative[index]))
      }
    }
    return best?.arc ?? 0
  }

  static func squaredDistance(_ a: CaptureOutlinePoint, _ b: CaptureOutlinePoint) -> Double {
    (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)
  }
}
