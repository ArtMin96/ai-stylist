// The camera the capture screens drive (capture brief §1, §7): the live AVFoundation camera, or the Dev
// build's test-frame source (CaptureDebug). Both feed `CaptureObservationSource`, so the same rules, lock
// machine and screens run on either. `CaptureHarness` is the Dev build's hook into the flow; production
// passes none.
#if os(iOS)
  public import AVFoundation
  public import CaptureModel
  public import CoreGraphics
  public import Observation
  public import UIKit

  /// Whether the camera can run (capture brief §7: permission denied C23, no camera at all).
  nonisolated public enum CaptureCameraAvailability: Equatable, Sendable {
    case ready
    case permissionDenied
    case noCamera
  }

  /// A photo request failed or was interrupted.
  nonisolated public struct CaptureCameraError: Error, Equatable, Sendable {
    public let reason: String

    public init(_ reason: String) {
      self.reason = reason
    }
  }

  /// The frame the debug source shows in the preview, moved by its playback jitter.
  @Observable
  public final class CaptureFramePreview {
    public var image: CGImage?
    /// The jitter offset as a share of the frame (right and down are positive).
    public var offset = CGSize.zero

    public init() {}
  }

  /// What the preview area draws.
  public enum CapturePreview {
    /// Not started yet, or stopped.
    case none
    /// The live session (an `AVCaptureVideoPreviewLayer`).
    case session(AVCaptureSession)
    /// Still frames from the debug source.
    case frames(CaptureFramePreview)
  }

  /// A camera the capture screen runs. Main-actor isolated: the screen calls it, and each implementation
  /// moves its own heavy work off the main actor.
  @MainActor
  public protocol CaptureCamera: CaptureObservationSource, AnyObject, Sendable {
    /// Asks for permission when needed and starts delivering frames.
    func start(for setup: CaptureCameraSetup) async -> CaptureCameraAvailability
    /// Stops frames and analysis; nothing is kept.
    func stop()
    /// The mode changed (worn mode turns the body-pose check on).
    func update(for setup: CaptureCameraSetup)
    /// Takes one photo. Kept in memory only (v1 saves nothing).
    func takePhoto() async throws -> UIImage
    var preview: CapturePreview { get }
    /// True when the device has a torch (`cap-camera-torch` shows only then).
    var hasTorch: Bool { get }
    var isTorchOn: Bool { get }
    func setTorch(_ isOn: Bool)
  }

  /// The Dev build's hooks into the capture flow (CaptureDebug implements it; Preview and Prod pass nil).
  @MainActor
  public protocol CaptureHarness: AnyObject, Sendable {
    /// The camera for the flow, or nil for the live camera.
    func makeCamera() -> (any CaptureCamera)?
    /// The clock for the flow's model, or nil for `ContinuousCaptureClock`.
    var clock: (any CaptureClock)? { get }
    /// The screen-reader flag (`captureScreenReader=1`): behave as if VoiceOver were on.
    var forcesScreenReader: Bool { get }
    /// The flow's model was created; a sweep drives it from here.
    func attach(to model: CaptureModel)
    /// A hint was spoken (the debug spoken log, `cap-debug-spoken-log`).
    func spoke(_ text: String)
    /// The camera output after an input, for the results log.
    func cameraChanged(_ output: CaptureCameraOutput?)
    /// True when the harness records the capture and the camera carries on (sweep, brief §11).
    func recordsCapture(_ trigger: CaptureTrigger) -> Bool
  }
#endif
