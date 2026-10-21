// The capture flow (capture brief §2, §7): picker, underwear opt-in, back and pair step, batch and
// library import, including the pure-logic part of C4, C7, C17, C19, C20 and C21.
import AIStylistKernel
import CaptureModel
import Testing

private func makeModel(
  optIn: UnderwearWornOptIn? = nil,
  screenReaderOn: Bool = false
) -> (CaptureModel, FakeClock, FakeOptInStore) {
  let clock = FakeClock()
  let store = FakeOptInStore(optIn)
  return (CaptureModel(clock: clock, optInStore: store, screenReaderOn: screenReaderOn), clock, store)
}

/// Starts the open camera and feeds steady frames until it auto-captures, then delivers `photo`.
private func captureSteadyItem(_ model: CaptureModel, _ clock: FakeClock, photo: CapturePhotoID) {
  _ = model.cameraReady()
  feedUntilCapture(model, clock)
  _ = model.captureFinished(photo)
}

private func feedUntilCapture(_ model: CaptureModel, _ clock: FakeClock) {
  for _ in 0..<100 {
    let effects = model.submit(frame())
    clock.advance(byMs: stepMs)
    if effects.contains(.requestCapture(.auto)) { return }
  }
  Issue.record("no auto-capture within 100 frames")
}

private func cameraSetup(_ model: CaptureModel) -> CaptureCameraSetup? {
  if case .camera(let setup) = model.screen { setup } else { nil }
}

private func review(_ model: CaptureModel) -> CaptureReview? {
  if case .review(let review) = model.screen { review } else { nil }
}

private let front = CapturePhotoID("photo-front")
private let second = CapturePhotoID("photo-second")

@Suite("Capture flow: picker and modes")
struct CapturePickerTests {
  @Test("starts on the picker with no camera")
  func startsOnPicker() {
    let (model, _, _) = makeModel()
    #expect(model.screen == .picker)
    #expect(model.camera == nil)
  }

  @Test("a category opens the camera for that family, flat, front, single", arguments: CaptureShapeFamily.allCases)
  func categoryOpensCamera(_ family: CaptureShapeFamily) {
    let (model, _, _) = makeModel()
    model.chooseFamily(family)
    #expect(model.screen == .camera(CaptureCameraSetup(family: family, mode: .flat, side: .front, flow: .single)))
    #expect(model.modesOffered == family.modes)
    _ = model.cameraReady()
    #expect(model.camera?.shutter == .warmingUp)
  }

  @Test("C17: 'Not sure' uses the generic family and guide")
  func notSure() {
    let (model, _, _) = makeModel()
    model.chooseNotSure()
    #expect(cameraSetup(model)?.family == .generic)
    #expect(model.camera?.guide.testID == "cap-guide-generic-flat")
  }

  @Test("the mode switch changes the mode and the guide; a mode not offered is ignored")
  func modeSwitch() {
    let (model, _, _) = makeModel()
    model.chooseFamily(.bag)
    model.selectMode(.hanger)
    #expect(cameraSetup(model)?.mode == .hanger)
    #expect(model.camera?.guide.testID == "cap-guide-bag-hanger")
    model.selectMode(.worn)
    #expect(cameraSetup(model)?.mode == .hanger)
  }

  @Test("close ends the flow and drops the camera")
  func close() {
    let (model, _, _) = makeModel()
    model.chooseFamily(.top)
    model.close()
    #expect(model.screen == .closed)
    #expect(model.camera == nil)
  }

  @Test("the screen-reader flag reaches every camera: anyway at once (C25)")
  func screenReaderReachesCamera() {
    let (model, _, _) = makeModel(screenReaderOn: true)
    model.chooseFamily(.top)
    _ = model.cameraReady()
    #expect(model.camera?.isAnywayVisible == true)
  }

  @Test("the speaker button stays on for the next camera")
  func speakerPersists() {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    model.setSpeechToggled(true)
    captureSteadyItem(model, clock, photo: front)
    model.retake()
    let effects = model.cameraReady()
    #expect(effects.contains { if case .speak = $0 { true } else { false } })
  }
}

@Suite("Capture flow: underwear opt-in (C19)")
struct CaptureUnderwearTests {
  @Test("the first tap asks once; the answer is stored; later taps go straight to the sub-pick")
  func askedOnce() {
    let (model, _, store) = makeModel()
    model.chooseUnderwear()
    #expect(model.screen == .underwearOptIn)
    model.answerUnderwearOptIn(.flatAndHangerOnly)
    #expect(store.answer == .flatAndHangerOnly)
    #expect(model.screen == .underwearPicker)
    model.close()
    model.chooseUnderwear()
    #expect(model.screen == .underwearPicker)
    #expect(store.saves == 1)
  }

