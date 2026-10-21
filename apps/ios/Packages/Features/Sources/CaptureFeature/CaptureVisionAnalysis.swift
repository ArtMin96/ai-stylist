// Turns pixels into a `CaptureObservation` (capture brief §3): the Vision foreground instance mask
// (largest instance → box, area share, edge contact; instance count), Vision body pose in worn mode, and
// luma for light and sharpness. The measuring itself is `CaptureModel`'s `CaptureImageMetrics`, shared
// with the debug frame source. `nonisolated`: it runs on the camera's analysis queue or a background task,
// never the main actor.
#if os(iOS)
  import AIStylistKernel
  public import CaptureModel
  public import CoreGraphics
  import CoreVideo
  public import Foundation
  import ImageIO
  import Vision

  /// Reads 8-bit grey pixels from images and pixel buffers.
  nonisolated public enum CaptureImageReader {
    /// `image` drawn into an 8-bit grey buffer, scaled so its long side is `longSide` (nil: full size).
    public static func gray(from image: CGImage, longSide: Int? = nil) -> CaptureGrayImage? {
      let scale = longSide.map { Double($0) / Double(max(image.width, image.height)) } ?? 1
      let width = max(1, Int((Double(image.width) * scale).rounded()))
      let height = max(1, Int((Double(image.height) * scale).rounded()))
      var pixels = [UInt8](repeating: 0, count: width * height)
      let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
        guard
          let context = CGContext(
            data: buffer.baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width,
            space: CGColorSpaceCreateDeviceGray(),
            bitmapInfo: CGImageAlphaInfo.none.rawValue
          )
        else { return false }
        context.interpolationQuality = .medium
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
      }
      return drawn ? CaptureGrayImage(width: width, height: height, pixels: pixels) : nil
    }

    /// One plane of an 8-bit pixel buffer (plane 0 of a 420 buffer is luma; a one-component buffer has
    /// one plane), sampled so its long side is at most `longSide`.
    static func gray(from buffer: CVPixelBuffer, plane: Int, longSide: Int? = nil) -> CaptureGrayImage? {
      CVPixelBufferLockBaseAddress(buffer, .readOnly)
      defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
      let isPlanar = CVPixelBufferIsPlanar(buffer)
      let width = isPlanar ? CVPixelBufferGetWidthOfPlane(buffer, plane) : CVPixelBufferGetWidth(buffer)
      let height = isPlanar ? CVPixelBufferGetHeightOfPlane(buffer, plane) : CVPixelBufferGetHeight(buffer)
      let rowBytes = isPlanar ? CVPixelBufferGetBytesPerRowOfPlane(buffer, plane) : CVPixelBufferGetBytesPerRow(buffer)
      let base = isPlanar ? CVPixelBufferGetBaseAddressOfPlane(buffer, plane) : CVPixelBufferGetBaseAddress(buffer)
      guard let base, width > 0, height > 0 else { return nil }
      let step = longSide.map { max(1, max(width, height) / $0) } ?? 1
      let outWidth = width / step
      let outHeight = height / step
      let source = base.assumingMemoryBound(to: UInt8.self)
      var pixels = [UInt8](repeating: 0, count: outWidth * outHeight)
      for y in 0..<outHeight {
        let row = y * step * rowBytes
        for x in 0..<outWidth {
          pixels[y * outWidth + x] = source[row + x * step]
        }
      }
      return CaptureGrayImage(width: outWidth, height: outHeight, pixels: pixels)
    }

    /// An upright copy of encoded image data (EXIF orientation applied), long side at most `maxPixels`.
    public static func uprightImage(from data: Data, maxPixels: Int) -> CGImage? {
      guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
      let options: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixels,
      ]
      return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }
  }

  /// The item one Vision foreground mask shows.
  nonisolated struct CaptureForeground: Sendable {
    let measure: CaptureMaskMeasure
    let instanceCount: Int
  }

  /// Vision requests on one image handler.
  nonisolated enum CaptureVision {
    /// The largest foreground instance and the instance count; nil when Vision finds none or cannot run
    /// (the Simulator has no foreground mask).
    static func foreground(using handler: VNImageRequestHandler) -> CaptureForeground? {
      let request = VNGenerateForegroundInstanceMaskRequest()
      do {
        try handler.perform([request])
      } catch {
        return nil
      }
      guard let observation = request.results?.first, !observation.allInstances.isEmpty,
        let labels = CaptureImageReader.gray(from: observation.instanceMask, plane: 0)
      else { return nil }
      var counts = [Int](repeating: 0, count: 256)
      for label in labels.pixels where label > 0 {
        counts[Int(label)] += 1
      }
      guard let largest = counts.indices.dropFirst().max(by: { counts[$0] < counts[$1] }), counts[largest] > 0,
        let mask = CaptureGrayImage(
          width: labels.width,
          height: labels.height,
          pixels: labels.pixels.map { Int($0) == largest ? 255 : 0 }
        ),
        let measure = CaptureMaskProfile(mask: mask)?.measure()
      else { return nil }
      return CaptureForeground(measure: measure, instanceCount: observation.allInstances.count)
    }

    /// The body keypoints of the most confident person (origin top-left), an empty set when nobody is
    /// found, or `modelUnavailable` when the request fails (the doc-10 fallback).
    static func bodyPose(using handler: VNImageRequestHandler) -> CaptureBodyPose {
      let request = VNDetectHumanBodyPoseRequest()
      do {
        try handler.perform([request])
      } catch {
        return .modelUnavailable
      }
      guard let person = request.results?.max(by: { $0.confidence < $1.confidence }) else {
        return .observed([:])
      }
      var keypoints: [CaptureBodyPart: CaptureKeypoint] = [:]
      for (part, joint) in joints {
        guard let point = try? person.recognizedPoint(joint) else { continue }
        keypoints[part] = CaptureKeypoint(
          x: Double(point.location.x),
          y: 1 - Double(point.location.y),
          confidence: Double(point.confidence)
        )
      }
      return .observed(keypoints)
    }

    private static let joints: [(CaptureBodyPart, VNHumanBodyPoseObservation.JointName)] = [
      (.leftShoulder, .leftShoulder), (.rightShoulder, .rightShoulder), (.leftHip, .leftHip),
      (.rightHip, .rightHip), (.leftKnee, .leftKnee), (.rightKnee, .rightKnee), (.leftAnkle, .leftAnkle),
      (.rightAnkle, .rightAnkle),
    ]
  }

  /// Library import (capture brief §7): the checks of one still. No steadiness, tilt or body check, so
  /// sharpness is not measured and no pose runs.
  nonisolated public enum CaptureStillAnalyzer {
    /// Runs Vision off the main actor. On the Simulator, where Vision has no foreground mask, the item is
    /// reported as not found, so the "no item" tip shows.
    @concurrent public static func observe(_ image: CGImage) async -> CaptureObservation {
      let handler = VNImageRequestHandler(cgImage: image, orientation: .up)
      let foreground = CaptureVision.foreground(using: handler)
      let luma = CaptureImageReader.gray(from: image, longSide: CaptureRules.Steady.sharpnessLongSidePx)
      let item = foreground.map {
        CaptureItemObservation(
          box: $0.measure.box,
          maskAreaShare: $0.measure.maskAreaShare,
          edgeContact: $0.measure.edgeContact,
          instanceCount: $0.instanceCount,
          sharpness: 0
        )
      }
      return CaptureObservation(
        timestampMs: 0,
        item: item,
        meanLuma: luma.map(CaptureLumaMetrics.meanLuma(of:)) ?? 0,
        clippedShare: luma.map(CaptureLumaMetrics.clippedShare(of:)) ?? 0
      )
    }
  }
#endif
