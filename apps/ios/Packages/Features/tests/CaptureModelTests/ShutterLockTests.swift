// The lock state machine of capture brief §4, one test per transition, timed with explicit clock values.
import AIStylistKernel
import CaptureModel
import Testing

private let pass = CaptureVerdict(blockingHints: [], advisoryHints: [])

private func fail(_ hint: CaptureHint = .notSteady) -> CaptureVerdict {
  CaptureVerdict(blockingHints: [hint], advisoryHints: [])
}

private let unlockCount = CaptureRules.Lock.unlockAfterPassingEvaluations
private let relockCount = CaptureRules.Lock.relockAfterFailingEvaluations
private let ringMs = CaptureRules.Lock.ringFillMs

/// Feeds verdicts one evaluation step apart, keeps the clock and the last transition.
private struct LockDriver {
  var lock = ShutterLock()
  var now = 0
  /// The transition of the last evaluation fed.
  var transition: ShutterTransition?

  init() {
    lock.start()
  }

  mutating func feed(
    _ verdict: CaptureVerdict,
    times: Int = 1,
    box: NormalizedRect? = goodBox,
    stepMs step: Int = stepMs
  ) {
    for _ in 0..<times {
      transition = lock.evaluate(verdict, itemBox: box, atMs: now)
      now += step
    }
  }

  /// Locked → unlocked with the minimum number of passing evaluations.
  mutating func unlock() {
    feed(pass, times: unlockCount)
  }

  mutating func capture() -> Bool {
    lock.beginCapture()
  }
}

@Suite("Shutter lock: locking and unlocking")
struct ShutterLockUnlockTests {
  @Test("starts idle and ignores evaluations until the camera is ready")
  func idleIgnoresEvaluations() {
    var lock = ShutterLock()
    #expect(lock.state == .idle)
    let transition = lock.evaluate(pass, itemBox: goodBox, atMs: 0)
    #expect(transition == nil)
    #expect(lock.state == .idle)
  }

  @Test("camera ready: warming up, locked")
  func cameraReadyWarmsUp() {
    #expect(LockDriver().lock.state == .warmingUp)
  }

  @Test("warming up → locked with the failing check's reason on the first evaluation")
  func firstFailingEvaluationLocks() {
    var driver = LockDriver()
    driver.feed(fail(.cutOffTop))
    #expect(driver.lock.state == .locked(.cutOff))
  }

  @Test("warming up → counting (still locked) on a first passing evaluation")
  func firstPassingEvaluationCounts() {
    var driver = LockDriver()
    driver.feed(pass)
    #expect(driver.lock.state == .locked(.noItem))
  }

  @Test("unlocks after exactly the brief's number of passing evaluations, not one fewer")
  func unlockAfterPassingStreak() {
    var driver = LockDriver()
    driver.feed(pass, times: unlockCount - 1)
    #expect(driver.transition == nil)
    #expect(driver.lock.state == .locked(.noItem))
    driver.feed(pass)
    #expect(driver.transition == .unlocked)
    #expect(driver.lock.state == .unlocked(progress: 0))
  }

  @Test("a failing evaluation restarts the passing count")
  func failRestartsPassingCount() {
    var driver = LockDriver()
    driver.feed(pass, times: unlockCount - 1)
    driver.feed(fail())
    driver.feed(pass, times: unlockCount - 1)
    #expect(driver.lock.state == .locked(.notSteady))
    driver.feed(pass)
    #expect(driver.transition == .unlocked)
  }

  @Test("the lock reason follows the latest failing evaluation")
  func reasonFollowsLatestFailure() {
    var driver = LockDriver()
    driver.feed(fail(.noItem))
    driver.feed(fail(.tooSmall))
    #expect(driver.lock.state == .locked(.tooSmall))
    #expect(driver.lock.lastLockReason == .tooSmall)
  }
}

@Suite("Shutter lock: the ring")
struct ShutterLockRingTests {
  @Test("the ring fills with passing time from the unlock and auto-captures when full")
  func ringFillsThenAutoCaptures() {
    var driver = LockDriver()
    driver.unlock()
    let steps = ringMs / stepMs
    driver.feed(pass, times: steps - 1)
    #expect(driver.transition == nil)
    #expect(driver.lock.ringProgress == Double((steps - 1) * stepMs) / Double(ringMs))
    driver.feed(pass)
    #expect(driver.transition == .autoCapture)
    #expect(driver.lock.state == .capturing)
    #expect(driver.lock.ringProgress == 1)
  }

