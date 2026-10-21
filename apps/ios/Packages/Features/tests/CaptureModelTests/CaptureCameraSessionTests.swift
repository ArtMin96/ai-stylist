// One camera screen end to end with a fake clock (capture brief §4–§6), including the pure-logic part of
// the simulator cases C1, C2, C3, C8, C11, C13, C14, C24 and C25.
import AIStylistKernel
import CaptureModel
import Testing

private let anywayMs = CaptureRules.Timing.anywayDelayMs
private let guideMs = CaptureRules.Timing.guideHintMs
private let unlockCount = CaptureRules.Lock.unlockAfterPassingEvaluations
private let ringSteps = CaptureRules.Lock.ringFillMs / stepMs

/// Drives one session from `cameraReady` at 0 ms, one evaluation step per frame, and keeps every effect.
private struct SessionDriver {
  var session: CaptureCameraSession
  var now = 0
  var effects: [CaptureEffect]

  init(_ setup: CaptureCameraSetup = CaptureCameraSetup(family: .top, mode: .flat), screenReaderOn: Bool = false) {
    session = CaptureCameraSession(setup: setup, screenReaderOn: screenReaderOn)
    effects = session.cameraReady(atMs: 0)
  }

  var output: CaptureCameraOutput { session.output }

  var captures: [CaptureTrigger] {
    effects.compactMap {
      if case .requestCapture(let trigger) = $0 { trigger } else { nil }
    }
  }

  var spoken: [CaptureHint] {
    effects.compactMap {
      if case .speak(let line) = $0 { line.hint } else { nil }
    }
  }

  var unlockHaptics: Int {
    effects.filter { $0 == .haptic(.unlock) }.count
  }

  var isUnlocked: Bool {
    if case .unlocked = output.shutter { true } else { false }
  }

  /// Submits `observation` `times` times, one step apart, starting now.
  mutating func feed(_ observation: CaptureObservation, times: Int = 1) {
    for _ in 0..<times {
      effects += session.submit(observation, atMs: now)
      now += stepMs
    }
  }

  /// Submits `observation` every step while the clock is before `endMs`.
  mutating func feed(_ observation: CaptureObservation, until endMs: Int) {
    while now < endMs {
      feed(observation)
    }
  }

  mutating func tick(atMs time: Int) {
    now = time
    effects += session.tick(atMs: time)
  }

  mutating func shutter() {
    effects += session.shutterTapped(atMs: now)
  }

  mutating func hardware() {
    effects += session.hardwareShutter(atMs: now)
  }

  mutating func anyway() {
    effects += session.anywayTapped(atMs: now)
  }

  /// Steady frames until the shutter unlocks.
  mutating func unlock(with observation: CaptureObservation = frame()) {
    feed(observation, times: unlockCount + 1)
  }
}

private let empty = frame(item: nil)

@Suite("Camera session: unlock, ring and auto-capture")
struct CaptureSessionUnlockTests {
  @Test("camera ready: warming up, the guide shows, anyway and hardware shutter off")
  func cameraReady() {
    let driver = SessionDriver()
    #expect(driver.output.shutter == .warmingUp)
    #expect(driver.output.hint == .guide)
    #expect(driver.output.ringProgress == 0)
    #expect(!driver.output.isAnywayVisible)
    #expect(!driver.output.isHardwareShutterEnabled)
    #expect(driver.output.guide.testID == "cap-guide-top-flat")
  }

