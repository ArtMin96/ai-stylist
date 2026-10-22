// The shutter lock state machine of capture brief §4. Pure: it reads verdicts and times from its
// caller (the injected clock), never wall time. Counts and durations come from `CaptureRules.Lock` and
// `CaptureRules.Batch`. `nonisolated` pure values, so they can be built and compared off the main actor.
public import AIStylistKernel

/// The shutter's state (capture brief §4 "States").
nonisolated public enum ShutterState: Equatable, Sendable {
  /// Not started, or in the background.
  case idle
  /// Camera ready, no evaluation yet. Locked.
  case warmingUp
  /// Locked by the highest-priority failing blocking check.
  case locked(CaptureLockReason)
  /// Manual shutter on; the ring fills from 0 to 1.
  case unlocked(progress: Double)
  /// Photo requested; all input is ignored.
  case capturing
  /// Batch only, after a capture: locked until the next item.
  case cooldown
}

/// What started a capture.
nonisolated public enum CaptureTrigger: String, CaseIterable, Sendable {
  case auto
  case manual
  case anyway
  case hardware
}

/// A transition the caller reacts to (haptic, speech, capture request).
nonisolated public enum ShutterTransition: Equatable, Sendable {
  case unlocked
  case relocked
  case autoCapture
  case cooldownEnded
}

