// The test-frame camera (capture brief §11 "Playback"): plays a frame set at `playback.fps` through the
// same observation path, lock machine and screens as the live camera. Each segment repeats its image for
// its frame count, moved each frame by the generator's jitter offsets (index `offsets`); the last segment
// loops until the screen closes (or, in a sweep, until the case's duration). On the Simulator Vision has
// no foreground mask, so the stored mask is measured instead (same `CaptureMaskProfile` as the phone).
// By default the rules get a freshly measured mask on every frame; the live outline is traced from the
// stored mask (or instance labels), moved by the jitter, once per `CaptureRules.Ios.maskIntervalMs` of
// playback, as the phone's Vision mask is. With a mask cadence (`captureMaskCadenceMs`), the rules see
// the phone's timing too: the mask (box, edges, other boxes, keypoints) and the outline are measured
// once per cadence and reused, stamped with their `maskTimestampMs`, while light comes from every frame.
#if os(iOS)
  import AIStylistKernel
  public import CaptureFeature
  public import CaptureModel
  import CoreGraphics
  import Foundation
  public import Observation
  public import UIKit

  /// A clock the sweep moves frame by frame, so a 10 s anyway check runs in a fraction of a second and
  /// the same every time.
  public final class CaptureVirtualClock: CaptureClock {
    public var nowMs = 0

    public init() {}
  }

  /// How a frame set is played.
  nonisolated enum CaptureFramePacing: Equatable, Sendable {
    /// Real time at the index's fps; the last segment loops.
    case realTime
    /// As fast as the screen consumes frames, on the virtual clock, ending after `durationMs`.
    case sweep(durationMs: Int)
  }

  /// Plays one frame set.
  @Observable
  public final class CaptureFrameSetCamera: CaptureCamera {
    public let frames = CaptureFramePreview()
    public private(set) var isRunning = false
    public var preview: CapturePreview { isRunning ? .frames(frames) : .none }
    public let hasTorch = false
    public let isTorchOn = false

    @ObservationIgnored private let set: CaptureFrameIndex.FrameSet
    @ObservationIgnored private let directory: URL
    @ObservationIgnored private let fps: Int
    @ObservationIgnored private let pacing: CaptureFramePacing
    @ObservationIgnored private let clock: any CaptureClock
    @ObservationIgnored private let virtualClock: CaptureVirtualClock?
    @ObservationIgnored private weak var listener: (any CaptureFrameSetListener)?
    @ObservationIgnored private var assets: [CaptureFrameAssets] = []
    @ObservationIgnored private var frameNumber = 0
    @ObservationIgnored private var startMs = 0
    @ObservationIgnored private var segmentIndex = -1
    @ObservationIgnored private var currentImage: CGImage?
    @ObservationIgnored private var lastOutlineMs: Int?
    /// Mask cadence in ms (`captureMaskCadenceMs`); nil measures a fresh mask on every frame.
    @ObservationIgnored private let maskCadenceMs: Int?
    /// With a mask cadence: the frame the current mask was taken from and when.
    @ObservationIgnored private var lastMask: (segment: Int, frame: Int, atMs: Int)?
    @ObservationIgnored private var outlines: CaptureMaskOutlines?
    /// The label image (moved by the jitter) the current outlines were traced from; the results log
    /// measures the drawn outline against it.
    @ObservationIgnored private(set) var outlineReference: CaptureGrayImage?

    init(
      set: CaptureFrameIndex.FrameSet,
      directory: URL,
      fps: Int,
      pacing: CaptureFramePacing,
      clock: any CaptureClock,
      virtualClock: CaptureVirtualClock?,
      listener: any CaptureFrameSetListener,
      maskCadenceMs: Int? = nil
    ) {
      self.maskCadenceMs = maskCadenceMs
      self.set = set
      self.directory = directory
      self.fps = max(1, fps)
      self.pacing = pacing
      self.clock = clock
      self.virtualClock = virtualClock
      self.listener = listener
    }

    public func start(for setup: CaptureCameraSetup) async -> CaptureCameraAvailability {
      do {
        assets = try set.segments.map { try CaptureFrameAssets.load($0, in: directory) }
      } catch {
        listener?.frameSetFailed(set, reason: String(describing: error))
        return .noCamera
      }
      guard !assets.isEmpty else { return .noCamera }
      frameNumber = 0
      segmentIndex = -1
      lastOutlineMs = nil
      lastMask = nil
      outlines = nil
      outlineReference = nil
      startMs = clock.nowMs
      isRunning = true
      return .ready
    }

    public func stop() {
      guard isRunning else { return }
      isRunning = false
      frames.image = nil
      listener?.frameSetStopped(set)
    }

    public func update(for setup: CaptureCameraSetup) {}

    public func setTorch(_ isOn: Bool) {}

    public func takePhoto() async throws -> UIImage {
      guard let currentImage else { throw CaptureCameraError("no frame") }
      return UIImage(cgImage: currentImage)
    }

    public func observations() -> AsyncStream<CaptureObservation> {
      AsyncStream(unfolding: { [weak self] in
        await self?.nextFrame()
      })
    }

    private var frameMs: Double { 1000 / Double(fps) }

    /// The next frame's observation, or nil when playback ends.
    private func nextFrame() async -> CaptureObservation? {
      guard isRunning else { return nil }
      switch pacing {
      case .realTime:
        if frameNumber > 0 {
          do {
            try await Task.sleep(for: .milliseconds(Int(frameMs.rounded())))
          } catch {
            return nil
          }
        }
      case .sweep(let durationMs):
        await Task.yield()
        if Double(frameNumber) * frameMs >= Double(durationMs) {
          finish()
          return nil
        }
      }
      guard isRunning, !Task.isCancelled else { return nil }
      let elapsedMs = Int((Double(frameNumber) * frameMs).rounded())
      virtualClock?.nowMs = startMs + elapsedMs
      let (index, frameInSegment, isNewSegment) = segment(forFrame: frameNumber)
      if isNewSegment {
        segmentIndex = index
        listener?.frameSetSegmentStarted(set, segment: index, atMs: clock.nowMs)
      }
      frameNumber += 1
      let maskIntervalMs = maskCadenceMs ?? CaptureRules.Ios.maskIntervalMs
      if lastOutlineMs.map({ elapsedMs - $0 >= maskIntervalMs }) ?? true {
        lastOutlineMs = elapsedMs
        if maskCadenceMs != nil {
          lastMask = (index, frameInSegment, elapsedMs)
        }
        let (dx, dy) = pixelOffset(segment: index, frame: frameInSegment)
        let traced = await Self.traceOutlines(assets[index].outlineLabels, dx: dx, dy: dy, atMs: elapsedMs)
        guard isRunning, !Task.isCancelled else { return nil }
        outlines = traced.outlines
        outlineReference = traced.reference
      }
      return observation(segment: index, frame: frameInSegment, timestampMs: elapsedMs)
    }

    /// The segment's jitter offset at `frame`, in mask pixels.
    private func pixelOffset(segment index: Int, frame: Int) -> (dx: Int, dy: Int) {
      let asset = assets[index]
      let (dx, dy) = set.segments[index].offset(atFrame: frame)
      return (Int((dx * Double(asset.maskWidth)).rounded()), Int((dy * Double(asset.maskHeight)).rounded()))
    }

    /// The live outline's candidates of one stored mask moved by the jitter, traced off the main actor
    /// (a Dev build is unoptimised, and tracing a full-size mask takes tens of milliseconds there).
    @concurrent nonisolated private static func traceOutlines(
      _ labels: CaptureGrayImage?,
      dx: Int,
      dy: Int,
      atMs: Int
    ) async -> (outlines: CaptureMaskOutlines, reference: CaptureGrayImage?) {
      guard let labels else { return (CaptureMaskOutlines(maskTimestampMs: atMs, candidates: []), nil) }
      let moved = labels.shifted(byX: dx, y: dy)
      let instances = CaptureInstanceLabels.instances(in: moved)
      return (CaptureMaskOutlines(maskTimestampMs: atMs, labels: moved, instances: instances), moved)
    }

    private func finish() {
      isRunning = false
      listener?.frameSetFinished(set)
    }

    /// The segment that plays frame `number`, and that frame's number within it; the last one loops.
    private func segment(forFrame number: Int) -> (index: Int, frame: Int, isNew: Bool) {
      var remaining = number
      for (index, segment) in set.segments.enumerated() {
        if remaining < segment.frames || index == set.segments.count - 1 {
          return (index, remaining, index != segmentIndex)
        }
        remaining -= segment.frames
      }
      return (set.segments.count - 1, remaining, false)
    }

    private func observation(segment index: Int, frame: Int, timestampMs: Int) -> CaptureObservation {
      let asset = assets[index]
      let (dx, dy) = set.segments[index].offset(atFrame: frame)
      currentImage = asset.image
      frames.image = asset.image
      frames.offset = CGSize(width: dx, height: dy)
      // The mask the rules read: this frame's, or with a cadence the last one taken (possibly from the
      // previous segment, as a phone's mask lags a scene change).
      let mask = lastMask ?? (index, frame, timestampMs)
      let maskAsset = assets[mask.segment]
      let (maskDx, maskDy) = set.segments[mask.segment].offset(atFrame: mask.frame)
      let (pixelX, pixelY) = pixelOffset(segment: mask.segment, frame: mask.frame)
      let measure = maskAsset.mask?.measure(offsetX: pixelX, offsetY: pixelY)
      let item = measure.map {
        CaptureItemObservation(
          box: $0.box,
          maskAreaShare: $0.maskAreaShare,
          edgeContact: $0.edgeContact,
          instanceCount: maskAsset.instanceCount,
          otherBoxes: maskAsset.otherBoxes.map {
            NormalizedRect(x: $0.x + maskDx, y: $0.y + maskDy, width: $0.width, height: $0.height)
          },
          sharpness: maskAsset.sharpness
        )
      }
      let pose = maskAsset.keypoints.map { keypoints in
        CaptureBodyPose.observed(
          keypoints.mapValues {
            CaptureKeypoint(x: $0.x + maskDx, y: $0.y + maskDy, confidence: $0.confidence)
          }
        )
      }
      return CaptureObservation(
        timestampMs: timestampMs,
        maskTimestampMs: maskCadenceMs == nil ? nil : mask.atMs,
        item: item,
        meanLuma: asset.meanLuma,
        clippedShare: asset.clippedShare,
        tiltDegrees: set.segments[index].tiltDegrees,
        bodyPose: pose ?? .notRun,
        outlines: outlines
      )
    }
  }

  /// Hears the frame source's playback (the harness's results log and sweep).
  @MainActor
  protocol CaptureFrameSetListener: AnyObject {
    func frameSetSegmentStarted(_ set: CaptureFrameIndex.FrameSet, segment: Int, atMs: Int)
    func frameSetFinished(_ set: CaptureFrameIndex.FrameSet)
    func frameSetStopped(_ set: CaptureFrameIndex.FrameSet)
    func frameSetFailed(_ set: CaptureFrameIndex.FrameSet, reason: String)
  }
#endif