  @Test("C1: a steady top unlocks after the first sighting plus the unlock count, then auto-captures")
  func steadyTopAutoCaptures() {
    var driver = SessionDriver()
    driver.feed(frame(), times: unlockCount)
    #expect(!driver.isUnlocked)
    driver.feed(frame())
    let unlockedAtMs = driver.now - stepMs
    #expect(driver.isUnlocked)
    #expect(unlockedAtMs == unlockCount * stepMs)
    #expect(driver.unlockHaptics == 1)
    #expect(driver.output.hint == .ready, "the unlock replaces the guide at once")
    #expect(driver.output.isHardwareShutterEnabled)
    driver.feed(frame(), times: ringSteps - 1)
    #expect(driver.captures.isEmpty)
    driver.feed(frame())
    #expect(driver.captures == [.auto])
    #expect(driver.effects.contains(.haptic(.capture)))
    #expect(driver.output.shutter == .capturing)
    #expect(driver.output.hint == .capturing)
    #expect(driver.output.ringProgress == 1)
  }

  @Test("frames faster than the evaluation rate are dropped")
  func evaluationRate() {
    var session = CaptureCameraSession(setup: CaptureCameraSetup(family: .top, mode: .flat))
    _ = session.cameraReady(atMs: 0)
    let half = stepMs / 2
    for time in stride(from: 0, to: unlockCount * stepMs, by: half) {
      _ = session.submit(frame(), atMs: time)
    }
    #expect(session.output.shutter == .locked(.notSteady), "only every other frame was evaluated")
    _ = session.submit(frame(), atMs: unlockCount * stepMs)
    #expect(session.output.shutter == .unlocked(progress: 0))
  }

  @Test("one failing frame pauses the ring; it resumes on the next steady frames")
  func ringPauseAndResume() {
    var driver = SessionDriver()
    driver.unlock()
    driver.feed(frame(), times: 2)
    let before = driver.output.ringProgress
    // A blurred frame fails steady but keeps the box, so the next sharp frame is steady again.
    driver.feed(frame(item: item(sharpness: 0)))
    #expect(driver.output.ringProgress == before)
    #expect(driver.isUnlocked)
    driver.feed(frame())
    #expect(driver.output.ringProgress == before)
    driver.feed(frame())
    #expect(driver.output.ringProgress > before)
  }

  @Test("C2: hanger mode unlocks with the hook touching the top edge up to its limit")
  func hangerHook() {
    let hook = frame(item: item(contact: EdgeContact(top: CaptureRules.Ios.hangerTopCutOffAboveEdgeContactShare)))
    var driver = SessionDriver(CaptureCameraSetup(family: .top, mode: .hanger))
    driver.unlock(with: hook)
    #expect(driver.isUnlocked)
  }

  @Test("C13: a dim room shows too dark and the shutter still unlocks")
  func dimRoom() {
    var driver = SessionDriver()
    driver.unlock(with: frame(meanLuma: CaptureRules.Light.tooDarkBelowMeanLuma - 1))
    #expect(driver.isUnlocked)
    #expect(driver.output.hint == .tooDark)
  }
}

@Suite("Camera session: hints")
struct CaptureSessionHintTests {
  @Test("the guide stays for its first 1.5 s, then a blocking hint shows after the hold")
  func guideThenBlockingHint() {
    var driver = SessionDriver()
    driver.feed(empty, until: guideMs)
    #expect(driver.output.hint == .guide)
    driver.feed(empty, times: CaptureRules.Timing.hintHoldEvaluations)
    #expect(driver.output.hint == .noItem)
  }

  @Test("without any evaluation, warming up replaces the guide when the guide time ends")
  func warmingUpHint() {
    var driver = SessionDriver()
    driver.tick(atMs: guideMs - 1)
    #expect(driver.output.hint == .guide)
    driver.tick(atMs: guideMs)
    #expect(driver.output.hint == .warmingUp)
  }

  @Test("a capture failure relocks with the last blocking hint")
  func captureFailed() {
    var driver = SessionDriver(screenReaderOn: true)
    driver.feed(frame(item: item(box: centredBox(area: 0.01))))
    driver.shutter()
    #expect(driver.output.shutter == .capturing)
    driver.effects += driver.session.captureFailed(atMs: driver.now)
    #expect(driver.output.shutter == .locked(.tooSmall))
    #expect(driver.output.hint == .tooSmall)
  }
}