  @Test("the ring also needs the minimum number of evaluations, however much time passed")
  func ringNeedsMinimumEvaluations() {
    var driver = LockDriver()
    driver.feed(pass, times: unlockCount, stepMs: ringMs / 2)
    driver.feed(pass, times: CaptureRules.Lock.ringMinEvaluations - 1, stepMs: ringMs / 2)
    #expect(driver.transition == nil)
    #expect(driver.lock.ringProgress == 1)
    driver.feed(pass, stepMs: ringMs / 2)
    #expect(driver.transition == .autoCapture)
  }

  @Test("one failing evaluation pauses the ring: no advance, no reset; it resumes after")
  func failPausesRing() {
    var driver = LockDriver()
    driver.unlock()
    driver.feed(pass)
    let before = driver.lock.ringProgress
    #expect(before > 0)
    driver.feed(fail())
    #expect(driver.lock.ringProgress == before)
    driver.feed(pass)
    #expect(driver.lock.ringProgress == before, "the first pass after a fail adds no time")
    driver.feed(pass)
    #expect(driver.lock.ringProgress > before)
  }

  @Test("relocks after the brief's number of failing evaluations, not one fewer; the ring resets")
  func relockAfterFailingStreak() {
    var driver = LockDriver()
    driver.unlock()
    driver.feed(pass, times: 2)
    driver.feed(fail(.tooSmall), times: relockCount - 1)
    #expect(driver.transition == nil)
    #expect(driver.lock.ringProgress > 0)
    driver.feed(fail(.tooSmall))
    #expect(driver.transition == .relocked)
    #expect(driver.lock.state == .locked(.tooSmall))
    #expect(driver.lock.ringProgress == 0)
  }

  @Test("failing evaluations must be consecutive to relock")
  func failingStreakMustBeConsecutive() {
    var driver = LockDriver()
    driver.unlock()
    driver.feed(fail(), times: relockCount - 1)
    driver.feed(pass)
    driver.feed(fail(), times: relockCount - 1)
    guard case .unlocked = driver.lock.state else {
      Issue.record("expected unlocked, got \(driver.lock.state)")
      return
    }
  }

  @Test("after a relock the full unlock count is needed again")
  func relockNeedsFullUnlockAgain() {
    var driver = LockDriver()
    driver.unlock()
    driver.feed(fail(), times: relockCount)
    driver.feed(pass, times: unlockCount - 1)
    #expect(driver.lock.state == .locked(.notSteady))
    driver.feed(pass)
    #expect(driver.transition == .unlocked)
  }
}

@Suite("Shutter lock: capture, cooldown, background, mode")
struct ShutterLockCaptureTests {
  @Test("a capture can start from warming up, locked or unlocked")
  func captureStartsFromLiveStates() {
    var warming = LockDriver()
    let fromWarming = warming.capture()
    var locked = LockDriver()
    locked.feed(fail())
    let fromLocked = locked.capture()
    var unlocked = LockDriver()
    unlocked.unlock()
    let fromUnlocked = unlocked.capture()
    #expect(fromWarming && fromLocked && fromUnlocked)
    #expect(unlocked.lock.state == .capturing)
  }

  @Test("no capture from idle, capturing or cooldown")
  func noCaptureFromOtherStates() {
    var idle = ShutterLock()
    let fromIdle = idle.beginCapture()
    var driver = LockDriver()
    _ = driver.capture()
    let fromCapturing = driver.capture()
    driver.lock.captureFinished(isBatch: true, box: goodBox)
    let fromCooldown = driver.capture()
    #expect(!fromIdle && !fromCapturing && !fromCooldown)
  }

  @Test("capturing ignores evaluations")
  func capturingIgnoresInput() {
    var driver = LockDriver()
    _ = driver.capture()
    driver.feed(fail(), times: relockCount)
    #expect(driver.transition == nil)
    #expect(driver.lock.state == .capturing)
  }

  @Test("capture finished: single flow stops the camera, batch enters cooldown")
  func captureFinished() {
    var single = LockDriver()
    _ = single.capture()
    single.lock.captureFinished(isBatch: false, box: goodBox)
    #expect(single.lock.state == .idle)
    var batch = LockDriver()
    _ = batch.capture()
    batch.lock.captureFinished(isBatch: true, box: goodBox)
    #expect(batch.lock.state == .cooldown)
  }

