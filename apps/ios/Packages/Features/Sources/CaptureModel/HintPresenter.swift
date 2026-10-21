// Hint hysteresis (capture brief §5 "Hint change"): a proposed hint replaces the shown one only after
// it held for `hintHoldEvaluations` consecutive evaluations and the shown one has been visible for
// `hintMinVisibleMs`. State announcements (guide, ready, capturing, next item) replace it at once.
// `nonisolated` pure value, part of the session state (see AnywayTimer.swift).
public import AIStylistKernel

/// The one hint on screen.
nonisolated public struct HintPresenter: Sendable {
  public private(set) var shown: CaptureHint?
  private var shownSinceMs = 0
  private var pending: CaptureHint?
  private var pendingEvaluations = 0

  public init() {}

  /// Shows `hint` at once. Returns true when the shown hint changed.
  public mutating func show(_ hint: CaptureHint, atMs now: Int) -> Bool {
    pending = nil
    pendingEvaluations = 0
    guard hint != shown else { return false }
    shown = hint
    shownSinceMs = now
    return true
  }

  /// Proposes the hint of one evaluation; nil keeps the shown hint. Returns true when the shown hint
  /// changed.
  public mutating func propose(_ candidate: CaptureHint?, atMs now: Int) -> Bool {
    guard let candidate, candidate != shown else {
      pending = nil
      pendingEvaluations = 0
      return false
    }
    if candidate == pending {
      pendingEvaluations += 1
    } else {
      pending = candidate
      pendingEvaluations = 1
    }
    guard
      pendingEvaluations >= CaptureRules.Timing.hintHoldEvaluations,
      now - shownSinceMs >= CaptureRules.Timing.hintMinVisibleMs
    else { return false }
    return show(candidate, atMs: now)
  }

  /// Clears the hint (camera stopped).
  public mutating func clear() {
    shown = nil
    pending = nil
    pendingEvaluations = 0
  }
}