/// The lock machine. Feed it one verdict per evaluation with the clock time of that evaluation.
nonisolated public struct ShutterLock: Sendable {
  public private(set) var state: ShutterState = .idle
  /// The reason shown while locked: the latest failing check's, `noItem` before any.
  public private(set) var lastLockReason: CaptureLockReason = .noItem

  private var passingStreak = 0
  /// The mask of the last passing evaluation counted while locked; nil when masks carry no time.
  private var lastPassingMaskMs: Int?
  private var failingStreak = 0
  private var ringElapsedMs = 0
  private var ringEvaluations = 0
  private var previousEvaluationPassedAtMs: Int?
  private var capturedBox: NormalizedRect?
  private var noItemStreak = 0
  private var newItemStreak = 0

  public init() {}

  /// Ring fill, 0–1: time of consecutive passing evaluations since the unlock ÷ `ringFillMs`. Full
  /// while capturing (the surface brief draws the capturing shutter with a full ring).
  public var ringProgress: Double {
    switch state {
    case .unlocked(let progress): progress
    case .capturing: 1
    case .idle, .warmingUp, .locked, .cooldown: 0
    }
  }

  /// `cameraReady` and `foregrounded`: warming up, every counter reset.
  public mutating func start() {
    resetCounters()
    lastLockReason = .noItem
    state = .warmingUp
  }

  /// `backgrounded`: the camera and analysis stop; nothing is half-saved.
  public mutating func stop() {
    resetCounters()
    state = .idle
  }

  /// Applies one evaluation. `itemBox` is the evaluated item's box (cooldown compares it with the
  /// captured box); nil when no item was found. `maskTimestampMs` is the time of the mask the verdict
  /// read; nil means a fresh mask on every evaluation.
  public mutating func evaluate(
    _ verdict: CaptureVerdict,
    itemBox: NormalizedRect?,
    atMs now: Int,
    maskTimestampMs: Int? = nil
  ) -> ShutterTransition? {
    if let reason = verdict.lockReason {
      lastLockReason = reason
    }
    switch state {
    case .idle, .capturing:
      return nil
    case .cooldown:
      return evaluateCooldown(itemBox: itemBox)
    case .warmingUp, .locked:
      return evaluateLocked(verdict, atMs: now, maskTimestampMs: maskTimestampMs)
    case .unlocked:
      return evaluateUnlocked(verdict, atMs: now)
    }
  }

  /// Starts a capture (manual, hardware or anyway). The caller decides whether the trigger is allowed;
  /// this only refuses when there is no live camera to capture from.
  public mutating func beginCapture() -> Bool {
    switch state {
    case .warmingUp, .locked, .unlocked:
      state = .capturing
      return true
    case .idle, .capturing, .cooldown:
      return false
    }
  }

  /// The photo was taken. Single flow: the camera closes for review (`idle`). Batch: `cooldown` until
  /// the next item; `box` is the captured item's box, if one was seen.
  public mutating func captureFinished(isBatch: Bool, box: NormalizedRect?) {
    guard state == .capturing else { return }
    resetCounters()
    if isBatch {
      capturedBox = box
      state = .cooldown
    } else {
      state = .idle
    }
  }

  /// The photo request failed: back to locked so the user can try again.
  public mutating func captureFailed() {
    guard state == .capturing else { return }
    resetCounters()
    state = .locked(lastLockReason)
  }

  /// "Next item" in batch cooldown.
  public mutating func nextItem() -> ShutterTransition? {
    guard state == .cooldown else { return nil }
    resetCounters()
    state = .locked(lastLockReason)
    return .cooldownEnded
  }

  /// `modeChanged`: counters reset to locked. Warming up, capturing and cooldown are unaffected.
  public mutating func modeChanged() {
    switch state {
    case .locked, .unlocked:
      resetCounters()
      state = .locked(lastLockReason)
    case .idle, .warmingUp, .capturing, .cooldown:
      break
    }
  }

  // MARK: - Transitions

  private mutating func evaluateLocked(
    _ verdict: CaptureVerdict,
    atMs now: Int,
    maskTimestampMs: Int?
  ) -> ShutterTransition? {
    guard verdict.passes else {
      passingStreak = 0
      lastPassingMaskMs = nil
      state = .locked(lastLockReason)
      return nil
    }
    // A passing evaluation that reads the same mask as the last one adds no new evidence (the phone's
    // mask comes every 250 ms, evaluations every 100 ms): the streak holds, so an unlock needs
    // `unlockAfterPassingEvaluations` distinct masks, not one chance-still mask read three times.
    if let maskTimestampMs, maskTimestampMs == lastPassingMaskMs {
      if state == .warmingUp {
        state = .locked(lastLockReason)
      }
      return nil
    }
    lastPassingMaskMs = maskTimestampMs
    passingStreak += 1
    guard passingStreak >= CaptureRules.Lock.unlockAfterPassingEvaluations else {
      if state == .warmingUp {
        state = .locked(lastLockReason)
      }
      return nil
    }
    resetCounters()
    // The ring counts from the unlock.
    previousEvaluationPassedAtMs = now
    state = .unlocked(progress: 0)
    return .unlocked
  }

  private mutating func evaluateUnlocked(_ verdict: CaptureVerdict, atMs now: Int) -> ShutterTransition? {
    guard verdict.passes else {
      // One failing evaluation pauses the ring (no advance, no reset); enough of them relock.
      previousEvaluationPassedAtMs = nil
      failingStreak += 1
      guard failingStreak >= CaptureRules.Lock.relockAfterFailingEvaluations else { return nil }
      resetCounters()
      state = .locked(lastLockReason)
      return .relocked
    }
    failingStreak = 0
    ringEvaluations += 1
    if let previous = previousEvaluationPassedAtMs {
      ringElapsedMs += max(0, now - previous)
    }
    previousEvaluationPassedAtMs = now
    let isFull =
      ringElapsedMs >= CaptureRules.Lock.ringFillMs && ringEvaluations >= CaptureRules.Lock.ringMinEvaluations
    guard isFull else {
      state = .unlocked(progress: min(1, Double(ringElapsedMs) / Double(CaptureRules.Lock.ringFillMs)))
      return nil
    }
    state = .capturing
    return .autoCapture
  }

  private mutating func evaluateCooldown(itemBox: NormalizedRect?) -> ShutterTransition? {
    if let itemBox {
      noItemStreak = 0
      let overlap = capturedBox.map { itemBox.intersectionOverUnion(with: $0) } ?? 0
      newItemStreak = overlap < CaptureRules.Batch.newItemBelowIou ? newItemStreak + 1 : 0
    } else {
      newItemStreak = 0
      noItemStreak += 1
    }
    let exits = CaptureRules.Batch.cooldownExitEvaluations
    guard noItemStreak >= exits || newItemStreak >= exits else { return nil }
    resetCounters()
    state = .locked(lastLockReason)
    return .cooldownEnded
  }

  private mutating func resetCounters() {
    passingStreak = 0
    lastPassingMaskMs = nil
    failingStreak = 0
    ringElapsedMs = 0
    ringEvaluations = 0
    previousEvaluationPassedAtMs = nil
    capturedBox = nil
    noItemStreak = 0
    newItemStreak = 0
  }
}