  @Test("a failed capture goes back to locked with the last reason")
  func captureFailedRelocks() {
    var driver = LockDriver()
    driver.feed(fail(.tooSmall))
    _ = driver.capture()
    driver.lock.captureFailed()
    #expect(driver.lock.state == .locked(.tooSmall))
  }

  @Test("cooldown ends after the brief's number of no-item evaluations, not one fewer")
  func cooldownEndsOnEmptyFrames() {
    var driver = cooledDown()
    let exits = CaptureRules.Batch.cooldownExitEvaluations
    driver.feed(fail(.noItem), times: exits - 1, box: nil)
    #expect(driver.transition == nil)
    #expect(driver.lock.state == .cooldown)
    driver.feed(fail(.noItem), box: nil)
    #expect(driver.transition == .cooldownEnded)
    #expect(driver.lock.state == .locked(.noItem))
  }

  @Test("cooldown ends after the brief's number of evaluations of a new item (IoU just below the limit)")
  func cooldownEndsOnNewItem() {
    var driver = cooledDown(box: halfFrame)
    let exits = CaptureRules.Batch.cooldownExitEvaluations
    driver.feed(pass, times: exits - 1, box: widened(by: 0.02))
    #expect(driver.transition == nil)
    driver.feed(pass, box: widened(by: 0.02))
    #expect(driver.transition == .cooldownEnded)
  }

  @Test("the captured item at IoU at or just above the limit keeps the cooldown")
  func sameItemKeepsCooldown() {
    let exits = CaptureRules.Batch.cooldownExitEvaluations
    var atLimit = cooledDown(box: halfFrame)
    atLimit.feed(pass, times: exits * 2, box: widened(by: 0))
    #expect(atLimit.lock.state == .cooldown)
    var above = cooledDown(box: halfFrame)
    above.feed(pass, times: exits * 2, box: widened(by: -0.02))
    #expect(above.lock.state == .cooldown)
  }

  @Test("no-item and new-item evaluations are counted separately")
  func cooldownCountersAreSeparate() {
    var driver = cooledDown(box: halfFrame)
    for _ in 0..<CaptureRules.Batch.cooldownExitEvaluations {
      driver.feed(fail(.noItem), box: nil)
      driver.feed(pass, box: widened(by: 0.02))
    }
    #expect(driver.lock.state == .cooldown)
  }

  @Test("Next item ends the cooldown at once; elsewhere it does nothing")
  func nextItem() {
    var driver = cooledDown()
    let fromCooldown = driver.lock.nextItem()
    #expect(fromCooldown == .cooldownEnded)
    #expect(driver.lock.state == .locked(.notSteady))
    let fromLocked = driver.lock.nextItem()
    #expect(fromLocked == nil)
  }

  @Test("backgrounded → idle; camera ready again → warming up with counters reset")
  func backgroundAndReturn() {
    var driver = LockDriver()
    driver.feed(pass, times: unlockCount - 1)
    driver.lock.stop()
    #expect(driver.lock.state == .idle)
    driver.lock.start()
    #expect(driver.lock.state == .warmingUp)
    driver.feed(pass, times: unlockCount - 1)
    #expect(driver.lock.state == .locked(.noItem))
  }

  @Test("a mode change resets the counters to locked")
  func modeChangeRelocks() {
    var driver = LockDriver()
    driver.unlock()
    driver.feed(pass)
    driver.lock.modeChanged()
    #expect(driver.lock.state == .locked(.noItem))
    driver.feed(pass, times: unlockCount - 1)
    #expect(driver.lock.state == .locked(.noItem))
  }

  @Test("a mode change while warming up keeps warming up")
  func modeChangeWhileWarming() {
    var driver = LockDriver()
    driver.lock.modeChanged()
    #expect(driver.lock.state == .warmingUp)
  }

  /// A full-height strip as wide as the IoU limit: its IoU with `widened(by: 0)` is exactly the limit.
  private let halfFrame = NormalizedRect(x: 0, y: 0, width: CaptureRules.Batch.newItemBelowIou, height: 1)

  /// The full frame widened by `extra`: IoU with `halfFrame` is the limit ÷ (1 + extra).
  private func widened(by extra: Double) -> NormalizedRect {
    NormalizedRect(x: 0, y: 0, width: 1 + extra, height: 1)
  }

  private func cooledDown(box: NormalizedRect = goodBox) -> LockDriver {
    var driver = LockDriver()
    driver.feed(fail())
    _ = driver.capture()
    driver.lock.captureFinished(isBatch: true, box: box)
    return driver
  }
}
