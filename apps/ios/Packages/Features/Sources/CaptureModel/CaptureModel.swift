// View model of the guided capture camera (capture brief §2, §7): the picker, the underwear opt-in,
// the camera (one `CaptureCameraSession` per camera screen), the back and pair step, batch and
// library import. No analytics (owner, 2026-10-22: camera only). Photos are opaque IDs the app owns;
// nothing is saved or uploaded in v1. The value types are `nonisolated` so the app can pass them to
// work off the main actor; the model itself stays on the main actor.
public import AIStylistKernel
public import Observation

/// An underwear or swimwear sub-pick and the shape family whose rules it uses (capture brief §2).
nonisolated public enum UnderwearPick: String, CaseIterable, Sendable {
  /// "Bra or top" (`cap-picker-underwear-top`).
  case top
  /// "Briefs or bottoms" (`cap-picker-underwear-bottoms`).
  case bottoms
  /// "Swimsuit or bodysuit" (`cap-picker-underwear-swimsuit`).
  case swimsuit
  /// "Tights" (`cap-picker-underwear-tights`).
  case tights
  /// "Socks" (`cap-picker-underwear-socks`).
  case socks

  public var family: CaptureShapeFamily {
    switch self {
    case .top: .top
    case .bottoms: .shortBottom
    case .swimsuit: .onePiece
    case .tights: .longBottom
    case .socks: .smallItem
    }
  }

  /// The tile's test ID.
  public var testID: String { "cap-picker-underwear-\(rawValue)" }
}

/// A photo the app captured or imported; the app keeps the image, the model only its ID.
nonisolated public struct CapturePhotoID: Hashable, Sendable {
  public let rawValue: String

  public init(_ rawValue: String) {
    self.rawValue = rawValue
  }
}

/// The review screen's question after the front photo (capture brief §7).
nonisolated public enum CaptureSecondPhotoQuestion: Equatable, Sendable {
  /// "Is the back different?" Same (default) / Different.
  case isBackDifferent
  /// Shoes (Q-D): "Add a photo of the pair?" No (default) / Yes.
  case addPairPhoto
}

/// The review screen (`cap-screen-review`).
nonisolated public struct CaptureReview: Equatable, Sendable {
  /// The front photo's capture; the back or pair step reuses its family and mode.
  public let setup: CaptureCameraSetup
  public fileprivate(set) var front: CapturePhotoID
  /// The back or pair photo, once taken.
  public fileprivate(set) var second: CapturePhotoID?
  /// Different / Yes chosen; false is the default (Same / No).
  public fileprivate(set) var wantsSecondPhoto = false

  public var question: CaptureSecondPhotoQuestion {
    setup.family == .shoes ? .addPairPhoto : .isBackDifferent
  }

  /// The side the second photo step captures.
  public var secondSide: CaptureSide {
    setup.family == .shoes ? .pair : .back
  }
}

/// The screen the capture flow shows.
nonisolated public enum CaptureScreen: Equatable, Sendable {
  /// `cap-screen-picker`.
  case picker
  /// `cap-optin-sheet`, shown once, the first time the underwear tile is tapped.
  case underwearOptIn
  /// The underwear and swimwear sub-pick.
  case underwearPicker
  /// `cap-screen-camera`.
  case camera(CaptureCameraSetup)
  /// The system photo picker (one photo in v1).
  case importPicker
  /// `cap-screen-import-tips`: the failing checks of the imported still, in priority order.
  case importTips([CaptureHint])
  /// `cap-screen-review`.
  case review(CaptureReview)
  /// `cap-screen-batch-summary`.
  case batchSummary([CapturePhotoID])
  /// The flow is over; the photos are dropped (v1 saves nothing).
  case closed
}

@Observable
public final class CaptureModel {
  public private(set) var screen: CaptureScreen = .picker
  /// What the camera screen draws; nil when no camera screen is open.
  public private(set) var camera: CaptureCameraOutput?
  /// Photos taken in this batch (`cap-batch-count` shows the count).
  public private(set) var batchPhotos: [CapturePhotoID] = []
  /// The camera shows an underwear or swimwear sub-pick (the worn toggle is in its menu).
  public private(set) var isUnderwear = false
  public private(set) var isScreenReaderOn: Bool
  /// The speaker button (`cap-camera-speech`, Q-B).
  public private(set) var isSpeechToggledOn = false

  @ObservationIgnored private let clock: any CaptureClock
  @ObservationIgnored private let optInStore: any UnderwearOptInStore
  @ObservationIgnored private var session: CaptureCameraSession?
  @ObservationIgnored private var review: CaptureReview?
  @ObservationIgnored private var importReturnScreen: CaptureScreen = .picker

