// One camera screen's live logic (capture brief §4–§6): it runs each observation through the rules,
// the lock machine, the anyway timer, the hint presenter and the speech gate, and returns the one-shot
// effects the platform layer performs. Every input carries the injected clock's time; nothing reads
// wall time. All types are `nonisolated` pure values, so phase B may run a session off the main actor.
public import AIStylistKernel

/// Single capture or batch (capture brief §4 "Context").
nonisolated public enum CaptureFlowKind: String, CaseIterable, Sendable {
  case single
  case batch
}

/// What one camera screen captures.
nonisolated public struct CaptureCameraSetup: Equatable, Sendable {
  public let family: CaptureShapeFamily
  public let mode: CaptureMode
  public let side: CaptureSide
  public let flow: CaptureFlowKind

  public init(
    family: CaptureShapeFamily,
    mode: CaptureMode,
    side: CaptureSide = .front,
    flow: CaptureFlowKind = .single
  ) {
    self.family = family
    self.mode = mode
    self.side = side
    self.flow = flow
  }

  public var guide: CaptureGuide { CaptureGuide(family: family, mode: mode, side: side) }
  public var checkContext: CaptureCheckContext { CaptureCheckContext(family: family, mode: mode) }

  /// The same capture in another mode.
  public func with(mode: CaptureMode) -> CaptureCameraSetup {
    CaptureCameraSetup(family: family, mode: mode, side: side, flow: flow)
  }
}

/// Vibration kinds (capture brief §6): iOS `.success` on unlock, `.impact(.medium)` on capture.
nonisolated public enum CaptureHaptic: Equatable, Sendable {
  case unlock
  case capture
}

/// A one-shot effect the platform layer performs.
nonisolated public enum CaptureEffect: Equatable, Sendable {
  case requestCapture(CaptureTrigger)
  case speak(CaptureUtterance)
  case haptic(CaptureHaptic)
}

/// The "Take photo anyway" reason line (`cap-anyway-reason`, capture brief §6).
nonisolated public enum CaptureAnywayReason: Equatable, Sendable {
  /// No item found: "No item found. A plain surface in a different colour helps."
  case surfaceTip
  /// Cut off in flat mode: "Too big to fit? Try hanger mode."
  case tryHangerMode
  /// Otherwise the blocking hint's text.
  case hint(CaptureHint)
}

/// What the camera screen draws (capture brief §4 "Outputs").
nonisolated public struct CaptureCameraOutput: Equatable, Sendable {
  public let shutter: ShutterState
  public let ringProgress: Double
  /// The hint label's key and test ID; nil only before `cameraReady`.
  public let hint: CaptureHint?
  public let isAnywayVisible: Bool
  public let anywayReason: CaptureAnywayReason?
  public let guide: CaptureGuide
  /// The live outline of the item (capture brief "Live outline"); nil before an item is found and after
  /// it is lost, when the screen shows the faint guide instead.
  public let outline: CaptureLiveOutlineState?

  /// Volume and Camera Control buttons act as the shutter only now (§7 "Hardware shutter").
  public var isHardwareShutterEnabled: Bool {
    if case .unlocked = shutter { return true }
    return isAnywayVisible
  }
}

