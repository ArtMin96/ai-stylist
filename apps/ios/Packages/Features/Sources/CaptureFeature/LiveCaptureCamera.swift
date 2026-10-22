// The live camera (capture brief §3, §7): AVCaptureSession with a photo output and a preview-sized video
// data output for analysis, the Vision foreground mask every `CaptureRules.Ios.maskIntervalMs`, Vision body
// pose in worn mode every `poseIntervalMs`, luma for light and sharpness, and CoreMotion for device motion
// and tilt. Nothing is saved: frames are measured and dropped, photos stay in memory.
//
// Isolation: AVCaptureSession is not Sendable, so it lives on the main actor (the preview layer needs it
// there). Building and starting it blocks, so `makeRunningGraph` is `@concurrent` and gets the new session
// back as a `sending` result before the main actor keeps it. Frames arrive on the analysis queue and are
// measured there by `LiveFrameProcessor`, a Sendable delegate whose state is behind a `Mutex`; only the
// Sendable `CaptureObservation` crosses to the main actor.
#if os(iOS)
  import AIStylistKernel
  public import AVFoundation
  public import CaptureModel
  import CoreMotion
  import Observation
  import Synchronization
  public import UIKit
  import Vision

  /// The AVFoundation camera with Vision analysis.
  @Observable
  public final class LiveCaptureCamera: CaptureCamera {
    public private(set) var preview: CapturePreview = .none
    public private(set) var hasTorch = false
    public private(set) var isTorchOn = false

    @ObservationIgnored private var graph: LiveCaptureGraph?
    @ObservationIgnored private let processor = LiveFrameProcessor()
    @ObservationIgnored private let motion = CMMotionManager()
    @ObservationIgnored private let motionQueue = OperationQueue()
    /// The photo request in flight, held until it answers. Not a cycle: it never references the camera.
    @ObservationIgnored private var pendingPhoto: PhotoCaptureDelegate?

    public init() {}

    public func observations() -> AsyncStream<CaptureObservation> {
      processor.makeStream()
    }

    public func start(for setup: CaptureCameraSetup) async -> CaptureCameraAvailability {
      processor.setWornMode(setup.mode == .worn)
      switch AVCaptureDevice.authorizationStatus(for: .video) {
      case .authorized:
        break
      case .notDetermined:
        guard await AVCaptureDevice.requestAccess(for: .video) else { return .permissionDenied }
      case .denied, .restricted:
        return .permissionDenied
      @unknown default:
        return .permissionDenied
      }
      if graph != nil { return .ready }
      let started: LiveCaptureGraph
      do {
        started = try await Self.makeRunningGraph(processor: processor)
      } catch {
        return .noCamera
      }
      graph = started
      hasTorch = started.device.hasTorch
      preview = .session(started.session)
      startMotion()
      return .ready
    }

    public func stop() {
      motion.stopDeviceMotionUpdates()
      processor.finish()
      if isTorchOn { setTorch(false) }
      graph?.session.stopRunning()
      graph = nil
      preview = .none
      pendingPhoto = nil
    }

    public func update(for setup: CaptureCameraSetup) {
      processor.setWornMode(setup.mode == .worn)
    }

    public func takePhoto() async throws -> UIImage {
      guard let graph else { throw CaptureCameraError("camera not running") }
      let delegate = PhotoCaptureDelegate()
      pendingPhoto = delegate
      defer { pendingPhoto = nil }
      let data = try await withCheckedThrowingContinuation { continuation in
        delegate.begin(continuation)
        graph.photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: delegate)
      }
      guard let image = UIImage(data: data) else { throw CaptureCameraError("unreadable photo") }
      return image
    }

    public func setTorch(_ isOn: Bool) {
      guard let device = graph?.device, device.hasTorch else { return }
      do {
        try device.lockForConfiguration()
        device.torchMode = isOn ? .on : .off
        device.unlockForConfiguration()
        isTorchOn = isOn
      } catch {
        isTorchOn = device.torchMode == .on
      }
    }

    private func startMotion() {
      guard motion.isDeviceMotionAvailable else { return }
      motion.deviceMotionUpdateInterval = Double(CaptureRules.Evaluation.intervalMs) / 1000
      motion.startDeviceMotionUpdates(to: motionQueue, withHandler: Self.motionHandler(for: processor))
    }

    /// Built outside the main actor: CoreMotion calls it on `motionQueue`.
    nonisolated private static func motionHandler(for processor: LiveFrameProcessor) -> CMDeviceMotionHandler {
      { motion, _ in
        guard let motion else { return }
        let acceleration = motion.userAcceleration
        let rotation = motion.rotationRate
        let gravity = motion.gravity
        let gravityLength = (gravity.x * gravity.x + gravity.y * gravity.y + gravity.z * gravity.z).squareRoot()
        // The phone's back axis is -z; flat above the item, gravity points along it (0°).
        let tilt = gravityLength > 0 ? acos(max(-1, min(1, -gravity.z / gravityLength))) * 180 / .pi : 0
        processor.setMotion(
          CaptureDeviceMotion(
            userAccelerationG: (acceleration.x * acceleration.x + acceleration.y * acceleration.y
              + acceleration.z * acceleration.z).squareRoot(),
            rotationRateRadPerS: (rotation.x * rotation.x + rotation.y * rotation.y + rotation.z * rotation.z)
              .squareRoot()
          ),
          tiltDegrees: tilt
        )
      }
    }

    /// Builds the session and starts it. `@concurrent` because `startRunning()` blocks; the session goes
    /// back to the main actor as `sending`, so no other reference to it stays behind.
    @concurrent nonisolated private static func makeRunningGraph(
      processor: LiveFrameProcessor
    ) async throws -> sending LiveCaptureGraph {
      guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
        throw CaptureCameraError("no camera")
      }
      let input = try AVCaptureDeviceInput(device: device)
      let session = AVCaptureSession()
      let photoOutput = AVCapturePhotoOutput()
      let videoOutput = AVCaptureVideoDataOutput()
      session.beginConfiguration()
      session.sessionPreset = .photo
      guard session.canAddInput(input), session.canAddOutput(photoOutput), session.canAddOutput(videoOutput)
      else {
        session.commitConfiguration()
        throw CaptureCameraError("camera configuration failed")
      }
      session.addInput(input)
      session.addOutput(photoOutput)
      videoOutput.alwaysDiscardsLateVideoFrames = true
      videoOutput.deliversPreviewSizedOutputBuffers = true
      videoOutput.videoSettings = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
      ]
      videoOutput.setSampleBufferDelegate(processor, queue: processor.queue)
      session.addOutput(videoOutput)
      // Portrait buffers and photos, so normalised coordinates match the screen (origin top-left).
      for connection in [videoOutput.connection(with: .video), photoOutput.connection(with: .video)] {
        if let connection, connection.isVideoRotationAngleSupported(90) {
          connection.videoRotationAngle = 90
        }
      }
      session.commitConfiguration()
      session.startRunning()
      return LiveCaptureGraph(session: session, device: device, photoOutput: photoOutput)
    }
  }

  /// The running session and the parts the camera keeps using. `nonisolated`: built off the main actor in
  /// `makeRunningGraph`, then sent to it.
  nonisolated struct LiveCaptureGraph {
    let session: AVCaptureSession
    let device: AVCaptureDevice
    let photoOutput: AVCapturePhotoOutput
  }

  /// Measures video frames on the analysis queue and streams observations. Sendable: every mutable value
  /// sits in `state` behind a `Mutex`.
  nonisolated final class LiveFrameProcessor: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, Sendable {
    let queue = DispatchQueue(label: "app.aistylist.capture.analysis", qos: .userInitiated)
    private let state = Mutex(State())

    private struct State {
      var continuation: AsyncStream<CaptureObservation>.Continuation?
      var isWornMode = false
      var lastEmitMs: Int?
      var lastMaskMs: Int?
      var lastPoseMs: Int?
      var foreground: CaptureForeground?
      var bodyPose = CaptureBodyPose.notRun
      var motion: CaptureDeviceMotion?
      var tiltDegrees: Double?
    }

    /// A new observation stream; it replaces (and ends) the previous one.
    func makeStream() -> AsyncStream<CaptureObservation> {
      let (stream, continuation) = AsyncStream.makeStream(
        of: CaptureObservation.self,
        bufferingPolicy: .bufferingNewest(1)
      )
      let previous = state.withLock { state in
        let previous = state.continuation
        state = State(continuation: continuation, isWornMode: state.isWornMode)
        return previous
      }
      previous?.finish()
      return stream
    }

    func finish() {
      let continuation = state.withLock { state in
        let continuation = state.continuation
        state.continuation = nil
        return continuation
      }
      continuation?.finish()
    }

    func setWornMode(_ isWorn: Bool) {
      state.withLock { state in
        state.isWornMode = isWorn
        state.bodyPose = .notRun
        state.lastPoseMs = nil
      }
    }

    func setMotion(_ motion: CaptureDeviceMotion, tiltDegrees: Double) {
      state.withLock { state in
        state.motion = motion
        state.tiltDegrees = tiltDegrees
      }
    }

    func captureOutput(
      _ output: AVCaptureOutput,
      didOutput sampleBuffer: CMSampleBuffer,
      from connection: AVCaptureConnection
    ) {
      guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
      let nowMs = Int(CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds * 1000)
      let plan = state.withLock { state -> (runsMask: Bool, runsPose: Bool)? in
        guard state.continuation != nil else { return nil }
        if let last = state.lastEmitMs, nowMs - last < CaptureRules.Evaluation.intervalMs { return nil }
        state.lastEmitMs = nowMs
        let runsMask = state.lastMaskMs.map { nowMs - $0 >= CaptureRules.Ios.maskIntervalMs } ?? true
        let poseIsDue = state.lastPoseMs.map { nowMs - $0 >= CaptureRules.Ios.poseIntervalMs } ?? true
        let runsPose = state.isWornMode && poseIsDue
        if runsMask { state.lastMaskMs = nowMs }
        if runsPose { state.lastPoseMs = nowMs }
        return (runsMask, runsPose)
      }
      guard let plan else { return }
      let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up)
      let foreground = plan.runsMask ? CaptureVision.foreground(using: handler) : nil
      let pose = plan.runsPose ? CaptureVision.bodyPose(using: handler) : nil
      let luma = CaptureImageReader.gray(
        from: pixelBuffer,
        plane: 0,
        longSide: CaptureRules.Steady.sharpnessLongSidePx
      )
      guard let luma else { return }
      let (observation, continuation) = state.withLock { state in
        if plan.runsMask { state.foreground = foreground }
        if let pose { state.bodyPose = pose }
        let item = state.foreground.map {
          CaptureItemObservation(
            box: $0.measure.box,
            maskAreaShare: $0.measure.maskAreaShare,
            edgeContact: $0.measure.edgeContact,
            instanceCount: $0.instanceCount,
            otherBoxes: $0.otherBoxes,
            sharpness: CaptureLumaMetrics.sharpness(of: luma, inside: $0.measure.box)
          )
        }
        let observation = CaptureObservation(
          timestampMs: nowMs,
          item: item,
          meanLuma: CaptureLumaMetrics.meanLuma(of: luma),
          clippedShare: CaptureLumaMetrics.clippedShare(of: luma),
          deviceMotion: state.motion,
          tiltDegrees: state.tiltDegrees,
          bodyPose: state.isWornMode ? state.bodyPose : .notRun
        )
        return (observation, state.continuation)
      }
      continuation?.yield(observation)
    }
  }

  /// Delivers one photo's encoded data to the waiting `takePhoto()`.
  nonisolated final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate, Sendable {
    private let continuation = Mutex<CheckedContinuation<Data, any Error>?>(nil)

    func begin(_ continuation: CheckedContinuation<Data, any Error>) {
      self.continuation.withLock { $0 = continuation }
    }

    func photoOutput(
      _ output: AVCapturePhotoOutput,
      didFinishProcessingPhoto photo: AVCapturePhoto,
      error: (any Error)?
    ) {
      let waiting = continuation.withLock { value in
        let waiting = value
        value = nil
        return waiting
      }
      if let error {
        waiting?.resume(throwing: error)
      } else if let data = photo.fileDataRepresentation() {
        waiting?.resume(returning: data)
      } else {
        waiting?.resume(throwing: CaptureCameraError("no photo data"))
      }
    }
  }
#endif
