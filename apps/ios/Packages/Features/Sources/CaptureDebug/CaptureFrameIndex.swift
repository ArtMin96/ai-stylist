// Reads the test frames `just capture-frames` writes to `artifacts/capture-camera/frames/` (layout:
// tools/capture-frames/README.md "Output"): `index.json`, and per segment the frame PNG, its stored Vision
// mask, its box file (instance count and the other instances' boxes) and, for worn frames, the ground-truth keypoints. Only what the
// frame source plays is decoded; the expected-result files are the recipe's, not the app's.
#if os(iOS)
  public import AIStylistKernel
  import CaptureFeature
  public import CaptureModel
  import CoreGraphics
  public import Foundation
  import ImageIO

  /// `index.json` (schema version 1).
  nonisolated public struct CaptureFrameIndex: Decodable, Sendable {
    public struct Acceptance: Decodable, Sendable {
      public let anywayAtMs: Int
      public let anywayToleranceMs: Int
      public let maxUnlockMs: Int
    }

    public struct Playback: Decodable, Sendable {
      public let fps: Int
      public let gapFrames: Int
      public let segmentFrames: Int
    }

    public struct Segment: Decodable, Sendable {
      public let frame: String
      public let mask: String?
      public let box: String?
      public let keypoints: String?
      public let expected: String?
      public let frames: Int
      public let jitter: Double
      /// Jittered segments: `[dx, dy]` per frame, shares of the frame; absent means no movement.
      public let offsets: [[Double]]?
      /// The phone's tilt during the segment, in degrees (the tilt hint, flat mode); absent means no
      /// gravity sensor, as on the Simulator.
      public let tiltDegrees: Double?

      /// The jitter offset of the segment's frame `number`; the offsets loop with the segment.
      public func offset(atFrame number: Int) -> (dx: Double, dy: Double) {
        guard let offsets, !offsets.isEmpty else { return (0, 0) }
        let pair = offsets[number % offsets.count]
        return (pair.first ?? 0, pair.dropFirst().first ?? 0)
      }
    }

    public struct FrameSet: Decodable, Sendable, Identifiable {
      public let id: String
      public let family: String
      public let mode: String
      /// `single`, `sweep` or `batch`.
      public let kind: String
      public let variant: String?
      public let segments: [Segment]

      public var shapeFamily: CaptureShapeFamily { CaptureShapeFamily(rawValue: family) ?? .generic }
      public var captureMode: CaptureMode { CaptureMode(rawValue: mode) ?? .flat }
      public var isBatch: Bool { kind == "batch" }
    }

    public let acceptance: Acceptance
    public let playback: Playback
    public let sets: [FrameSet]

    /// Reads `index.json` in `directory`.
    public static func load(from directory: URL) throws -> CaptureFrameIndex {
      let data = try Data(contentsOf: directory.appending(path: "index.json"))
      return try JSONDecoder().decode(CaptureFrameIndex.self, from: data)
    }
  }

  /// A frames folder that is missing or unreadable.
  nonisolated struct CaptureFrameError: Error, Equatable, Sendable {
    let reason: String
  }

  /// One segment decoded and measured once; playback then only moves it by the jitter offset.
  nonisolated struct CaptureFrameAssets: Sendable {
    let image: CGImage
    let mask: CaptureMaskProfile?
    let maskWidth: Int
    let maskHeight: Int
    let instanceCount: Int
    /// The stored boxes of every instance but the largest (the covered rule, capture brief §4).
    let otherBoxes: [NormalizedRect]
    let sharpness: Double
    let meanLuma: Double
    let clippedShare: Double
    /// Ground-truth keypoints (worn frames), fed as the body pose (the Simulator cannot run the live
    /// pose model on drawn figures reliably; brief §11).
    let keypoints: [CaptureBodyPart: CaptureKeypoint]?

    static func load(_ segment: CaptureFrameIndex.Segment, in directory: URL) throws -> CaptureFrameAssets {
      let image = try Self.image(at: directory.appending(path: segment.frame))
      guard let luma = CaptureImageReader.gray(from: image) else {
        throw CaptureFrameError(reason: "unreadable frame \(segment.frame)")
      }
      let maskImage = try segment.mask.map { try Self.image(at: directory.appending(path: $0)) }
      let maskGray = maskImage.flatMap { CaptureImageReader.gray(from: $0) }
      let profile = maskGray.flatMap(CaptureMaskProfile.init(mask:))
      let box = profile?.measure()?.box
      let storedBoxes = try segment.box.map { try Self.boxes(at: directory.appending(path: $0)) }
      return CaptureFrameAssets(
        image: image,
        mask: profile,
        maskWidth: maskGray?.width ?? luma.width,
        maskHeight: maskGray?.height ?? luma.height,
        instanceCount: storedBoxes?.count ?? 1,
        otherBoxes: Array(storedBoxes?.dropFirst() ?? []),
        sharpness: box.map { CaptureLumaMetrics.sharpness(of: luma, inside: $0) } ?? 0,
        meanLuma: CaptureLumaMetrics.meanLuma(of: luma),
        clippedShare: CaptureLumaMetrics.clippedShare(of: luma),
        keypoints: try segment.keypoints.map { try Self.keypoints(at: directory.appending(path: $0)) }
      )
    }

    private static func image(at url: URL) throws -> CGImage {
      guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
      else { throw CaptureFrameError(reason: "unreadable image \(url.lastPathComponent)") }
      return image
    }

    private struct BoxFile: Decodable {
      struct Instance: Decodable {
        struct Box: Decodable {
          let x: Double
          let y: Double
          let width: Double
          let height: Double
        }

        let box: Box
      }

      let objects: [Instance]
    }

    /// Every stored instance box, largest first (the generator's order).
    private static func boxes(at url: URL) throws -> [NormalizedRect] {
      try JSONDecoder().decode(BoxFile.self, from: Data(contentsOf: url)).objects.map {
        NormalizedRect(x: $0.box.x, y: $0.box.y, width: $0.box.width, height: $0.box.height)
      }
    }

    private struct KeypointFile: Decodable {
      struct Part: Decodable {
        let x: Double
        let y: Double
        let present: Bool
      }

      let parts: [String: Part]
    }

    /// `present` parts get full confidence and absent ones none, so the rules decide as on a phone.
    private static func keypoints(at url: URL) throws -> [CaptureBodyPart: CaptureKeypoint] {
      let file = try JSONDecoder().decode(KeypointFile.self, from: Data(contentsOf: url))
      var keypoints: [CaptureBodyPart: CaptureKeypoint] = [:]
      for (name, part) in file.parts {
        guard let bodyPart = CaptureBodyPart(rawValue: name) else { continue }
        keypoints[bodyPart] = CaptureKeypoint(x: part.x, y: part.y, confidence: part.present ? 1 : 0)
      }
      return keypoints
    }
  }
#endif
