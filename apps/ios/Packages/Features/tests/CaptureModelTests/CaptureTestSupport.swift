// Synthetic observations, a fake clock and a fake opt-in store for the capture model tests. No real
// photo, body or person data: every value is a made-up number around a rule's threshold.
import AIStylistKernel
import CaptureModel

/// A clock the test moves by hand.
final class FakeClock: CaptureClock {
  var nowMs = 0

  func advance(byMs milliseconds: Int) {
    nowMs += milliseconds
  }
}

/// Keeps the opt-in answer in memory and counts saves.
final class FakeOptInStore: UnderwearOptInStore {
  private(set) var answer: UnderwearWornOptIn?
  private(set) var saves = 0

  init(_ answer: UnderwearWornOptIn? = nil) {
    self.answer = answer
  }

  func load() -> UnderwearWornOptIn? {
    answer
  }

  func save(_ answer: UnderwearWornOptIn) {
    self.answer = answer
    saves += 1
  }
}

/// One evaluation step at the brief's evaluation rate.
let stepMs = CaptureRules.Evaluation.intervalMs

/// A centred box with the given area share (square in normalised units).
func centredBox(area: Double, centreX: Double = 0.5, centreY: Double = 0.5) -> NormalizedRect {
  let side = area.squareRoot()
  return NormalizedRect(x: centreX - side / 2, y: centreY - side / 2, width: side, height: side)
}

/// A box large enough for every family, well inside the frame.
let goodBox = NormalizedRect(x: 0.2, y: 0.2, width: 0.6, height: 0.6)

/// A sharp, clearly visible item.
func item(
  box: NormalizedRect = goodBox,
  maskAreaShare: Double = 0.3,
  contact: EdgeContact = EdgeContact(),
  sharpness: Double = 20
) -> CaptureItemObservation {
  CaptureItemObservation(box: box, maskAreaShare: maskAreaShare, edgeContact: contact, sharpness: sharpness)
}

/// A well-lit frame; pass `item: nil` for an empty frame.
func frame(
  item: CaptureItemObservation? = item(),
  meanLuma: Double = 120,
  clippedShare: Double = 0,
  motion: CaptureDeviceMotion? = nil,
  tilt: Double? = nil,
  pose: CaptureBodyPose = .notRun
) -> CaptureObservation {
  CaptureObservation(
    timestampMs: 0,
    item: item,
    meanLuma: meanLuma,
    clippedShare: clippedShare,
    deviceMotion: motion,
    tiltDegrees: tilt,
    bodyPose: pose
  )
}

/// Every body part present, centred, at full confidence.
func wholeBody() -> [CaptureBodyPart: CaptureKeypoint] {
  Dictionary(
    uniqueKeysWithValues: CaptureBodyPart.allCases.map { ($0, CaptureKeypoint(x: 0.5, y: 0.5, confidence: 1)) })
}

/// Evaluates `observation` twice so the second evaluation has a previous box (steadiness).
func steadyVerdict(_ observation: CaptureObservation, context: CaptureCheckContext) -> CaptureVerdict {
  var engine = CaptureRuleEngine(context: context)
  _ = engine.evaluate(observation)
  return engine.evaluate(observation)
}

let topFlat = CaptureCheckContext(family: .top, mode: .flat)
