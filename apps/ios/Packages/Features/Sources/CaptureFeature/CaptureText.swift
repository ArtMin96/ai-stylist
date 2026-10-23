// The capture camera's copy (capture brief §2, §6, §7, §8; surface brief sc16 "Copy"): read from the String
// Catalog Resources/Localizable.xcstrings, never a Swift literal. Hint keys are the registry's hint keys
// (`CaptureHint.rawValue`, also the label's test ID), so both apps key the same text the same way.
// Foundation only: it builds on macOS too, so CaptureFeatureTests check every key under `swift test`.
// `nonisolated`: pure lookups, called from the effect performer and the debug harness alike.
public import AIStylistKernel
public import CaptureModel
import Foundation

/// Every user-facing string of the capture flow.
nonisolated public enum CaptureText {
  /// The catalog value of `key`; the key itself when the catalog has no entry (the tests catch that).
  public static func localized(_ key: String) -> String {
    String(localized: String.LocalizationValue(key), bundle: .module)
  }

  /// The catalog value of `key` with `arguments` filled in (`%@`, `%lld`).
  public static func formatted(_ key: String, _ arguments: any CVarArg...) -> String {
    String(format: localized(key), locale: Locale.current, arguments: arguments)
  }

  // MARK: - Hints (§6)

  /// The hint label's text. `cap-hint-guide` shows the family instruction of `guide`.
  public static func hint(_ hint: CaptureHint, guide: CaptureGuide) -> String {
    hint == .guide ? instruction(for: guide) : localized(hint.rawValue)
  }

  /// The spoken line (§6 "Spoken"); the guide line reads the family instruction.
  public static func spoken(_ utterance: CaptureUtterance) -> String {
    if utterance.hint == .guide, let guide = utterance.guide {
      return instruction(for: guide)
    }
    return localized("\(utterance.hint.rawValue).spoken")
  }

  /// The family instruction (§6 "Family instructions"): front by mode, or the back or pair step.
  public static func instruction(for guide: CaptureGuide) -> String {
    localized(instructionKey(for: guide))
  }

  /// The catalog key of a family instruction.
  public static func instructionKey(for guide: CaptureGuide) -> String {
    switch guide.side {
    case .front: "capture.guide.\(guide.family.rawValue).\(guide.mode.rawValue)"
    case .back: "capture.guide.\(guide.family.rawValue).back"
    case .pair: "capture.guide.\(guide.family.rawValue).pair"
    }
  }

  /// The "Take photo anyway" reason line (`cap-anyway-reason`).
  public static func anywayReason(_ reason: CaptureAnywayReason, guide: CaptureGuide) -> String {
    switch reason {
    case .surfaceTip: localized("capture.anyway.reason.surface")
    case .tryHangerMode: localized("capture.anyway.reason.hanger")
    case .hint(let hint): self.hint(hint, guide: guide)
    }
  }

  /// The shutter's accessibility label: "Take photo", or why it is locked (§8).
  public static func shutterLabel(lockedBecause hintText: String?) -> String {
    guard let hintText else { return localized("capture.shutter") }
    return formatted("capture.shutter.unavailable", hintText)
  }

  // MARK: - Picker (§2)

  /// A family tile's label.
  public static func familyLabel(_ family: CaptureShapeFamily) -> String {
    localized("capture.family.\(family.rawValue)")
  }

  /// A family tile's subtitle, where §2 gives one.
  public static func familySubtitle(_ family: CaptureShapeFamily) -> String? {
    let key = "capture.family.\(family.rawValue).subtitle"
    let value = localized(key)
    return value == key ? nil : value
  }

  /// An underwear sub-pick's label.
  public static func underwearLabel(_ pick: UnderwearPick) -> String {
    localized("capture.underwear.\(pick.rawValue)")
  }

  /// A capture mode's label on the mode switch.
  public static func modeLabel(_ mode: CaptureMode) -> String {
    localized("capture.mode.\(mode.rawValue)")
  }

  /// "3 items" on the batch count chip and the summary title.
  public static func itemCount(_ count: Int) -> String {
    count == 1 ? localized("capture.batch.count.one") : formatted("capture.batch.count.other", count)
  }
}
