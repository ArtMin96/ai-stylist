// The capture flow's underwear and swimwear opt-in answer (capture brief §7 C19), kept on the device only
// in UserDefaults: never sent, never in analytics. Built by the composition root.
import CaptureModel
import Foundation

struct UserDefaultsUnderwearOptInStore: UnderwearOptInStore {
  /// The UserDefaults key; the value is `UnderwearWornOptIn.rawValue`.
  static let key = "capture.underwearWornOptIn"

  let defaults: UserDefaults

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  func load() -> UnderwearWornOptIn? {
    defaults.string(forKey: Self.key).flatMap(UnderwearWornOptIn.init(rawValue:))
  }

  func save(_ answer: UnderwearWornOptIn) {
    defaults.set(answer.rawValue, forKey: Self.key)
  }
}