  @Test("closing the sheet without an answer stores nothing and asks again")
  func dismissedAsksAgain() {
    let (model, _, store) = makeModel()
    model.chooseUnderwear()
    model.dismissUnderwearOptIn()
    #expect(model.screen == .picker)
    #expect(store.answer == nil)
    model.chooseUnderwear()
    #expect(model.screen == .underwearOptIn)
  }

  @Test(
    "each sub-pick uses its family's rules",
    arguments: [
      (UnderwearPick.top, CaptureShapeFamily.top), (.bottoms, .shortBottom), (.swimsuit, .onePiece),
      (.tights, .longBottom), (.socks, .smallItem),
    ]
  )
  func subPickFamily(_ pick: UnderwearPick, _ family: CaptureShapeFamily) {
    let (model, _, _) = makeModel(optIn: .allowWorn)
    model.chooseUnderwear(pick)
    #expect(cameraSetup(model)?.family == family)
    #expect(pick.testID == "cap-picker-underwear-\(pick.rawValue)")
  }

  @Test("worn mode is absent until allowed, and appears once allowed")
  func wornAbsentUntilAllowed() {
    let (flatOnly, _, _) = makeModel(optIn: .flatAndHangerOnly)
    flatOnly.chooseUnderwear(.top)
    #expect(flatOnly.modesOffered == [.flat, .hanger])
    flatOnly.selectMode(.worn)
    #expect(cameraSetup(flatOnly)?.mode == .flat)
    let (allowed, _, _) = makeModel(optIn: .allowWorn)
    allowed.chooseUnderwear(.top)
    #expect(allowed.modesOffered == [.flat, .hanger, .worn])
  }

  @Test("the camera menu toggle changes it; turning it off in worn mode switches to flat")
  func cameraMenuToggle() {
    let (model, _, store) = makeModel(optIn: .flatAndHangerOnly)
    model.chooseUnderwear(.swimsuit)
    model.setUnderwearWornAllowed(true)
    #expect(store.answer == .allowWorn)
    model.selectMode(.worn)
    #expect(cameraSetup(model)?.mode == .worn)
    model.setUnderwearWornAllowed(false)
    #expect(store.answer == .flatAndHangerOnly)
    #expect(cameraSetup(model)?.mode == .flat)
    #expect(!model.modesOffered.contains(.worn))
  }

  @Test("the toggle does nothing outside underwear, and other families keep worn")
  func toggleOnlyForUnderwear() {
    let (model, _, store) = makeModel(optIn: .flatAndHangerOnly)
    model.chooseFamily(.top)
    model.setUnderwearWornAllowed(true)
    #expect(store.saves == 0)
    #expect(model.modesOffered.contains(.worn))
  }
}

@Suite("Capture flow: review, back and pair (C4, C7)")
struct CaptureReviewTests {
  @Test("after the front photo the review asks 'Is the back different?', Same by default")
  func reviewAsksBack() throws {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    captureSteadyItem(model, clock, photo: front)
    let shown = try #require(review(model))
    #expect(shown.question == .isBackDifferent)
    #expect(!shown.wantsSecondPhoto)
    #expect(shown.front == front)
    #expect(model.camera == nil)
  }

  @Test("Same → Done ends the flow; the back step does not open without Different")
  func sameThenDone() {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    captureSteadyItem(model, clock, photo: front)
    model.takeSecondPhoto()
    #expect(review(model) != nil)
    model.done()
    #expect(model.screen == .closed)
  }

  @Test("C7: Different → the back guide and step; its photo joins the review")
  func differentTakesBack() throws {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    captureSteadyItem(model, clock, photo: front)
    model.answerSecondPhoto(wanted: true)
    model.takeSecondPhoto()
    #expect(cameraSetup(model)?.side == .back)
    #expect(model.camera?.guide.testID == "cap-guide-top-flat-back")
    captureSteadyItem(model, clock, photo: second)
    let shown = try #require(review(model))
    #expect(shown.front == front)
    #expect(shown.second == second)
  }

  @Test("C7: Skip on the back step returns to review without a back photo")
  func skipBack() throws {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    captureSteadyItem(model, clock, photo: front)
    model.answerSecondPhoto(wanted: true)
    model.takeSecondPhoto()
    model.skipSecondPhoto()
    let shown = try #require(review(model))
    #expect(shown.second == nil)
    #expect(model.camera == nil)
  }

  @Test("the back step restarts the anyway timer")
  func backStepRestartsAnyway() {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    captureSteadyItem(model, clock, photo: front)
    model.answerSecondPhoto(wanted: true)
    model.takeSecondPhoto()
    _ = model.cameraReady()
    clock.advance(byMs: CaptureRules.Timing.anywayDelayMs - 1)
    _ = model.tick()
    #expect(model.camera?.isAnywayVisible == false)
    clock.advance(byMs: 1)
    _ = model.tick()
    #expect(model.camera?.isAnywayVisible == true)
  }

