// The pixel measurements behind a `CaptureObservation` (capture brief §3): mean luma, clipped share, the
// steady-check sharpness and, from a foreground mask, the item's box, area share and edge contact. The
// live camera (Vision mask on the phone) and the debug frame source (stored masks on the Simulator) both
// measure through this file, so the two paths and the frame generator (`tools/capture-frames`) read
// pixels the same way. Pure values on byte buffers: no Apple framework, so it is tested on Linux.
// `nonisolated` because the camera measures on its analysis queue, off the main actor.
import AIStylistKernel

/// An 8-bit, one-channel image (luma or a mask), rows top to bottom, no row padding.
nonisolated public struct CaptureGrayImage: Equatable, Sendable {
  public let width: Int
  public let height: Int
  public let pixels: [UInt8]

  /// Nil when the size is empty or `pixels` does not hold exactly `width × height` values.
  public init?(width: Int, height: Int, pixels: [UInt8]) {
    guard width > 0, height > 0, pixels.count == width * height else { return nil }
    self.width = width
    self.height = height
    self.pixels = pixels
  }

  /// The image resampled (nearest pixel) so its long side is `longSide` pixels; the short side keeps the
  /// aspect ratio and is at least 3, the Laplacian's size.
  public func scaled(toLongSide longSide: Int) -> CaptureGrayImage {
    let scale = Double(longSide) / Double(max(width, height))
    let newWidth = max(3, Int((Double(width) * scale).rounded()))
    let newHeight = max(3, Int((Double(height) * scale).rounded()))
    guard newWidth != width || newHeight != height else { return self }
    var result = [UInt8](repeating: 0, count: newWidth * newHeight)
    for y in 0..<newHeight {
      let sourceY = min(height - 1, Int((Double(y) + 0.5) * Double(height) / Double(newHeight)))
      for x in 0..<newWidth {
        let sourceX = min(width - 1, Int((Double(x) + 0.5) * Double(width) / Double(newWidth)))
        result[y * newWidth + x] = pixels[sourceY * width + sourceX]
      }
    }
    return CaptureGrayImage(uncheckedWidth: newWidth, height: newHeight, pixels: result)
  }

  /// The image moved by whole pixels (right and down are positive); what leaves the frame is lost and
  /// what enters is 0. The debug frame source moves stored masks by the playback jitter this way.
  public func shifted(byX dx: Int, y dy: Int) -> CaptureGrayImage {
    guard dx != 0 || dy != 0 else { return self }
    var result = [UInt8](repeating: 0, count: pixels.count)
    let columns = max(0, dx)..<min(width, width + dx)
    let rows = max(0, dy)..<min(height, height + dy)
    if !columns.isEmpty && !rows.isEmpty {
      pixels.withUnsafeBufferPointer { source in
        result.withUnsafeMutableBufferPointer { target in
          for y in rows {
            let from = (y - dy) * width - dx
            for x in columns { target[y * width + x] = source[from + x] }
          }
        }
      }
    }
    return CaptureGrayImage(uncheckedWidth: width, height: height, pixels: result)
  }

  private init(uncheckedWidth width: Int, height: Int, pixels: [UInt8]) {
    self.width = width
    self.height = height
    self.pixels = pixels
  }
}