  public init(clock: any CaptureClock, optInStore: any UnderwearOptInStore, screenReaderOn: Bool = false) {
    self.clock = clock
    self.optInStore = optInStore
    isScreenReaderOn = screenReaderOn
  }

  // MARK: - Picker

  /// A category tile: the camera opens in the family's default mode (flat for every family, §2).
  public func chooseFamily(_ family: CaptureShapeFamily) {
    isUnderwear = false
    review = nil
    openCamera(CaptureCameraSetup(family: family, mode: .flat))
  }

  /// "Not sure" (`cap-picker-not-sure`): the generic family.
  public func chooseNotSure() {
    chooseFamily(.generic)
  }

  /// The underwear tile: the opt-in sheet the first time, the sub-pick after that.
  public func chooseUnderwear() {
    screen = optInStore.load() == nil ? .underwearOptIn : .underwearPicker
  }

  /// The opt-in sheet's answer, stored on the device.
  public func answerUnderwearOptIn(_ answer: UnderwearWornOptIn) {
    optInStore.save(answer)
    screen = .underwearPicker
  }

  /// The sheet closed without an answer: it asks again next time.
  public func dismissUnderwearOptIn() {
    screen = .picker
  }

  public func chooseUnderwear(_ pick: UnderwearPick) {
    isUnderwear = true
    review = nil
    openCamera(CaptureCameraSetup(family: pick.family, mode: .flat))
  }

  /// "Many items (batch)": generic guide, no category tap, no back question (Q-C).
  public func startBatch() {
    isUnderwear = false
    review = nil
    batchPhotos = []
    openCamera(CaptureCameraSetup(family: .generic, mode: .flat, flow: .batch))
  }

  /// "Import from photos", from the picker or the camera's bottom bar.
  public func startImport() {
    importReturnScreen = screen
    closeCamera()
    screen = .importPicker
  }

  /// Close (`cap-picker-close`, `cap-camera-close`): the flow ends and its photos are dropped.
  public func close() {
    closeCamera()
    review = nil
    batchPhotos = []
    screen = .closed
  }

  // MARK: - Modes

  /// The modes the mode switch offers; worn for underwear only after the opt-in allowed it.
  public var modesOffered: [CaptureMode] {
    guard case .camera(let setup) = screen else { return [] }
    return setup.family.modes.filter { $0 != .worn || !isUnderwear || isUnderwearWornAllowed }
  }

  /// The opt-in answer allows worn photos of underwear and swimwear.
  public var isUnderwearWornAllowed: Bool { optInStore.load() == .allowWorn }

  /// The mode switch (`cap-mode-*`). Counters reset; the anyway timer keeps running.
  public func selectMode(_ mode: CaptureMode) {
    guard case .camera(let setup) = screen, modesOffered.contains(mode), var session else { return }
    session.modeChanged(to: mode)
    self.session = session
    screen = .camera(setup.with(mode: mode))
    camera = session.output
  }

  /// The camera menu's worn toggle (`cap-camera-underwear-worn-toggle`), underwear only. Turning it off
  /// in worn mode switches to flat.
  public func setUnderwearWornAllowed(_ isAllowed: Bool) {
    guard isUnderwear else { return }
    optInStore.save(isAllowed ? .allowWorn : .flatAndHangerOnly)
    if !isAllowed, case .camera(let setup) = screen, setup.mode == .worn {
      selectMode(.flat)
    }
  }

  // MARK: - Camera inputs (each returns the effects the app performs)

  public func cameraReady() -> [CaptureEffect] {
    updateSession { $0.cameraReady(atMs: $1) }
  }

  public func submit(_ observation: CaptureObservation) -> [CaptureEffect] {
    updateSession { $0.submit(observation, atMs: $1) }
  }

  /// Call between frames (the app's display tick), so timers run when no frame arrives.
  public func tick() -> [CaptureEffect] {
    updateSession { $0.tick(atMs: $1) }
  }

  public func shutterTapped() -> [CaptureEffect] {
    updateSession { $0.shutterTapped(atMs: $1) }
  }

  public func hardwareShutter() -> [CaptureEffect] {
    updateSession { $0.hardwareShutter(atMs: $1) }
  }

  public func anywayTapped() -> [CaptureEffect] {
    updateSession { $0.anywayTapped(atMs: $1) }
  }

  /// The requested photo is ready. Single front: review. Back or pair: back to review with both.
  /// Batch: counted, and the camera waits for the next item.
  public func captureFinished(_ photo: CapturePhotoID) -> [CaptureEffect] {
    guard case .camera(let setup) = screen else { return [] }
    let effects = updateSession { $0.captureFinished(atMs: $1) }
    switch (setup.flow, setup.side) {
    case (.batch, _):
      batchPhotos.append(photo)
    case (.single, .front):
      if var review {
        review.front = photo
        showReview(review)
      } else {
        showReview(CaptureReview(setup: setup, front: photo))
      }
    case (.single, .back), (.single, .pair):
      guard var review else { return effects }
      review.second = photo
      showReview(review)
    }
    return effects
  }