  @Test("C4: shoes ask 'Add a photo of the pair?' and the pair step uses the pair guide")
  func shoesPair() throws {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.shoes)
    captureSteadyItem(model, clock, photo: front)
    #expect(review(model)?.question == .addPairPhoto)
    model.answerSecondPhoto(wanted: true)
    model.takeSecondPhoto()
    #expect(cameraSetup(model)?.side == .pair)
    #expect(model.camera?.guide.testID == "cap-guide-shoes-flat-pair")
    captureSteadyItem(model, clock, photo: second)
    #expect(try #require(review(model)).second == second)
  }

  @Test("Retake opens the front camera again and the new photo replaces the front")
  func retakeReplacesFront() throws {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    captureSteadyItem(model, clock, photo: front)
    model.retake()
    #expect(cameraSetup(model)?.side == .front)
    let newer = CapturePhotoID("photo-front-2")
    captureSteadyItem(model, clock, photo: newer)
    #expect(try #require(review(model)).front == newer)
  }

  @Test("a new category starts a new review")
  func newCategoryForgetsReview() throws {
    let (model, clock, _) = makeModel()
    model.chooseFamily(.top)
    captureSteadyItem(model, clock, photo: front)
    model.close()
    model.chooseFamily(.bag)
    captureSteadyItem(model, clock, photo: second)
    let shown = try #require(review(model))
    #expect(shown.front == second)
    #expect(shown.setup.family == .bag)
  }
}

@Suite("Capture flow: batch (C20)")
struct CaptureBatchTests {
  @Test("C20: ten items with empty gaps → ten captures, count 10, no picker and no back question")
  func tenItems() {
    let (model, clock, _) = makeModel()
    model.startBatch()
    #expect(cameraSetup(model) == CaptureCameraSetup(family: .generic, mode: .flat, side: .front, flow: .batch))
    _ = model.cameraReady()
    for index in 1...10 {
      feedUntilCapture(model, clock)
      _ = model.captureFinished(CapturePhotoID("batch-\(index)"))
      #expect(model.camera?.shutter == .cooldown)
      for _ in 0..<CaptureRules.Batch.cooldownExitEvaluations {
        _ = model.submit(frame(item: nil))
        clock.advance(byMs: stepMs)
      }
    }
    #expect(model.batchPhotos.count == 10)
    #expect(cameraSetup(model)?.flow == .batch)
    model.batchDone()
    #expect(model.screen == .batchSummary((1...10).map { CapturePhotoID("batch-\($0)") }))
  }

  @Test("Next item ends the cooldown at once")
  func nextItem() {
    let (model, clock, _) = makeModel()
    model.startBatch()
    _ = model.cameraReady()
    feedUntilCapture(model, clock)
    _ = model.captureFinished(CapturePhotoID("batch-1"))
    _ = model.nextItemTapped()
    #expect(model.camera?.shutter != .cooldown)
  }
}

@Suite("Capture flow: library import (C21)")
struct CaptureImportTests {
  private let goodStill = frame()
  private let darkEmptyStill = frame(item: nil, meanLuma: CaptureRules.Light.tooDarkBelowMeanLuma - 1)

  @Test("a still with no failing check goes straight to review")
  func goodStillToReview() throws {
    let (model, _, _) = makeModel()
    model.startImport()
    #expect(model.screen == .importPicker)
    model.importPicked(front, observation: goodStill)
    let shown = try #require(review(model))
    #expect(shown.front == front)
    #expect(shown.setup.family == .generic)
  }

  @Test("failing checks show as tips; Keep anyway goes to review")
  func tipsThenKeep() {
    let (model, _, _) = makeModel()
    model.startImport()
    model.importPicked(front, observation: darkEmptyStill)
    #expect(model.screen == .importTips([.noItem, .tooDark]))
    model.keepImportAnyway()
    #expect(review(model)?.front == front)
  }

  @Test("Choose another opens the system picker again")
  func chooseAnother() {
    let (model, _, _) = makeModel()
    model.startImport()
    model.importPicked(front, observation: darkEmptyStill)
    model.chooseAnotherImport()
    #expect(model.screen == .importPicker)
  }

  @Test("cancelling the system picker returns to the picker")
  func cancelReturnsToPicker() {
    let (model, _, _) = makeModel()
    model.startImport()
    model.importCancelled()
    #expect(model.screen == .picker)
  }

  @Test("import from the camera keeps the camera's family; cancel returns to that camera")
  func importFromCamera() {
    let (model, _, _) = makeModel()
    model.chooseFamily(.top)
    model.selectMode(.hanger)
    model.startImport()
    #expect(model.camera == nil)
    let small = frame(item: item(box: centredBox(area: CaptureShapeFamily.top.minAreaShare / 2)))
    model.importPicked(front, observation: small)
    #expect(model.screen == .importTips([.tooSmall]))
    model.chooseAnotherImport()
    model.importCancelled()
    #expect(model.screen == .camera(CaptureCameraSetup(family: .top, mode: .hanger)))
    #expect(model.camera?.shutter == .idle)
  }
}