/// The live logic of one camera screen.
nonisolated public struct CaptureCameraSession: Sendable {
  public private(set) var setup: CaptureCameraSetup
  private var rules: CaptureRuleEngine
  private var lock = ShutterLock()
  private var anyway: AnywayTimer
  private var hints = HintPresenter()
  private var speech: SpeechGate
  private var readyAtMs: Int?
  private var lastEvaluationAtMs: Int?
  private var lastBlockingHint: CaptureHint?
  private var lastItemBox: NormalizedRect?
  private var capturedBox: NormalizedRect?
  /// The hint shown before the capture began, read before `capturing` replaces it; a failed capture
  /// shows it again.
  private var hintBeforeCapture: CaptureHint?
  private var isFallback = false
  private var liveOutline = CaptureLiveOutline()

  public init(setup: CaptureCameraSetup, screenReaderOn: Bool = false, speechToggledOn: Bool = false) {
    self.setup = setup
    rules = CaptureRuleEngine(context: setup.checkContext)
    anyway = AnywayTimer(screenReaderOn: screenReaderOn)
    speech = SpeechGate(screenReaderOn: screenReaderOn)
    speech.setSpeechToggle(speechToggledOn)
  }

  /// The trigger of the capture now in progress, nil when not capturing.
  public private(set) var captureTrigger: CaptureTrigger?

  public var output: CaptureCameraOutput {
    CaptureCameraOutput(
      shutter: lock.state,
      ringProgress: lock.ringProgress,
      hint: hints.shown,
      isAnywayVisible: isAnywayVisible,
      anywayReason: anywayReason,
      guide: setup.guide,
      outline: liveOutline.state
    )
  }

  /// True when speech is on (screen reader or the speaker button).
  public var isSpeechEnabled: Bool { speech.isEnabled }

  // MARK: - Inputs

  /// The camera delivers frames: warming up, the guide shows, the anyway timer starts.
  public mutating func cameraReady(atMs now: Int) -> [CaptureEffect] {
    rules.reset()
    liveOutline.reset()
    lock.start()
    anyway.start(atMs: now)
    hints.clear()
    readyAtMs = now
    lastEvaluationAtMs = nil
    lastBlockingHint = nil
    lastItemBox = nil
    capturedBox = nil
    captureTrigger = nil
    hintBeforeCapture = nil
    isFallback = false
    return show(.guide, atMs: now)
  }

  /// Return from the background: the camera restarts in warming up and the anyway timer restarts.
  public mutating func foregrounded(atMs now: Int) -> [CaptureEffect] {
    cameraReady(atMs: now)
  }

  /// To the background: camera and analysis stop, nothing is half-saved.
  public mutating func backgrounded() {
    rules.reset()
    liveOutline.reset()
    lock.stop()
    anyway.stop()
    hints.clear()
    readyAtMs = nil
    lastEvaluationAtMs = nil
    captureTrigger = nil
  }

  /// One analysed frame. Read at most once per `CaptureRules.Evaluation.intervalMs`; extra frames are
  /// dropped.
  public mutating func submit(_ observation: CaptureObservation, atMs now: Int) -> [CaptureEffect] {
    switch lock.state {
    case .idle, .capturing:
      return []
    case .warmingUp, .locked, .unlocked, .cooldown:
      break
    }
    // The outline follows every new mask, also one that arrives between evaluations.
    if let outlines = observation.outlines {
      liveOutline.observe(outlines)
    }
    if let lastEvaluationAtMs, now - lastEvaluationAtMs < CaptureRules.Evaluation.intervalMs {
      return []
    }
    lastEvaluationAtMs = now
    return evaluate(observation, atMs: now) + housekeeping(atMs: now)
  }

  /// Clock tick between frames: the anyway timer, the warming-up hint and waiting speech.
  public mutating func tick(atMs now: Int) -> [CaptureEffect] {
    var effects: [CaptureEffect] = []
    if let readyAtMs, lastEvaluationAtMs == nil, lock.state == .warmingUp,
      now - readyAtMs >= CaptureRules.Timing.guideHintMs
    {
      effects += show(.warmingUp, atMs: now)
    }
    return effects + housekeeping(atMs: now)
  }

  /// The on-screen shutter: captures when unlocked, acts as "Take photo anyway" when that is visible,
  /// and is ignored otherwise.
  public mutating func shutterTapped(atMs now: Int) -> [CaptureEffect] {
    pressShutter(unlockedTrigger: .manual, atMs: now)
  }

  /// Volume or Camera Control button: same as the on-screen shutter, trigger `hardware`.
  public mutating func hardwareShutter(atMs now: Int) -> [CaptureEffect] {
    pressShutter(unlockedTrigger: .hardware, atMs: now)
  }

  /// "Take photo anyway".
  public mutating func anywayTapped(atMs now: Int) -> [CaptureEffect] {
    guard isAnywayVisible else { return [] }
    return beginCapture(.anyway, atMs: now)
  }

  /// The photo is taken. Single: the camera is done. Batch: cooldown until the next item.
  public mutating func captureFinished(atMs now: Int) -> [CaptureEffect] {
    guard lock.state == .capturing else { return [] }
    let isBatch = setup.flow == .batch
    lock.captureFinished(isBatch: isBatch, box: capturedBox)
    captureTrigger = nil
    hintBeforeCapture = nil
    guard isBatch else { return [] }
    return show(.nextItem, atMs: now)
  }

  /// The photo request failed: locked again. A capture from the unlocked shutter shows the hint from before
  /// it (for an auto-capture "Keep still…", not a blocking hint from before the unlock); "Take photo
  /// anyway" shows the last blocking hint.
  public mutating func captureFailed(atMs now: Int) -> [CaptureEffect] {
    guard lock.state == .capturing else { return [] }
    lock.captureFailed()
    captureTrigger = nil
    let restored = hintBeforeCapture ?? lastBlockingHint ?? .noItem
    hintBeforeCapture = nil
    return show(restored, atMs: now)
  }

  /// "Next item" in batch cooldown.
  public mutating func nextItemTapped(atMs now: Int) -> [CaptureEffect] {
    guard lock.nextItem() == .cooldownEnded else { return [] }
    anyway.start(atMs: now)
    return []
  }

  /// Screen reader on or off: speech follows; "Take photo anyway" shows at once while it is on.
  public mutating func screenReaderChanged(_ isOn: Bool, atMs now: Int) -> [CaptureEffect] {
    speech.setScreenReader(isOn)
    anyway.setScreenReader(isOn, atMs: now)
    return []
  }

  /// The speaker button (`cap-camera-speech`).
  public mutating func speechToggled(_ isOn: Bool) {
    speech.setSpeechToggle(isOn)
  }

  /// Mode switch: counters reset to locked; the anyway timer keeps running.
  public mutating func modeChanged(to mode: CaptureMode) {
    guard mode != setup.mode else { return }
    setup = setup.with(mode: mode)
    rules.reset(context: setup.checkContext)
    liveOutline.reset()
    lock.modeChanged()
  }

  // MARK: - Evaluation

  private mutating func evaluate(_ observation: CaptureObservation, atMs now: Int) -> [CaptureEffect] {
    let verdict = rules.evaluate(observation)
    if let blocking = verdict.blockingHint {
      lastBlockingHint = blocking
    }
    isFallback = verdict.isFallback
    if isFallback {
      anyway.showNow()
    }
    let itemBox = verdict.reports(.noItem) ? nil : observation.item?.box
    lastItemBox = itemBox
    switch lock.evaluate(verdict, itemBox: itemBox, atMs: now, maskTimestampMs: observation.maskTimestampMs) {
    case .unlocked:
      // An advisory hint may show while the ring fills (§6), so it wins over "ready" (C13).
      return [.haptic(.unlock)] + show(verdict.advisoryHint ?? .ready, atMs: now)
    case .autoCapture:
      return startCapturing(.auto, atMs: now)
    case .cooldownEnded:
      // The anyway delay restarts for the next batch item.
      anyway.start(atMs: now)
      return propose(candidate(for: verdict, atMs: now), atMs: now)
    case .relocked, nil:
      return propose(candidate(for: verdict, atMs: now), atMs: now)
    }
  }

  /// The hint one evaluation asks for: blocking first, then advisory, then "ready" while unlocked. Nil
  /// keeps the shown hint (the guide window, cooldown, and a passing evaluation while still locked).
  private func candidate(for verdict: CaptureVerdict, atMs now: Int) -> CaptureHint? {
    let isUnlocked: Bool
    switch lock.state {
    case .unlocked: isUnlocked = true
    case .warmingUp, .locked: isUnlocked = false
    case .idle, .capturing, .cooldown: return nil
    }
    if !isUnlocked, let readyAtMs, now - readyAtMs < CaptureRules.Timing.guideHintMs {
      return nil
    }
    return verdict.blockingHint ?? verdict.advisoryHint ?? (isUnlocked ? .ready : nil)
  }

  // MARK: - Capture

  private mutating func pressShutter(unlockedTrigger: CaptureTrigger, atMs now: Int) -> [CaptureEffect] {
    switch lock.state {
    case .unlocked:
      return beginCapture(unlockedTrigger, atMs: now)
    case .warmingUp, .locked:
      return isAnywayVisible ? beginCapture(.anyway, atMs: now) : []
    case .idle, .capturing, .cooldown:
      return []
    }
  }

  private mutating func beginCapture(_ trigger: CaptureTrigger, atMs now: Int) -> [CaptureEffect] {
    guard lock.beginCapture() else { return [] }
    return startCapturing(trigger, atMs: now)
  }

  private mutating func startCapturing(_ trigger: CaptureTrigger, atMs now: Int) -> [CaptureEffect] {
    captureTrigger = trigger
    capturedBox = lastItemBox
    // Read before `show(.capturing)` below replaces it. Only a capture from the unlocked shutter (auto,
    // manual, hardware) restores it; "Take photo anyway" came from a lock, so its blocking hint stays right.
    hintBeforeCapture = trigger == .anyway ? nil : hints.shown
    return [.requestCapture(trigger), .haptic(.capture)] + show(.capturing, atMs: now)
  }

  // MARK: - Anyway

  private var isAnywayVisible: Bool {
    switch lock.state {
    case .warmingUp, .locked, .unlocked: anyway.isVisible
    case .idle, .capturing, .cooldown: false
    }
  }

  private var anywayReason: CaptureAnywayReason? {
    guard isAnywayVisible else { return nil }
    if case .unlocked = lock.state { return nil }
    guard let hint = lastBlockingHint else {
      return isFallback ? setup.family.wornHint.map(CaptureAnywayReason.hint) : nil
    }
    if hint == .noItem {
      return .surfaceTip
    }
    if hint.lockReason == .cutOff, setup.mode == .flat, setup.family.modes.contains(.hanger) {
      return .tryHangerMode
    }
    return .hint(hint)
  }

  // MARK: - Hints and speech

  private mutating func show(_ hint: CaptureHint, atMs now: Int) -> [CaptureEffect] {
    hints.show(hint, atMs: now) ? spokenChange(atMs: now) : []
  }

  private mutating func propose(_ hint: CaptureHint?, atMs now: Int) -> [CaptureEffect] {
    hints.propose(hint, atMs: now) ? spokenChange(atMs: now) : []
  }

  private mutating func spokenChange(atMs now: Int) -> [CaptureEffect] {
    guard let hint = hints.shown else { return [] }
    let line = CaptureUtterance(hint: hint, guide: hint == .guide ? setup.guide : nil)
    return speech.hintChanged(to: line, atMs: now).map { [.speak($0)] } ?? []
  }

  private mutating func housekeeping(atMs now: Int) -> [CaptureEffect] {
    anyway.update(atMs: now)
    return speech.update(atMs: now).map { [.speak($0)] } ?? []
  }
}
