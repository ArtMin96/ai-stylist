// What the capture model needs from the platform, as protocols the app (phase B) implements: the
// clock, the on-device opt-in store and the observation source (live camera + Vision, or the debug
// test-frame source). The answer enum is `nonisolated` so a store may read it from any actor.

/// Monotonic milliseconds from a fixed origin. Injected, so tests drive every timing (capture brief §4).
public protocol CaptureClock {
  var nowMs: Int { get }
}

/// The app's clock: monotonic time since it was created (`ContinuousClock`, so it keeps counting while
/// the app is in the background, which the anyway timer handles by restarting on `foregrounded`).
public struct ContinuousCaptureClock: CaptureClock {
  private let origin = ContinuousClock.now

  public init() {}

  public var nowMs: Int {
    let elapsed = ContinuousClock.now - origin
    return Int(elapsed.components.seconds) * 1000 + Int(elapsed.components.attoseconds / 1_000_000_000_000_000)
  }
}

/// The answer to the underwear and swimwear opt-in sheet (`cap-optin-sheet`, capture brief §7 C19).
nonisolated public enum UnderwearWornOptIn: String, CaseIterable, Sendable {
  /// "Flat and hanger only" (`cap-optin-flat-only`).
  case flatAndHangerOnly
  /// "Also allow worn photos" (`cap-optin-allow-worn`).
  case allowWorn
}

/// Keeps the opt-in answer on the device only (UserDefaults in the app): never sent, never in analytics.
public protocol UnderwearOptInStore {
  /// Nil until the user answers the sheet; worn photos stay off until then.
  func load() -> UnderwearWornOptIn?
  func save(_ answer: UnderwearWornOptIn)
}

/// Where observations come from: the live camera with Vision, or the debug test-frame source. The app
/// reads the stream in the camera screen's `.task {}` and hands each observation to
/// `CaptureModel.submit(_:)`; cancelling that task stops the source.
public protocol CaptureObservationSource {
  /// Analysed frames, oldest first; ends when the source stops.
  func observations() -> AsyncStream<CaptureObservation>
}
