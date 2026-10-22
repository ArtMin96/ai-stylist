// The Dev build's capture harness (capture brief §11): picks the frame source (real camera or a frame
// set), forces the screen-reader behaviour, keeps the spoken log and lock state for the debug panel, writes
// the results log, and runs the sweep. Linked only in Dev (apps/ios/Config/Dev.xcconfig).
#if os(iOS)
  import AIStylistKernel
  public import CaptureFeature
  public import CaptureModel
  public import Foundation
  public import Observation
  import UIKit

  @Observable
  public final class CaptureDebugHarness: CaptureHarness {
    /// Where the camera's frames come from.
    public enum Source: Equatable, Sendable {
      case camera
      case frames
    }

    public let options: CaptureDebugOptions
    public private(set) var index: CaptureFrameIndex?
    public var source: Source
    public var selectedSetID: String?
    public private(set) var isScreenReaderForced: Bool
    /// The last three spoken lines (`cap-debug-spoken-log`).
    public private(set) var spokenLog: [String] = []
    /// The shutter state (`cap-debug-lock-state`).
    public private(set) var lockState = "idle"
    /// Load errors and sweep progress.
    public private(set) var status = ""

    @ObservationIgnored private let virtualClock: CaptureVirtualClock?
    @ObservationIgnored private let continuousClock = ContinuousCaptureClock()
    @ObservationIgnored private let log: CaptureResultsLog?
    @ObservationIgnored private weak var model: CaptureModel?
    @ObservationIgnored private var sweepTask: Task<Void, Never>?
    @ObservationIgnored private var caseFinished: CheckedContinuation<Void, Never>?
    @ObservationIgnored private var playingSet: CaptureFrameIndex.FrameSet?
    @ObservationIgnored private var current: CaptureSegmentResult?
    @ObservationIgnored private var segmentStartMs = 0
    /// The playing frame camera: the stored masks the live outline is scored against.
    @ObservationIgnored private weak var frameCamera: CaptureFrameSetCamera?
    @ObservationIgnored private var outlineScores = CaptureOutlineScores()

    public init(options: CaptureDebugOptions) {
      self.options = options
      source = options.frameSetID != nil || options.sweep ? .frames : .camera
      selectedSetID = options.frameSetID
      isScreenReaderForced = options.forcesScreenReader
      virtualClock = options.sweep ? CaptureVirtualClock() : nil
      var status: [String] = []
      do {
        log = try CaptureResultsLog(startsFresh: options.isActive)
      } catch {
        log = nil
        status.append("results log unavailable: \(error)")
      }
      do {
        index = try CaptureFrameIndex.load(from: options.resolvedFramesDirectory)
      } catch {
        index = nil
        status.append("no frames at \(options.resolvedFramesDirectory.path(percentEncoded: false))")
      }
      self.status = status.joined(separator: "\n")
    }

    deinit {
      sweepTask?.cancel()
    }

    /// The sweep opens the camera at launch.
    public var opensCaptureAtLaunch: Bool { options.sweep }

    /// The results log file (`Documents/capture-results.jsonl`).
    public var resultsURL: URL? { log?.url }

    // MARK: - CaptureHarness

    public func makeCamera() -> (any CaptureCamera)? {
      CaptureSwitchableCamera(harness: self)
    }

    public var clock: (any CaptureClock)? { virtualClock ?? continuousClock }

    public var forcesScreenReader: Bool { isScreenReaderForced }

    public func attach(to model: CaptureModel) {
      self.model = model
      guard options.sweep, sweepTask == nil else { return }
      sweepTask = Task { [weak self] in
        await self?.runSweep()
      }
    }

    public func spoke(_ text: String) {
      spokenLog = Array((spokenLog + [text]).suffix(3))
    }

    public func cameraChanged(_ output: CaptureCameraOutput?) {
      lockState = output.map { Self.describe($0.shutter) } ?? "idle"
      record(output)
    }

    public func recordsCapture(_ trigger: CaptureTrigger) -> Bool {
      if var result = current {
        result.captures.append(.init(tMs: elapsedMs, trigger: trigger.rawValue))
        current = result
      }
      // A sweep (or a record-only launch) records the capture and carries on; a batch set still counts
      // its photos (C20).
      return (options.sweep || options.recordsCaptures) && playingSet?.isBatch != true
    }

    // MARK: - Panel

    public func setScreenReaderForced(_ isOn: Bool) {
      isScreenReaderForced = isOn
      _ = model?.screenReaderChanged(isOn)
    }

    // MARK: - Frame source

    /// The frame camera for the selected set, or nil for the real camera.
    func makeFrameCamera() -> CaptureFrameSetCamera? {
      guard source == .frames, let index, let set = index.sets.first(where: { $0.id == selectedSetID }) else {
        return nil
      }
      let camera = CaptureFrameSetCamera(
        set: set,
        directory: options.resolvedFramesDirectory,
        fps: index.playback.fps,
        pacing: options.sweep ? .sweep(durationMs: sweepDuration(of: set, in: index)) : .realTime,
        clock: virtualClock ?? continuousClock,
        virtualClock: virtualClock,
        listener: self,
        maskCadenceMs: options.maskCadenceMs
      )
      frameCamera = camera
      return camera
    }

    /// A single set plays until "Take photo anyway" is due plus its tolerance and a second; a sweep or
    /// batch set plays its segments once.
    private func sweepDuration(of set: CaptureFrameIndex.FrameSet, in index: CaptureFrameIndex) -> Int {
      let framesMs = set.segments.reduce(0) { $0 + $1.frames } * 1000 / max(1, index.playback.fps)
      guard set.kind == "single" else { return framesMs }
      let anywayDueMs = index.acceptance.anywayAtMs + index.acceptance.anywayToleranceMs + 1000
      return max(framesMs, anywayDueMs)
    }

    // MARK: - Sweep

    private func runSweep() async {
      guard let index else {
        status = "sweep: no index.json"
        return
      }
      let sets = options.frameSetID.map { id in index.sets.filter { $0.id == id } } ?? index.sets
      for (number, set) in sets.enumerated() {
        guard !Task.isCancelled, let model else { return }
        status = "sweep \(number + 1)/\(sets.count): \(set.id)"
        source = .frames
        selectedSetID = set.id
        await withCheckedContinuation { continuation in
          caseFinished = continuation
          open(set, in: model)
        }
      }
      do {
        try log?.markSweepFinished(cases: sets.count)
        status = "sweep finished: \(sets.count) sets"
      } catch {
        status = "sweep finished; done marker failed: \(error)"
      }
    }

    private func open(_ set: CaptureFrameIndex.FrameSet, in model: CaptureModel) {
      if set.isBatch {
        model.startBatch()
        return
      }
      model.chooseFamily(set.shapeFamily)
      if set.captureMode != .flat {
        model.selectMode(set.captureMode)
      }
    }

    // MARK: - Results

    private var elapsedMs: Int { (clock?.nowMs ?? 0) - segmentStartMs }

    private func record(_ output: CaptureCameraOutput?) {
      guard var result = current, let output else { return }
      if let outline = output.outline, outlineScores.isNew(outline) {
        if result.outlineFirstMs == nil { result.outlineFirstMs = elapsedMs }
        outlineScores.add(outline, reference: frameCamera?.outlineReference)
        current = result
      }
      let event = CaptureSegmentResult.Event(
        tMs: elapsedMs,
        shutter: Self.describe(output.shutter),
        hint: output.hint?.rawValue,
        anyway: output.isAnywayVisible
      )
      if let reason = output.anywayReason {
        result.anywayReason = Self.describe(reason)
        current = result
      }
      if let last = result.events.last, last.shutter == event.shutter, last.hint == event.hint,
        last.anyway == event.anyway
      {
        return
      }
      result.events.append(event)
      if result.firstUnlockMs == nil, case .unlocked = output.shutter {
        result.firstUnlockMs = event.tMs
      }
      if result.anywayMs == nil, output.isAnywayVisible {
        result.anywayMs = event.tMs
      }
      result.finalHint = event.hint
      current = result
    }

    private func flush() {
      guard var result = current else { return }
      current = nil
      result.durationMs = elapsedMs
      result.outlinePresentAtEnd = model?.camera?.outline != nil
      outlineScores.write(into: &result)
      do {
        try log?.append(result)
      } catch {
        status = "results log write failed: \(error)"
      }
    }

    private static func describe(_ reason: CaptureAnywayReason) -> String {
      switch reason {
      case .surfaceTip: "surface-tip"
      case .tryHangerMode: "try-hanger-mode"
      case .hint(let hint): hint.rawValue
      }
    }

    private static func describe(_ shutter: ShutterState) -> String {
      switch shutter {
      case .idle: "idle"
      case .warmingUp: "warming-up"
      case .locked(let reason): "locked:\(reason.rawValue)"
      case .unlocked: "unlocked"
      case .capturing: "capturing"
      case .cooldown: "cooldown"
      }
    }
  }

  extension CaptureDebugHarness: CaptureFrameSetListener {
    func frameSetSegmentStarted(_ set: CaptureFrameIndex.FrameSet, segment: Int, atMs: Int) {
      flush()
      playingSet = set
      segmentStartMs = atMs
      let source = set.segments[segment]
      current = CaptureSegmentResult(
        setId: set.id,
        segment: segment,
        family: set.family,
        mode: set.mode,
        kind: set.kind,
        variant: set.variant,
        expected: source.expected,
        sweep: options.sweep
      )
      // An outline already drawn belongs to the previous segment's mask; only later ones are scored.
      outlineScores = CaptureOutlineScores(drawnBefore: model?.camera?.outline)
      record(model?.camera)
    }

    func frameSetFinished(_ set: CaptureFrameIndex.FrameSet) {
      flush()
      resumeSweep()
    }

    func frameSetStopped(_ set: CaptureFrameIndex.FrameSet) {
      flush()
    }

    func frameSetFailed(_ set: CaptureFrameIndex.FrameSet, reason: String) {
      status = "\(set.id): \(reason)"
      resumeSweep()
    }

    private func resumeSweep() {
      let continuation = caseFinished
      caseFinished = nil
      continuation?.resume()
    }
  }

  /// The live outline's scores over one segment (results log).
  struct CaptureOutlineScores {
    private var last: CaptureLiveOutlineState?
    /// The first scored outline is compared with this one for stability, but not counted or scored.
    init(drawnBefore: CaptureLiveOutlineState? = nil) {
      last = drawnBefore
    }

    private var updates = 0
    private var snaps = 0
    private var ious: [Double] = []
    private var stabilities: [Double] = []

    /// True when `outline` differs from the last one scored (a new mask update).
    func isNew(_ outline: CaptureLiveOutlineState) -> Bool { outline != last }

    mutating func add(_ outline: CaptureLiveOutlineState, reference: CaptureGrayImage?) {
      updates += 1
      if let last {
        if outline.snapCount != last.snapCount {
          snaps += 1
        } else {
          stabilities.append(
            CaptureOutlineGeometry.intersectionOverUnion(
              CaptureOutlineGeometry.centred(outline.points), CaptureOutlineGeometry.centred(last.points)))
        }
      }
      if let reference {
        let ious = CaptureInstanceLabels.instances(in: reference).compactMap { instance in
          CaptureInstanceLabels.mask(of: instance.label, in: reference).map {
            CaptureOutlineGeometry.intersectionOverUnion(outline.points, mask: $0)
          }
        }
        if let best = ious.max() { self.ious.append(best) }
      }
      last = outline
    }

    func write(into result: inout CaptureSegmentResult) {
      result.outlineUpdates = updates
      result.outlineSnaps = snaps
      result.outlineIouMedian = Self.median(ious)
      result.outlineIouMin = ious.min()
      result.outlineStabilityMedian = Self.median(stabilities)
      result.outlineStabilityMin = stabilities.min()
    }

    private static func median(_ values: [Double]) -> Double? {
      let sorted = values.sorted()
      return sorted.isEmpty ? nil : sorted[sorted.count / 2]
    }
  }

  /// The camera the flow gets in Dev: at each start, the selected frame set, else the real camera.
  @Observable
  final class CaptureSwitchableCamera: CaptureCamera {
    @ObservationIgnored private let live = LiveCaptureCamera()
    @ObservationIgnored private let harness: CaptureDebugHarness
    private var frameCamera: CaptureFrameSetCamera?

    init(harness: CaptureDebugHarness) {
      self.harness = harness
    }

    private var active: any CaptureCamera { frameCamera ?? live }

    var preview: CapturePreview { active.preview }
    var hasTorch: Bool { active.hasTorch }
    var isTorchOn: Bool { active.isTorchOn }

    func start(for setup: CaptureCameraSetup) async -> CaptureCameraAvailability {
      frameCamera = harness.makeFrameCamera()
      return await active.start(for: setup)
    }

    func stop() { active.stop() }
    func update(for setup: CaptureCameraSetup) { active.update(for: setup) }
    func takePhoto() async throws -> UIImage { try await active.takePhoto() }
    func setTorch(_ isOn: Bool) { active.setTorch(isOn) }
    func observations() -> AsyncStream<CaptureObservation> { active.observations() }
  }
#endif