@Suite("Camera session: Take photo anyway")
struct CaptureSessionAnywayTests {
  @Test("C8: no item found: anyway at 10.0 s with the surface tip")
  func noItemAnyway() {
    var driver = SessionDriver()
    driver.feed(empty, until: anywayMs)
    #expect(!driver.output.isAnywayVisible)
    driver.feed(empty)
    #expect(driver.output.isAnywayVisible)
    #expect(driver.output.anywayReason == .surfaceTip)
    #expect(driver.output.isHardwareShutterEnabled)
  }

  @Test("the anyway timer runs on clock ticks alone")
  func anywayOnTicks() {
    var driver = SessionDriver()
    driver.tick(atMs: anywayMs - 1)
    #expect(!driver.output.isAnywayVisible)
    driver.tick(atMs: anywayMs)
    #expect(driver.output.isAnywayVisible)
  }

  @Test("C11: a coat cut off at several edges: anyway with 'Try hanger mode'")
  func coatTooBig() {
    let over = CaptureRules.Ios.cutOffAboveEdgeContactShare * 2
    let coat = frame(item: item(contact: EdgeContact(top: over, bottom: over)))
    var driver = SessionDriver(CaptureCameraSetup(family: .outerwear, mode: .flat))
    driver.feed(coat, until: anywayMs + stepMs)
    #expect(driver.output.hint == .cutOffMultiple)
    #expect(driver.output.anywayReason == .tryHangerMode)
  }

  @Test("cut off in a family without hanger mode gives the hint itself as the reason")
  func cutOffWithoutHanger() {
    let shoe = frame(item: item(contact: EdgeContact(left: CaptureRules.Ios.cutOffAboveEdgeContactShare * 2)))
    var driver = SessionDriver(CaptureCameraSetup(family: .shoes, mode: .flat))
    driver.feed(shoe, until: anywayMs + stepMs)
    #expect(driver.output.anywayReason == .hint(.cutOffLeft))
  }

  @Test("C14: shaky hands never unlock; anyway at 10 s with 'Hold the phone still'")
  func shakyHands() {
    var driver = SessionDriver()
    var isLeft = true
    while driver.now <= anywayMs {
      let shift = CaptureRules.Steady.maxCentreShift * 2
      driver.feed(frame(item: item(box: centredBox(area: goodBox.area, centreX: isLeft ? 0.5 : 0.5 + shift))))
      isLeft.toggle()
    }
    #expect(driver.unlockHaptics == 0)
    #expect(driver.output.hint == .notSteady)
    #expect(driver.output.isAnywayVisible)
    #expect(driver.output.anywayReason == .hint(.notSteady))
  }

  @Test("a mode change does not restart the anyway timer")
  func modeChangeKeepsTimer() {
    var driver = SessionDriver()
    driver.feed(empty, until: anywayMs / 2)
    driver.session.modeChanged(to: .hanger)
    #expect(driver.output.guide.testID == "cap-guide-top-hanger")
    driver.feed(empty, until: anywayMs + stepMs)
    #expect(driver.output.isAnywayVisible)
  }

  @Test("C24: back from the background the camera warms up again and the anyway timer restarts")
  func backgroundRestarts() {
    var driver = SessionDriver()
    driver.feed(empty, until: anywayMs / 2)
    driver.session.backgrounded()
    #expect(driver.output.shutter == .idle)
    #expect(!driver.output.isAnywayVisible)
    let returnMs = anywayMs - stepMs
    driver.now = returnMs
    driver.effects += driver.session.foregrounded(atMs: returnMs)
    #expect(driver.output.shutter == .warmingUp)
    #expect(driver.output.hint == .guide)
    driver.feed(empty, until: returnMs + anywayMs)
    #expect(!driver.output.isAnywayVisible)
    driver.feed(empty)
    #expect(driver.output.isAnywayVisible)
  }

