// The design system's copy: the String Catalog Resources/Localizable.xcstrings (source language en). Each
// key and value equals the Android string resource of the same name byte for byte, so the copy is never a
// Swift literal. `nonisolated`: a pure lookup, read by the nonisolated rules enums.
import Foundation

/// Reads this package's String Catalog.
nonisolated enum AppStrings {
  /// The catalog value of `key`; the key itself when the catalog has no such entry (the tests catch that).
  static func localized(_ key: String) -> String {
    String(localized: String.LocalizationValue(key), bundle: .module)
  }
}