  public func captureFailed() -> [CaptureEffect] {
    updateSession { $0.captureFailed(atMs: $1) }
  }

  public func nextItemTapped() -> [CaptureEffect] {
    updateSession { $0.nextItemTapped(atMs: $1) }
  }

  /// "Done" in batch (`cap-batch-done`): the local thumbnail list.
  public func batchDone() {
    closeCamera()
    screen = .batchSummary(batchPhotos)
  }

  public func backgrounded() {
    guard var session else { return }
    session.backgrounded()
    self.session = session
    camera = session.output
  }

  public func foregrounded() -> [CaptureEffect] {
    updateSession { $0.foregrounded(atMs: $1) }
  }

  public func screenReaderChanged(_ isOn: Bool) -> [CaptureEffect] {
    isScreenReaderOn = isOn
    return updateSession { $0.screenReaderChanged(isOn, atMs: $1) }
  }

  /// The speaker button (`cap-camera-speech`).
  public func setSpeechToggled(_ isOn: Bool) {
    isSpeechToggledOn = isOn
    guard var session else { return }
    session.speechToggled(isOn)
    self.session = session
  }

  // MARK: - Review

  /// Same / Different (shoes: No / Yes).
  public func answerSecondPhoto(wanted: Bool) {
    guard var review else { return }
    review.wantsSecondPhoto = wanted
    showReview(review)
  }

  /// "Take back photo" (`cap-review-take-back`) or the pair photo: the camera with the back or pair guide.
  public func takeSecondPhoto() {
    guard let review, review.wantsSecondPhoto else { return }
    let front = review.setup
    openCamera(CaptureCameraSetup(family: front.family, mode: front.mode, side: review.secondSide))
  }

  /// "Skip" on the back or pair step (`cap-camera-skip-back`): back to review.
  public func skipSecondPhoto() {
    guard let review, case .camera(let setup) = screen, setup.side != .front else { return }
    closeCamera()
    showReview(review)
  }

  /// "Retake" (`cap-review-retake`): the front camera again; the new photo replaces the front.
  public func retake() {
    guard let review else { return }
    openCamera(review.setup)
  }

  /// "Done" (`cap-review-done`): v1 ends here and drops the photos.
  public func done() {
    close()
  }

  // MARK: - Library import

  /// The picked still and the platform's observation of it. No failing check: straight to review.
  public func importPicked(_ photo: CapturePhotoID, observation: CaptureObservation) {
    let family = importFamily
    let tips = CaptureRuleEngine.importTips(for: observation, family: family)
    review = CaptureReview(setup: CaptureCameraSetup(family: family, mode: .flat), front: photo)
    screen = tips.isEmpty ? reviewScreen : .importTips(tips)
  }

  /// The system picker closed without a photo.
  public func importCancelled() {
    returnFromImport()
  }

  /// "Keep anyway" (`cap-import-keep-anyway`): an import is never refused.
  public func keepImportAnyway() {
    guard case .importTips = screen else { return }
    screen = reviewScreen
  }

  /// "Choose another" (`cap-import-choose-another`): the system picker again.
  public func chooseAnotherImport() {
    guard case .importTips = screen else { return }
    review = nil
    screen = .importPicker
  }

  // MARK: - Private

  /// Import from the camera keeps the camera's family; from the picker it is unknown (generic).
  private var importFamily: CaptureShapeFamily {
    if case .camera(let setup) = importReturnScreen, setup.flow == .single {
      return setup.family
    }
    return .generic
  }

  private var reviewScreen: CaptureScreen {
    review.map(CaptureScreen.review) ?? .picker
  }

  private func returnFromImport() {
    review = nil
    if case .camera(let setup) = importReturnScreen {
      openCamera(setup)
    } else {
      screen = importReturnScreen
    }
  }

  private func openCamera(_ setup: CaptureCameraSetup) {
    let session = CaptureCameraSession(
      setup: setup,
      screenReaderOn: isScreenReaderOn,
      speechToggledOn: isSpeechToggledOn
    )
    self.session = session
    camera = session.output
    screen = .camera(setup)
  }

  private func closeCamera() {
    session = nil
    camera = nil
  }

  private func showReview(_ review: CaptureReview) {
    closeCamera()
    self.review = review
    screen = .review(review)
  }

  /// Runs one session input with the clock's time and publishes the new camera output.
  private func updateSession(
    _ input: (inout CaptureCameraSession, Int) -> [CaptureEffect]
  ) -> [CaptureEffect] {
    guard var session else { return [] }
    let effects = input(&session, clock.nowMs)
    self.session = session
    camera = session.output
    return effects
  }
}