  @Test("C24: a capture interrupted by the background is dropped, not finished")
  func backgroundDropsCapture() {
    var driver = SessionDriver(screenReaderOn: true)
    driver.shutter()
    driver.session.backgrounded()
    let finished = driver.session.captureFinished(atMs: driver.now)
    #expect(finished.isEmpty)
    #expect(driver.output.shutter == .idle)
  }

  @Test("C25: with a screen reader, anyway shows at once and the shutter works from the start")
  func screenReaderAtOnce() {
    var driver = SessionDriver(screenReaderOn: true)
    #expect(driver.output.isAnywayVisible)
    #expect(driver.output.isHardwareShutterEnabled)
    driver.shutter()
    #expect(driver.captures == [.anyway])
  }

  @Test("turning the screen reader on mid-session shows anyway at once")
  func screenReaderMidSession() {
    var driver = SessionDriver()
    driver.feed(empty, times: 3)
    driver.effects += driver.session.screenReaderChanged(true, atMs: driver.now)
    #expect(driver.output.isAnywayVisible)
  }

  @Test("the shutter while locked and anyway hidden is ignored")
  func lockedShutterIgnored() {
    var driver = SessionDriver()
    driver.feed(empty)
    driver.shutter()
    driver.hardware()
    driver.anyway()
    #expect(driver.captures.isEmpty)
    #expect(driver.output.shutter == .locked(.noItem))
  }

  @Test("unlocked: the shutter captures manually and the hardware button as hardware")
  func unlockedTriggers() {
    var manual = SessionDriver()
    manual.unlock()
    manual.shutter()
    var hardware = SessionDriver()
    hardware.unlock()
    hardware.hardware()
    #expect(manual.captures == [.manual])
    #expect(hardware.captures == [.hardware])
  }

  @Test("locked with anyway visible: the shutter, the hardware button and anyway all capture as anyway")
  func lockedAnywayTriggers() {
    for control in 0..<3 {
      var driver = SessionDriver()
      driver.feed(empty, until: anywayMs + stepMs)
      switch control {
      case 0: driver.shutter()
      case 1: driver.hardware()
      default: driver.anyway()
      }
      #expect(driver.captures == [.anyway], "control \(control)")
      #expect(driver.output.shutter == .capturing)
      #expect(!driver.output.isAnywayVisible)
    }
  }
}

@Suite("Camera session: worn mode")
struct CaptureSessionWornTests {
  private let wornTop = CaptureCameraSetup(family: .top, mode: .worn)

  @Test("C3: the whole-body frame unlocks even touching the edges")
  func wholeBodyUnlocks() {
    let touching = item(contact: EdgeContact(top: 0.5, bottom: 0.5))
    var driver = SessionDriver(wornTop)
    driver.unlock(with: frame(item: touching, pose: .observed(wholeBody())))
    #expect(driver.isUnlocked)
  }

  @Test("C3: a missing hip locks with the body hint; anyway at 10 s")
  func missingPartLocks() {
    var body = wholeBody()
    body[.rightHip] = nil
    var driver = SessionDriver(wornTop)
    driver.feed(frame(pose: .observed(body)), until: anywayMs + stepMs)
    #expect(driver.output.shutter == .locked(.bodyPartsMissing))
    #expect(driver.output.hint == .bodyShouldersHips)
    #expect(driver.output.anywayReason == .hint(.bodyShouldersHips))
  }

  @Test("C3: generic worn never shows a body hint")
  func genericWorn() {
    var driver = SessionDriver(CaptureCameraSetup(family: .generic, mode: .worn))
    driver.unlock(with: frame(pose: .observed([:])))
    #expect(driver.isUnlocked)
  }

