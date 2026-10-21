// Capture brief §5 timings: the anyway delay, hint hysteresis and the speech gap and repeat window.
import AIStylistKernel
import CaptureModel
import Testing

private let anywayMs = CaptureRules.Timing.anywayDelayMs
private let holdCount = CaptureRules.Timing.hintHoldEvaluations
private let minVisibleMs = CaptureRules.Timing.hintMinVisibleMs
private let speechGapMs = CaptureRules.Timing.speechMinGapMs
private let repeatMs = CaptureRules.Timing.speechRepeatWindowMs

@Suite("Continuous capture clock")
struct ContinuousCaptureClockTests {
  @Test("starts at zero and never goes back")
  func monotonic() {
    let clock = ContinuousCaptureClock()
    let first = clock.nowMs
    let second = clock.nowMs
    #expect(first >= 0)
    #expect(second >= first)
  }
}

@Suite("Anyway timer")
struct AnywayTimerTests {
  @Test("hidden before the timer starts")
  func hiddenBeforeStart() {
    var timer = AnywayTimer()
    timer.update(atMs: anywayMs * 2)
    #expect(!timer.isVisible)
  }

  @Test("shows at the delay, not a millisecond before")
  func showsAtDelay() {
    var timer = AnywayTimer()
    timer.start(atMs: 0)
    timer.update(atMs: anywayMs - 1)
    #expect(!timer.isVisible)
    timer.update(atMs: anywayMs)
    #expect(timer.isVisible)
  }

  @Test("once shown it stays")
  func staysShown() {
    var timer = AnywayTimer()
    timer.start(atMs: 0)
    timer.update(atMs: anywayMs)
    timer.update(atMs: anywayMs * 3)
    #expect(timer.isVisible)
  }

  @Test("a restart hides it and counts the full delay again")
  func restartRecounts() {
    var timer = AnywayTimer()
    timer.start(atMs: 0)
    timer.update(atMs: anywayMs)
    timer.start(atMs: anywayMs)
    #expect(!timer.isVisible)
    timer.update(atMs: anywayMs * 2 - 1)
    #expect(!timer.isVisible)
    timer.update(atMs: anywayMs * 2)
    #expect(timer.isVisible)
  }

  @Test("stopping (background) hides it until it starts again")
  func stopHides() {
    var timer = AnywayTimer()
    timer.start(atMs: 0)
    timer.update(atMs: anywayMs)
    timer.stop()
    timer.update(atMs: anywayMs * 2)
    #expect(!timer.isVisible)
  }

  @Test("with a screen reader it is visible at once")
  func screenReaderAtStart() {
    var timer = AnywayTimer(screenReaderOn: true)
    timer.start(atMs: 0)
    #expect(timer.isVisible)
  }

  @Test("turning the screen reader on mid-count shows it at once; turning it off keeps it")
  func screenReaderMidCount() {
    var timer = AnywayTimer()
    timer.start(atMs: 0)
    timer.setScreenReader(true, atMs: 1)
    #expect(timer.isVisible)
    timer.setScreenReader(false, atMs: 2)
    #expect(timer.isVisible)
  }

  @Test("the model-unavailable fallback shows it at once, but not while stopped")
  func fallbackShowsNow() {
    var stopped = AnywayTimer()
    stopped.showNow()
    #expect(!stopped.isVisible)
    var running = AnywayTimer()
    running.start(atMs: 0)
    running.showNow()
    #expect(running.isVisible)
  }
}

@Suite("Hint presenter")
struct HintPresenterTests {
  @Test("show replaces the hint at once")
  func showIsImmediate() {
    var presenter = HintPresenter()
    let first = presenter.show(.guide, atMs: 0)
    let second = presenter.show(.capturing, atMs: 1)
    #expect(first && second)
    #expect(presenter.shown == .capturing)
  }

  @Test("a new hint needs the brief's number of consecutive evaluations, not one fewer")
  func holdEvaluations() {
    var presenter = HintPresenter()
    _ = presenter.show(.guide, atMs: 0)
    for evaluation in 1..<holdCount {
      let changed = presenter.propose(.noItem, atMs: minVisibleMs + evaluation)
      #expect(!changed)
    }
    let changed = presenter.propose(.noItem, atMs: minVisibleMs + holdCount)
    #expect(changed)
    #expect(presenter.shown == .noItem)
  }

  @Test("the shown hint stays for the minimum time, then a held hint replaces it")
  func minimumVisibleTime() {
    var presenter = HintPresenter()
    _ = presenter.show(.noItem, atMs: 0)
    for time in [100, 200, minVisibleMs - 1] {
      let changed = presenter.propose(.tooSmall, atMs: time)
      #expect(!changed, "at \(time) ms")
    }
    let changed = presenter.propose(.tooSmall, atMs: minVisibleMs)
    #expect(changed)
  }