/// Whole-frame light and in-box sharpness of a luma image (capture brief §3).
nonisolated public enum CaptureLumaMetrics {
  /// Mean luma of the whole frame, 0–255.
  public static func meanLuma(of image: CaptureGrayImage) -> Double {
    let sum = image.pixels.reduce(0) { $0 + Int($1) }
    return Double(sum) / Double(image.pixels.count)
  }

  /// Share of pixels with luma ≥ `CaptureRules.Light.clippedMinLuma`.
  public static func clippedShare(of image: CaptureGrayImage) -> Double {
    let minLuma = CaptureRules.Light.clippedMinLuma
    let clipped = image.pixels.reduce(0) { $0 + (Double($1) >= minLuma ? 1 : 0) }
    return Double(clipped) / Double(image.pixels.count)
  }

  /// The steady-check sharpness: the image scaled so its long side is
  /// `CaptureRules.Steady.sharpnessLongSidePx`, then the variance of the 4-neighbour 3×3 Laplacian over
  /// the pixels inside `box` (one pixel in from the frame border). 0 when the box holds no pixel.
  public static func sharpness(of image: CaptureGrayImage, inside box: NormalizedRect) -> Double {
    let small = image.scaled(toLongSide: CaptureRules.Steady.sharpnessLongSidePx)
    let width = small.width
    let height = small.height
    let left = max(0, min(1, box.x))
    let top = max(0, min(1, box.y))
    let right = max(0, min(1, box.x + box.width))
    let bottom = max(0, min(1, box.y + box.height))
    let minX = max(1, Int((left * Double(width)).rounded(.down)))
    let maxX = min(width - 2, Int((right * Double(width)).rounded(.up)) - 1)
    let minY = max(1, Int((top * Double(height)).rounded(.down)))
    let maxY = min(height - 2, Int((bottom * Double(height)).rounded(.up)) - 1)
    guard maxX >= minX, maxY >= minY else { return 0 }
    var sum = 0.0
    var sumOfSquares = 0.0
    var count = 0.0
    small.pixels.withUnsafeBufferPointer { luma in
      for y in minY...maxY {
        let row = y * width
        for x in minX...maxX {
          let centre = Int(luma[row + x])
          let neighbours =
            Int(luma[row + x - 1]) + Int(luma[row + x + 1]) + Int(luma[row - width + x])
            + Int(luma[row + width + x])
          let laplacian = Double(neighbours - 4 * centre)
          sum += laplacian
          sumOfSquares += laplacian * laplacian
          count += 1
        }
      }
    }
    let mean = sum / count
    return sumOfSquares / count - mean * mean
  }
}

/// The item a mask shows: box, mask area share and edge contact.
nonisolated public struct CaptureMaskMeasure: Equatable, Sendable {
  public let box: NormalizedRect
  public let maskAreaShare: Double
  public let edgeContact: EdgeContact
}

/// One foreground mask (a pixel > 0 is the item), measured once and then read at any small offset, which
/// the debug frame source uses for playback jitter.
nonisolated public struct CaptureMaskProfile: Equatable, Sendable {
  private let mask: CaptureGrayImage
  private let count: Int
  private let minX: Int
  private let maxX: Int
  private let minY: Int
  private let maxY: Int

  /// Nil when the mask has no foreground pixel.
  public init?(mask: CaptureGrayImage) {
    var count = 0
    var minX = mask.width
    var maxX = -1
    var minY = mask.height
    var maxY = -1
    mask.pixels.withUnsafeBufferPointer { pixels in
      for y in 0..<mask.height {
        let row = y * mask.width
        for x in 0..<mask.width where pixels[row + x] > 0 {
          count += 1
          minX = min(minX, x)
          maxX = max(maxX, x)
          minY = min(minY, y)
          maxY = max(maxY, y)
        }
      }
    }
    guard count > 0 else { return nil }
    self.mask = mask
    self.count = count
    self.minX = minX
    self.maxX = maxX
    self.minY = minY
    self.maxY = maxY
  }

  /// The item with the mask moved by (`offsetX`, `offsetY`) pixels (right and down are positive); nil
  /// when it moved fully out of the frame. Edge contact is exact: the share of each edge's length whose
  /// band (`CaptureRules.edgeBandShare` of that dimension, at least 1 pixel) holds a mask pixel. The box
  /// is the mask's box moved and clipped to the frame; the area share shrinks by the clipped part.
  public func measure(offsetX: Int = 0, offsetY: Int = 0) -> CaptureMaskMeasure? {
    let width = mask.width
    let height = mask.height
    let left = max(0, minX + offsetX)
    let right = min(width - 1, maxX + offsetX)
    let top = max(0, minY + offsetY)
    let bottom = min(height - 1, maxY + offsetY)
    guard left <= right, top <= bottom else { return nil }
    let fullArea = Double((maxX - minX + 1) * (maxY - minY + 1))
    let keptArea = Double((right - left + 1) * (bottom - top + 1))
    let box = NormalizedRect(
      x: Double(left) / Double(width),
      y: Double(top) / Double(height),
      width: Double(right - left + 1) / Double(width),
      height: Double(bottom - top + 1) / Double(height)
    )
    return CaptureMaskMeasure(
      box: box,
      maskAreaShare: Double(count) * keptArea / fullArea / Double(width * height),
      edgeContact: edgeContact(offsetX: offsetX, offsetY: offsetY)
    )
  }

  private func edgeContact(offsetX: Int, offsetY: Int) -> EdgeContact {
    let width = mask.width
    let height = mask.height
    let bandX = max(1, Int((CaptureRules.edgeBandShare * Double(width)).rounded()))
    let bandY = max(1, Int((CaptureRules.edgeBandShare * Double(height)).rounded()))
    return mask.pixels.withUnsafeBufferPointer { pixels in
      /// True when the moved mask holds a pixel at frame position (x, y).
      func isSet(_ x: Int, _ y: Int) -> Bool {
        let sourceX = x - offsetX
        let sourceY = y - offsetY
        guard sourceX >= 0, sourceX < width, sourceY >= 0, sourceY < height else { return false }
        return pixels[sourceY * width + sourceX] > 0
      }
      var top = 0
      var bottom = 0
      for x in 0..<width {
        if (0..<bandY).contains(where: { isSet(x, $0) }) { top += 1 }
        if (0..<bandY).contains(where: { isSet(x, height - 1 - $0) }) { bottom += 1 }
      }
      var left = 0
      var right = 0
      for y in 0..<height {
        if (0..<bandX).contains(where: { isSet($0, y) }) { left += 1 }
        if (0..<bandX).contains(where: { isSet(width - 1 - $0, y) }) { right += 1 }
      }
      return EdgeContact(
        top: Double(top) / Double(width),
        bottom: Double(bottom) / Double(width),
        left: Double(left) / Double(height),
        right: Double(right) / Double(height)
      )
    }
  }
}