  @Test("pose model unavailable: anyway at once and the shutter still unlocks")
  func poseFallback() {
    var driver = SessionDriver(wornTop)
    driver.feed(frame(pose: .modelUnavailable))
    #expect(driver.output.isAnywayVisible)
    driver.feed(frame(pose: .modelUnavailable), times: unlockCount)
    #expect(driver.isUnlocked)
    #expect(driver.output.hint == .bodyShouldersHips, "the body hint stays as a tip")
  }
}

@Suite("Camera session: batch cooldown")
struct CaptureSessionBatchTests {
  private let batch = CaptureCameraSetup(family: .generic, mode: .flat, flow: .batch)

  @Test("after a batch capture: cooldown, 'Next item', anyway hidden; empty frames end it")
  func cooldownThenNextItem() {
    var driver = capturedOne()
    #expect(driver.output.shutter == .cooldown)
    #expect(driver.output.hint == .nextItem)
    #expect(!driver.output.isAnywayVisible)
    driver.feed(empty, times: CaptureRules.Batch.cooldownExitEvaluations)
    #expect(driver.output.shutter == .locked(.noItem))
  }

  @Test("the anyway delay restarts for the next batch item")
  func anywayRestartsPerItem() {
    var driver = capturedOne()
    driver.feed(empty, times: CaptureRules.Batch.cooldownExitEvaluations)
    let nextItemMs = driver.now - stepMs
    driver.feed(empty, until: nextItemMs + anywayMs)
    #expect(!driver.output.isAnywayVisible)
    driver.feed(empty)
    #expect(driver.output.isAnywayVisible)
  }

  @Test("the captured item still in view keeps the cooldown; Next item ends it")
  func sameItemThenNextTap() {
    var driver = capturedOne()
    driver.feed(frame(), times: CaptureRules.Batch.cooldownExitEvaluations * 3)
    #expect(driver.output.shutter == .cooldown)
    driver.effects += driver.session.nextItemTapped(atMs: driver.now)
    #expect(driver.output.shutter != .cooldown)
  }

  @Test("a single capture finishes the camera without a cooldown")
  func singleFinishes() {
    var driver = SessionDriver()
    driver.unlock()
    driver.feed(frame(), times: ringSteps)
    driver.effects += driver.session.captureFinished(atMs: driver.now)
    #expect(driver.output.shutter == .idle)
  }

  private func capturedOne() -> SessionDriver {
    var driver = SessionDriver(batch)
    driver.unlock()
    driver.feed(frame(), times: ringSteps)
    driver.effects += driver.session.captureFinished(atMs: driver.now)
    return driver
  }
}

@Suite("Camera session: speech")
struct CaptureSessionSpeechTests {
  @Test("nothing is spoken without a screen reader or the speaker button")
  func silentByDefault() {
    var driver = SessionDriver()
    driver.unlock()
    driver.feed(frame(), times: ringSteps)
    #expect(driver.spoken.isEmpty)
  }

  @Test("with a screen reader the guide is spoken with its family and mode")
  func guideSpoken() {
    let driver = SessionDriver(screenReaderOn: true)
    let guide = CaptureGuide(family: .top, mode: .flat, side: .front)
    #expect(driver.effects.contains(.speak(CaptureUtterance(hint: .guide, guide: guide))))
  }

  @Test("hint changes inside the speech gap wait, and the latest is spoken when it ends")
  func latestAfterGap() {
    var driver = SessionDriver(screenReaderOn: true)
    driver.unlock()
    driver.feed(frame(), times: ringSteps)
    #expect(driver.spoken == [.guide])
    driver.tick(atMs: CaptureRules.Timing.speechMinGapMs)
    #expect(driver.spoken == [.guide, .capturing])
  }

  @Test("the speaker button turns speech on without a screen reader")
  func speakerButton() {
    var driver = SessionDriver()
    driver.session.speechToggled(true)
    driver.feed(empty, until: guideMs)
    driver.feed(empty, times: CaptureRules.Timing.hintHoldEvaluations)
    #expect(driver.spoken == [.noItem])
  }
}