  @Test("an interrupted candidate starts its count again")
  func interruptedCandidate() {
    var presenter = HintPresenter()
    _ = presenter.show(.noItem, atMs: 0)
    _ = presenter.propose(.tooSmall, atMs: minVisibleMs)
    _ = presenter.propose(.notSteady, atMs: minVisibleMs + 100)
    let changed = presenter.propose(.tooSmall, atMs: minVisibleMs + 200)
    #expect(!changed)
    #expect(presenter.shown == .noItem)
  }

  @Test("proposing the shown hint or nothing resets the count")
  func shownOrNilResets() {
    var presenter = HintPresenter()
    _ = presenter.show(.noItem, atMs: 0)
    _ = presenter.propose(.tooSmall, atMs: minVisibleMs)
    _ = presenter.propose(nil, atMs: minVisibleMs + 100)
    let afterNil = presenter.propose(.tooSmall, atMs: minVisibleMs + 200)
    _ = presenter.propose(.noItem, atMs: minVisibleMs + 300)
    let afterShown = presenter.propose(.tooSmall, atMs: minVisibleMs + 400)
    let held = presenter.propose(.tooSmall, atMs: minVisibleMs + 500)
    #expect(!afterNil && !afterShown)
    #expect(held)
  }
}

@Suite("Speech gate")
struct SpeechGateTests {
  private let first = CaptureUtterance(hint: .noItem)
  private let second = CaptureUtterance(hint: .tooSmall)
  private let third = CaptureUtterance(hint: .notSteady)

  @Test("silent without a screen reader or the speaker button (Q-B)")
  func silentByDefault() {
    var gate = SpeechGate()
    let spoken = gate.hintChanged(to: first, atMs: 0)
    #expect(spoken == nil)
  }

  @Test("speaks hint changes with a screen reader, or with the speaker button")
  func speaksWhenEnabled() {
    var reader = SpeechGate(screenReaderOn: true)
    let byReader = reader.hintChanged(to: first, atMs: 0)
    var button = SpeechGate()
    button.setSpeechToggle(true)
    let byButton = button.hintChanged(to: first, atMs: 0)
    #expect(byReader == first)
    #expect(byButton == first)
  }

  @Test("the warming-up hint is never spoken")
  func warmingUpIsSilent() {
    var gate = SpeechGate(screenReaderOn: true)
    let spoken = gate.hintChanged(to: CaptureUtterance(hint: .warmingUp), atMs: 0)
    #expect(spoken == nil)
  }

  @Test("a change inside the gap waits and is spoken when the gap ends")
  func gapDefers() {
    var gate = SpeechGate(screenReaderOn: true)
    _ = gate.hintChanged(to: first, atMs: 0)
    let atChange = gate.hintChanged(to: second, atMs: speechGapMs - 1)
    let beforeGap = gate.update(atMs: speechGapMs - 1)
    let atGap = gate.update(atMs: speechGapMs)
    let later = gate.update(atMs: speechGapMs * 2)
    #expect(atChange == nil)
    #expect(beforeGap == nil)
    #expect(atGap == second)
    #expect(later == nil)
  }

  @Test("the latest change inside the gap wins")
  func latestWins() {
    var gate = SpeechGate(screenReaderOn: true)
    _ = gate.hintChanged(to: first, atMs: 0)
    _ = gate.hintChanged(to: second, atMs: 100)
    _ = gate.hintChanged(to: third, atMs: 200)
    let spoken = gate.update(atMs: speechGapMs)
    #expect(spoken == third)
  }

  @Test("the same line is not spoken again inside the repeat window, and is after it")
  func repeatWindow() {
    var gate = SpeechGate(screenReaderOn: true)
    _ = gate.hintChanged(to: first, atMs: 0)
    _ = gate.hintChanged(to: second, atMs: speechGapMs)
    let inWindow = gate.hintChanged(to: first, atMs: repeatMs - 1)
    _ = gate.hintChanged(to: second, atMs: repeatMs + speechGapMs)
    let afterWindow = gate.hintChanged(to: first, atMs: repeatMs + speechGapMs * 2)
    #expect(inWindow == nil)
    #expect(afterWindow == first)
  }

  @Test("the guide of another mode is a different line")
  func guidesDiffer() {
    var gate = SpeechGate(screenReaderOn: true)
    let flat = CaptureUtterance(hint: .guide, guide: CaptureGuide(family: .top, mode: .flat, side: .front))
    let hanger = CaptureUtterance(hint: .guide, guide: CaptureGuide(family: .top, mode: .hanger, side: .front))
    _ = gate.hintChanged(to: flat, atMs: 0)
    let spoken = gate.hintChanged(to: hanger, atMs: speechGapMs)
    #expect(spoken == hanger)
  }

  @Test("turning speech off drops the waiting line")
  func offDropsWaiting() {
    var gate = SpeechGate(screenReaderOn: true)
    _ = gate.hintChanged(to: first, atMs: 0)
    _ = gate.hintChanged(to: second, atMs: 100)
    gate.setScreenReader(false)
    let spoken = gate.update(atMs: speechGapMs)
    #expect(spoken == nil)
  }
}