/// A foreground instance in a label image (Vision's instance mask, or the frame generator's instance
/// PNG): its label, pixel count and box.
nonisolated public struct CaptureInstance: Equatable, Sendable {
  public let label: UInt8
  public let pixelCount: Int
  public let box: NormalizedRect
}

/// Reads a label image: 0 is background, every other value one foreground instance.
nonisolated public enum CaptureInstanceLabels {
  /// Every instance, largest first (ties by label): the item is the first, the rest are the other
  /// objects the covered rule reads (capture brief §4, C32).
  public static func instances(in labels: CaptureGrayImage) -> [CaptureInstance] {
    var count = [Int](repeating: 0, count: 256)
    var minX = [Int](repeating: Int.max, count: 256)
    var minY = [Int](repeating: Int.max, count: 256)
    var maxX = [Int](repeating: -1, count: 256)
    var maxY = [Int](repeating: -1, count: 256)
    labels.pixels.withUnsafeBufferPointer { pixels in
      for y in 0..<labels.height {
        let row = y * labels.width
        for x in 0..<labels.width {
          let label = Int(pixels[row + x])
          guard label > 0 else { continue }
          count[label] += 1
          minX[label] = min(minX[label], x)
          maxX[label] = max(maxX[label], x)
          minY[label] = min(minY[label], y)
          maxY[label] = max(maxY[label], y)
        }
      }
    }
    let width = Double(labels.width)
    let height = Double(labels.height)
    return (1..<256).filter { count[$0] > 0 }
      .map { label in
        CaptureInstance(
          label: UInt8(label),
          pixelCount: count[label],
          box: NormalizedRect(
            x: Double(minX[label]) / width,
            y: Double(minY[label]) / height,
            width: Double(maxX[label] - minX[label] + 1) / width,
            height: Double(maxY[label] - minY[label] + 1) / height
          )
        )
      }
      .sorted { ($0.pixelCount, Int.max - Int($0.label)) > ($1.pixelCount, Int.max - Int($1.label)) }
  }

  /// One instance as a mask (255 inside, 0 outside); nil when the label has no pixel.
  public static func mask(of label: UInt8, in labels: CaptureGrayImage) -> CaptureGrayImage? {
    guard label > 0, labels.pixels.contains(label) else { return nil }
    return CaptureGrayImage(
      width: labels.width, height: labels.height, pixels: labels.pixels.map { $0 == label ? 255 : 0 })
  }
}
