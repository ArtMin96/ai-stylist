// The test-frame camera (capture brief §11 "Playback"): plays a frame set at `playback.fps` through the
// same observation path, lock machine and screens as the live camera. Each segment repeats its image for
// its frame count, moved each frame by a seeded random offset up to its `jitter` share; the last segment
// loops until the screen closes (or, in a sweep, until the case's duration). On the Simulator Vision has
// no foreground mask, so the stored mask is measured instead (same `CaptureMaskProfile` as the phone).
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
    @ObservationIgnored private var random = SplitMix64(seed: 0)
    @ObservationIgnored private var currentImage: CGImage?

    init(
      set: CaptureFrameIndex.FrameSet,
      directory: URL,
      fps: Int,
      pacing: CaptureFramePacing,
      clock: any CaptureClock,
      virtualClock: CaptureVirtualClock?,
      listener: any CaptureFrameSetListener
    ) {
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
      let (index, isNewSegment) = segment(forFrame: frameNumber)
      if isNewSegment {
        segmentIndex = index
        random = SplitMix64(seed: set.segments[index].jitterSeed)
        listener?.frameSetSegmentStarted(set, segment: index, atMs: clock.nowMs)
      }
      frameNumber += 1
      return observation(segment: index, timestampMs: elapsedMs)
    }

    private func finish() {
      isRunning = false
      listener?.frameSetFinished(set)
    }

    /// The segment that plays frame `number`; the last one loops.
    private func segment(forFrame number: Int) -> (index: Int, isNew: Bool) {
      var remaining = number
      for (index, segment) in set.segments.enumerated() {
        if remaining < segment.frames || index == set.segments.count - 1 {
          return (index, index != segmentIndex)
        }
        remaining -= segment.frames
      }
      return (set.segments.count - 1, false)
    }

    private func observation(segment index: Int, timestampMs: Int) -> CaptureObservation {
      let asset = assets[index]
      let jitter = set.segments[index].jitter
      let dx = jitter > 0 ? random.nextUnit() * 2 * jitter - jitter : 0
      let dy = jitter > 0 ? random.nextUnit() * 2 * jitter - jitter : 0
      currentImage = asset.image
      frames.image = asset.image
      frames.offset = CGSize(width: dx, height: dy)
      let measure = asset.mask?.measure(
        offsetX: Int((dx * Double(asset.maskWidth)).rounded()),
        offsetY: Int((dy * Double(asset.maskHeight)).rounded())
      )
      let item = measure.map {
        CaptureItemObservation(
          box: $0.box,
          maskAreaShare: $0.maskAreaShare,
          edgeContact: $0.edgeContact,
          instanceCount: asset.instanceCount,
          sharpness: asset.sharpness
        )
      }
      let pose = asset.keypoints.map { keypoints in
        CaptureBodyPose.observed(
          keypoints.mapValues { CaptureKeypoint(x: $0.x + dx, y: $0.y + dy, confidence: $0.confidence) }
        )
      }
      return CaptureObservation(
        timestampMs: timestampMs,
        item: item,
        meanLuma: asset.meanLuma,
        clippedShare: asset.clippedShare,
        bodyPose: pose ?? .notRun
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

  /// A small seeded generator, so a jittered segment plays the same offsets every run.
  nonisolated struct SplitMix64: Sendable {
    private var state: UInt64

    init(seed: UInt64) {
      state = seed
    }

    /// A value in 0..<1.
    mutating func nextUnit() -> Double {
      state &+= 0x9E37_79B9_7F4A_7C15
      var value = state
      value = (value ^ (value >> 30)) &* 0xBF58_476D_1CE4_E5B9
      value = (value ^ (value >> 27)) &* 0x94D0_49BB_1331_11EB
      value ^= value >> 31
      return Double(value >> 11) / Double(UInt64(1) << 53)
    }
  }
#endif
