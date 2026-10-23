// "Take photo anyway" timing (capture brief §5): shown after `CaptureRules.Timing.anywayDelayMs` of
// foreground time since the timer started, at once with a screen reader or in the pose-model
// fallback. Lock/unlock flips and mode changes never touch it. A `nonisolated` pure value, like the rest
// of the session state, so `CaptureCameraSession` stays usable off the main actor.
import AIStylistKernel

/// When "Take photo anyway" is visible.
nonisolated public struct AnywayTimer: Sendable {
  private var startedAtMs: Int?
  private var isShown = false
  private var isScreenReaderOn: Bool

  public init(screenReaderOn: Bool = false) {
    isScreenReaderOn = screenReaderOn
  }

  /// Visible now. Once shown it stays until the timer restarts or stops.
  public var isVisible: Bool { isShown }

  /// Starts or restarts the count: `cameraReady`, the back or pair step, after each batch capture and
  /// on return from the background.
  public mutating func start(atMs now: Int) {
    startedAtMs = now
    isShown = false
    update(atMs: now)
  }

  /// `backgrounded`: no foreground time passes.
  public mutating func stop() {
    startedAtMs = nil
    isShown = false
  }

  /// Screen reader (or the debug flag) on: visible at once while the timer runs.
  public mutating func setScreenReader(_ isOn: Bool, atMs now: Int) {
    isScreenReaderOn = isOn
    update(atMs: now)
  }

  /// A platform model is unavailable (doc-10 fallback): visible at once.
  public mutating func showNow() {
    guard startedAtMs != nil else { return }
    isShown = true
  }

  /// Re-reads the clock (every tick and evaluation).
  public mutating func update(atMs now: Int) {
    guard let startedAtMs, !isShown else { return }
    isShown = isScreenReaderOn || now - startedAtMs >= CaptureRules.Timing.anywayDelayMs
  }
}
