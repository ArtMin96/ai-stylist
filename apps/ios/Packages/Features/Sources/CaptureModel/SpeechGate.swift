// Spoken hints (capture brief §5 "Speech", Q-B): only with a screen reader on or the speaker button
// (`cap-camera-speech`) on; only on a hint change; at least `speechMinGapMs` between utterances; the
// same line not again within `speechRepeatWindowMs`. A change inside the gap waits for the gap to end
// (the latest change wins), so the user always hears the current hint. `nonisolated` pure value, part of
// the session state (see AnywayTimer.swift).
import AIStylistKernel

/// Decides which hint changes are spoken, and when.
nonisolated public struct SpeechGate: Sendable {
  public private(set) var isScreenReaderOn: Bool
  public private(set) var isSpeechToggledOn = false
  private var lastSpokenAtMs: Int?
  private var lastSpokenAtByLine: [CaptureUtterance: Int] = [:]
  private var waiting: CaptureUtterance?

  public init(screenReaderOn: Bool = false) {
    isScreenReaderOn = screenReaderOn
  }

  /// Speech is on: screen reader, or the speaker button.
  public var isEnabled: Bool { isScreenReaderOn || isSpeechToggledOn }

  public mutating func setScreenReader(_ isOn: Bool) {
    isScreenReaderOn = isOn
    if !isEnabled { waiting = nil }
  }

  public mutating func setSpeechToggle(_ isOn: Bool) {
    isSpeechToggledOn = isOn
    if !isEnabled { waiting = nil }
  }

  /// The shown hint changed to `line`. Returns the line to speak now, or nil.
  public mutating func hintChanged(to line: CaptureUtterance, atMs now: Int) -> CaptureUtterance? {
    // §6: the warming-up hint has no spoken text.
    guard isEnabled, line.hint != .warmingUp else {
      waiting = nil
      return nil
    }
    waiting = line
    return update(atMs: now)
  }

  /// Speaks the waiting line once the gap has passed. Returns the line to speak now, or nil.
  public mutating func update(atMs now: Int) -> CaptureUtterance? {
    guard let line = waiting else { return nil }
    if let lastSpokenAtMs, now - lastSpokenAtMs < CaptureRules.Timing.speechMinGapMs {
      return nil
    }
    waiting = nil
    if let lastSameLine = lastSpokenAtByLine[line], now - lastSameLine < CaptureRules.Timing.speechRepeatWindowMs {
      return nil
    }
    lastSpokenAtMs = now
    lastSpokenAtByLine[line] = now
    return line
  }
}
