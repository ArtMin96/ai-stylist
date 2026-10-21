// The live checks of capture brief §3 and their §6 priority, each value just below and just above its
// threshold. Thresholds are read from the generated CaptureRules, never restated.
import AIStylistKernel
import CaptureModel
import Testing

/// A margin small next to every threshold, so "just below" and "just above" stay on their side.
private let nudge = 0.001

@Suite("Capture rules: item found, cut off, size")
struct CaptureItemRuleTests {
  @Test("an empty frame locks with no-item")
  func emptyFrameIsNoItem() {
    var engine = CaptureRuleEngine(context: topFlat)
    let verdict = engine.evaluate(frame(item: nil))
    #expect(verdict.blockingHints == [.noItem])
    #expect(verdict.lockReason == .noItem)
    #expect(!verdict.passes)
  }

  @Test("an instance below the minimum mask area counts as no item; at the minimum it is found")
  func minimumInstanceArea() {
    let minimum = CaptureRules.Ios.minInstanceAreaShare
    let below = steadyVerdict(frame(item: item(maskAreaShare: minimum - nudge / 10)), context: topFlat)
    let atMinimum = steadyVerdict(frame(item: item(maskAreaShare: minimum)), context: topFlat)
    #expect(below.blockingHints == [.noItem])
    #expect(atMinimum.passes)
  }

  @Test("the first evaluation that sees an item never passes steady; the next identical one passes")
  func firstSightIsNeverSteady() {
    var engine = CaptureRuleEngine(context: topFlat)
    #expect(engine.evaluate(frame()).blockingHints == [.notSteady])
    #expect(engine.evaluate(frame()).passes)
  }

  @Test("losing the item forgets the previous box, so the next sighting is not steady")
  func noItemResetsSteadiness() {
    var engine = CaptureRuleEngine(context: topFlat)
    _ = engine.evaluate(frame())
    _ = engine.evaluate(frame(item: nil))
    #expect(engine.evaluate(frame()).blockingHints == [.notSteady])
  }

  @Test("cut off: contact just above the limit locks with that edge's hint", arguments: CaptureEdge.allCases)
  func cutOffEachEdge(_ edge: CaptureEdge) {
    let over = CaptureRules.Ios.cutOffAboveEdgeContactShare + nudge
    let verdict = steadyVerdict(frame(item: item(contact: contact(edge, over))), context: topFlat)
    #expect(verdict.blockingHints == [hint(for: edge)])
    #expect(verdict.lockReason == .cutOff)
  }

  @Test("cut off: contact at or just below the limit passes", arguments: CaptureEdge.allCases)
  func cutOffAtLimitPasses(_ edge: CaptureEdge) {
    let limit = CaptureRules.Ios.cutOffAboveEdgeContactShare
    #expect(steadyVerdict(frame(item: item(contact: contact(edge, limit))), context: topFlat).passes)
    #expect(steadyVerdict(frame(item: item(contact: contact(edge, limit - nudge))), context: topFlat).passes)
  }

  @Test("cut off at two or more edges shows the multiple-edges hint")
  func cutOffMultiple() {
    let over = CaptureRules.Ios.cutOffAboveEdgeContactShare + nudge
    let verdict = steadyVerdict(frame(item: item(contact: EdgeContact(left: over, right: over))), context: topFlat)
    #expect(verdict.blockingHints == [.cutOffMultiple])
  }

  @Test("hanger mode: the hook may touch the top edge up to its own limit (C2)")
  func hangerTopException() {
    let hanger = CaptureCheckContext(family: .top, mode: .hanger)
    let hookLimit = CaptureRules.Ios.hangerTopCutOffAboveEdgeContactShare
    #expect(steadyVerdict(frame(item: item(contact: EdgeContact(top: hookLimit))), context: hanger).passes)
    let over = steadyVerdict(frame(item: item(contact: EdgeContact(top: hookLimit + nudge))), context: hanger)
    #expect(over.blockingHints == [.cutOffTop])
  }

  @Test("hanger mode keeps the normal limit on the other edges, and flat mode on the top edge")
  func hangerExceptionIsTopOnly() {
    let hanger = CaptureCheckContext(family: .top, mode: .hanger)
    let over = CaptureRules.Ios.cutOffAboveEdgeContactShare + nudge
    let bottom = steadyVerdict(frame(item: item(contact: EdgeContact(bottom: over))), context: hanger)
    let flatTop = steadyVerdict(frame(item: item(contact: EdgeContact(top: over))), context: topFlat)
    #expect(bottom.blockingHints == [.cutOffBottom])
    #expect(flatTop.blockingHints == [.cutOffTop])
  }

  @Test("a strap grazing the edge within the limit still passes (C6, bag)")
  func bagStrapGrazing() {
    let bag = CaptureCheckContext(family: .bag, mode: .flat)
    let graze = CaptureRules.Ios.cutOffAboveEdgeContactShare
    #expect(steadyVerdict(frame(item: item(contact: EdgeContact(top: graze))), context: bag).passes)
  }

  @Test("too small: just below the family minimum locks, at the minimum passes", arguments: CaptureShapeFamily.allCases)
  func familyMinimumArea(_ family: CaptureShapeFamily) {
    let context = CaptureCheckContext(family: family, mode: .flat)
    let minimum = family.minAreaShare
    let below = steadyVerdict(frame(item: item(box: strip(area: minimum - nudge / 10))), context: context)
    let atMinimum = steadyVerdict(frame(item: item(box: strip(area: minimum))), context: context)
    #expect(below.blockingHints == [.tooSmall])
    #expect(atMinimum.passes)
  }

  @Test("worn mode uses the worn minimum for every family", arguments: CaptureShapeFamily.allCases)
  func wornMinimumArea(_ family: CaptureShapeFamily) {
    let context = CaptureCheckContext(family: family, mode: .worn)
    let minimum = CaptureRules.Worn.minAreaShare
    let pose = CaptureBodyPose.observed(wholeBody())
    let below = steadyVerdict(frame(item: item(box: strip(area: minimum - nudge)), pose: pose), context: context)
    let atMinimum = steadyVerdict(frame(item: item(box: strip(area: minimum)), pose: pose), context: context)
    #expect(below.blockingHints == [.tooSmall])
    #expect(atMinimum.passes)
  }

  @Test("a ring-sized small item passes at the small-item minimum and asks to move closer below it (C5)")
  func smallItemMinimum() {
    let context = CaptureCheckContext(family: .smallItem, mode: .flat)
    let minimum = CaptureShapeFamily.smallItem.minAreaShare
    #expect(steadyVerdict(frame(item: item(box: centredBox(area: minimum + nudge / 10))), context: context).passes)
    let small = steadyVerdict(frame(item: item(box: centredBox(area: minimum - nudge / 10))), context: context)
    #expect(small.blockingHint == .tooSmall)
  }

  @Test("'Not sure' uses the generic size minimum (C17)")
  func genericMinimum() {
    let context = CaptureCheckContext(family: .generic, mode: .flat)
    let minimum = CaptureShapeFamily.generic.minAreaShare
    #expect(steadyVerdict(frame(item: item(box: strip(area: minimum))), context: context).passes)
    #expect(
      steadyVerdict(frame(item: item(box: strip(area: minimum - nudge))), context: context).blockingHint == .tooSmall)
  }

  @Test("two items in the frame never lock (C15)")
  func severalItemsDoNotLock() {
    let two = CaptureItemObservation(box: goodBox, maskAreaShare: 0.3, instanceCount: 2, sharpness: 20)
    #expect(steadyVerdict(frame(item: two), context: topFlat).passes)
  }
}

@Suite("Capture rules: steadiness")
struct CaptureSteadyRuleTests {
  @Test("a centre shift just below the limit is steady, just above is not", arguments: [true, false])
  func centreShift(horizontal: Bool) {
    let limit = CaptureRules.Steady.maxCentreShift
    #expect(shifted(by: limit - nudge, horizontal: horizontal).passes)
    #expect(shifted(by: limit + nudge, horizontal: horizontal).blockingHints == [.notSteady])
  }

  @Test("an area change just below the limit is steady, just above is not")
  func areaChange() {
    let limit = CaptureRules.Steady.maxAreaChangeShare
    #expect(resized(by: limit - nudge).passes)
    #expect(resized(by: limit + nudge).blockingHints == [.notSteady])
  }

  @Test("sharpness at the minimum is steady, just below is not")
  func sharpness() {
    let minimum = CaptureRules.Steady.minSharpness
    #expect(steadyVerdict(frame(item: item(sharpness: minimum)), context: topFlat).passes)
    #expect(
      steadyVerdict(frame(item: item(sharpness: minimum - nudge)), context: topFlat).blockingHints == [.notSteady])
  }

  @Test("user acceleration at the limit is steady, just above is not")
  func userAcceleration() {
    let limit = CaptureRules.Ios.maxUserAccelerationG
    let still = CaptureDeviceMotion(userAccelerationG: limit, rotationRateRadPerS: 0)
    let shaking = CaptureDeviceMotion(userAccelerationG: limit + nudge, rotationRateRadPerS: 0)
    #expect(steadyVerdict(frame(motion: still), context: topFlat).passes)
    #expect(steadyVerdict(frame(motion: shaking), context: topFlat).blockingHints == [.notSteady])
  }

  @Test("rotation rate at the limit is steady, just above is not")
  func rotationRate() {
    let limit = CaptureRules.Ios.maxRotationRateRadPerS
    let still = CaptureDeviceMotion(userAccelerationG: 0, rotationRateRadPerS: limit)
    let turning = CaptureDeviceMotion(userAccelerationG: 0, rotationRateRadPerS: limit + nudge)
    #expect(steadyVerdict(frame(motion: still), context: topFlat).passes)
    #expect(steadyVerdict(frame(motion: turning), context: topFlat).blockingHints == [.notSteady])
  }

  @Test("without a motion sensor the device-motion check is skipped")
  func noMotionSensor() {
    #expect(steadyVerdict(frame(motion: nil), context: topFlat).passes)
  }

  private func shifted(by shift: Double, horizontal: Bool) -> CaptureVerdict {
    var engine = CaptureRuleEngine(context: topFlat)
    let area = goodBox.area
    _ = engine.evaluate(frame(item: item(box: centredBox(area: area))))
    let moved =
      horizontal ? centredBox(area: area, centreX: 0.5 + shift) : centredBox(area: area, centreY: 0.5 + shift)
    return engine.evaluate(frame(item: item(box: moved)))
  }

  private func resized(by change: Double) -> CaptureVerdict {
    var engine = CaptureRuleEngine(context: topFlat)
    let area = goodBox.area
    _ = engine.evaluate(frame(item: item(box: centredBox(area: area))))
    return engine.evaluate(frame(item: item(box: centredBox(area: area * (1 + change)))))
  }
}

@Suite("Capture rules: light and tilt are hints only")
struct CaptureAdvisoryRuleTests {
  @Test("mean luma just below the dark limit hints too dark; at the limit it does not")
  func tooDark() {
    let limit = CaptureRules.Light.tooDarkBelowMeanLuma
    let dark = steadyVerdict(frame(meanLuma: limit - nudge), context: topFlat)
    #expect(dark.advisoryHints == [.tooDark])
    #expect(dark.passes)
    #expect(steadyVerdict(frame(meanLuma: limit), context: topFlat).advisoryHints.isEmpty)
  }

  @Test("mean luma just above the bright limit hints too bright; at the limit it does not")
  func tooBrightLuma() {
    let limit = CaptureRules.Light.tooBrightAboveMeanLuma
    let bright = steadyVerdict(frame(meanLuma: limit + nudge), context: topFlat)
    #expect(bright.advisoryHints == [.tooBright])
    #expect(bright.passes)
    #expect(steadyVerdict(frame(meanLuma: limit), context: topFlat).advisoryHints.isEmpty)
  }

  @Test("a clipped share just above the limit hints too bright; at the limit it does not")
  func tooBrightClipped() {
    let limit = CaptureRules.Light.tooBrightAboveClippedShare
    #expect(steadyVerdict(frame(clippedShare: limit + nudge), context: topFlat).advisoryHints == [.tooBright])
    #expect(steadyVerdict(frame(clippedShare: limit), context: topFlat).advisoryHints.isEmpty)
  }

  @Test("too dark ranks before too bright")
  func darkBeforeBright() {
    let verdict = steadyVerdict(
      frame(meanLuma: CaptureRules.Light.tooDarkBelowMeanLuma - 1, clippedShare: 1),
      context: topFlat
    )
    #expect(verdict.advisoryHints == [.tooDark, .tooBright])
  }

  @Test("a dim room shows too dark and still lets the shutter unlock (C13)")
  func dimRoomStillPasses() {
    let verdict = steadyVerdict(frame(meanLuma: CaptureRules.Light.tooDarkBelowMeanLuma - 1), context: topFlat)
    #expect(verdict.passes)
    #expect(verdict.advisoryHint == .tooDark)
  }

  @Test("tilt: on just above the on-limit, not at it")
  func tiltOn() {
    var atLimit = CaptureRuleEngine(context: topFlat)
    #expect(!atLimit.evaluate(frame(tilt: CaptureRules.Tilt.hintAboveDegrees)).reports(.tilt))
    var above = CaptureRuleEngine(context: topFlat)
    let verdict = above.evaluate(frame(tilt: CaptureRules.Tilt.hintAboveDegrees + nudge))
    #expect(verdict.reports(.tilt))
    #expect(!verdict.blockingHints.contains(.tilt))
  }

  @Test("tilt hysteresis: once on, it stays on at the clear limit and clears just below it")
  func tiltHysteresis() {
    var engine = CaptureRuleEngine(context: topFlat)
    _ = engine.evaluate(frame(tilt: CaptureRules.Tilt.hintAboveDegrees + 1))
    let between = (CaptureRules.Tilt.hintAboveDegrees + CaptureRules.Tilt.clearBelowDegrees) / 2
    #expect(engine.evaluate(frame(tilt: between)).reports(.tilt))
    #expect(engine.evaluate(frame(tilt: CaptureRules.Tilt.clearBelowDegrees)).reports(.tilt))
    #expect(!engine.evaluate(frame(tilt: CaptureRules.Tilt.clearBelowDegrees - nudge)).reports(.tilt))
    #expect(!engine.evaluate(frame(tilt: between)).reports(.tilt))
  }

  @Test("tilt is checked in flat mode only, and only with a gravity sensor", arguments: [CaptureMode.hanger, .worn])
  func tiltFlatOnly(_ mode: CaptureMode) {
    var engine = CaptureRuleEngine(context: CaptureCheckContext(family: .generic, mode: mode))
    #expect(!engine.evaluate(frame(tilt: 90)).reports(.tilt))
    var flat = CaptureRuleEngine(context: topFlat)
    #expect(!flat.evaluate(frame(tilt: nil)).reports(.tilt))
  }
}

@Suite("Capture rules: priority")
struct CapturePriorityTests {
  @Test("blocking checks rank no-item, cut off, too small, not steady")
  func blockingOrder() {
    var engine = CaptureRuleEngine(context: topFlat)
    let over = CaptureRules.Ios.cutOffAboveEdgeContactShare + nudge
    let verdict = engine.evaluate(frame(item: item(box: centredBox(area: 0.01), contact: EdgeContact(left: over))))
    #expect(verdict.blockingHints == [.cutOffLeft, .tooSmall, .notSteady])
    #expect(verdict.blockingHint == .cutOffLeft)
  }

  @Test("an empty dark frame blocks with no-item and keeps too dark as the advisory hint")
  func noItemAndDark() {
    var engine = CaptureRuleEngine(context: topFlat)
    let verdict = engine.evaluate(frame(item: nil, meanLuma: CaptureRules.Light.tooDarkBelowMeanLuma - 1))
    #expect(verdict.blockingHints == [.noItem])
    #expect(verdict.advisoryHints == [.tooDark])
  }

  @Test("the advisory hints follow light before tilt")
  func advisoryOrder() {
    var engine = CaptureRuleEngine(context: topFlat)
    let verdict = engine.evaluate(frame(meanLuma: CaptureRules.Light.tooDarkBelowMeanLuma - 1, tilt: 45))
    #expect(verdict.advisoryHints == [.tooDark, .tilt])
  }
}

@Suite("Capture rules: worn mode")
struct CaptureWornRuleTests {
  // nonisolated: @Test(arguments:) reads its argument list outside the main actor.
  private nonisolated static let bodyChecked = CaptureShapeFamily.allCases.filter { $0.wornHint != nil }

  @Test("the edge rule is off: a frame touching the edges passes worn and locks flat (C3)")
  func edgeRuleOff() {
    let touching = item(contact: EdgeContact(top: 0.5, bottom: 0.5, left: 0.5, right: 0.5))
    let worn = CaptureCheckContext(family: .top, mode: .worn)
    #expect(steadyVerdict(frame(item: touching, pose: .observed(wholeBody())), context: worn).passes)
    #expect(steadyVerdict(frame(item: touching), context: topFlat).blockingHint == .cutOffMultiple)
  }

  @Test("the whole body in frame passes", arguments: bodyChecked)
  func wholeBodyPasses(_ family: CaptureShapeFamily) {
    let context = CaptureCheckContext(family: family, mode: .worn)
    #expect(steadyVerdict(frame(pose: .observed(wholeBody())), context: context).passes)
  }

  @Test("each missing required part locks with the family's body hint", arguments: bodyChecked)
  func missingPartLocks(_ family: CaptureShapeFamily) throws {
    let context = CaptureCheckContext(family: family, mode: .worn)
    let hint = try #require(family.wornHint)
    for part in family.wornRequiredParts {
      var body = wholeBody()
      body[part] = nil
      let verdict = steadyVerdict(frame(pose: .observed(body)), context: context)
      #expect(verdict.blockingHints == [hint], "missing \(part.rawValue)")
      #expect(verdict.lockReason == .bodyPartsMissing)
    }
  }

  @Test("no person found means every part is missing", arguments: bodyChecked)
  func noPerson(_ family: CaptureShapeFamily) {
    let context = CaptureCheckContext(family: family, mode: .worn)
    #expect(steadyVerdict(frame(pose: .observed([:])), context: context).blockingHint == family.wornHint)
  }

  @Test("a part not required by the family may be missing")
  func unrequiredPartMayBeMissing() {
    var body = wholeBody()
    body[.leftAnkle] = nil
    let context = CaptureCheckContext(family: .top, mode: .worn)
    #expect(steadyVerdict(frame(pose: .observed(body)), context: context).passes)
  }

  @Test("keypoint confidence at the minimum is present, just below is missing")
  func keypointConfidence() {
    let minimum = CaptureRules.Ios.minKeypointConfidence
    #expect(wornVerdict(leftShoulder: CaptureKeypoint(x: 0.5, y: 0.5, confidence: minimum)).passes)
    let low = wornVerdict(leftShoulder: CaptureKeypoint(x: 0.5, y: 0.5, confidence: minimum - nudge))
    #expect(low.blockingHint == .bodyShouldersHips)
  }

  @Test("a keypoint inside the edge band counts as missing", arguments: [true, false])
  func keypointEdgeBand(horizontal: Bool) {
    let low = CaptureRules.Worn.keypointMinCoordinate
    let high = CaptureRules.Worn.keypointMaxCoordinate
    for (coordinate, isPresent) in [(low, true), (low - nudge, false), (high, true), (high + nudge, false)] {
      let point =
        horizontal
        ? CaptureKeypoint(x: coordinate, y: 0.5, confidence: 1) : CaptureKeypoint(x: 0.5, y: coordinate, confidence: 1)
      #expect(wornVerdict(leftShoulder: point).passes == isPresent, "coordinate \(coordinate)")
    }
  }

  @Test("the generic family has no body check in worn mode")
  func genericHasNoBodyCheck() {
    let context = CaptureCheckContext(family: .generic, mode: .worn)
    let verdict = steadyVerdict(frame(pose: .observed([:])), context: context)
    #expect(verdict.passes)
    #expect(!verdict.blockingHints.contains { $0.lockReason == .bodyPartsMissing })
  }

  @Test("the body check runs only after an item is found")
  func bodyCheckAfterItemFound() {
    var engine = CaptureRuleEngine(context: CaptureCheckContext(family: .top, mode: .worn))
    #expect(engine.evaluate(frame(item: nil, pose: .observed([:]))).blockingHints == [.noItem])
  }

  @Test("a missing body part ranks before too small")
  func bodyBeforeTooSmall() {
    let context = CaptureCheckContext(family: .top, mode: .worn)
    let verdict = steadyVerdict(frame(item: item(box: centredBox(area: 0.1)), pose: .observed([:])), context: context)
    #expect(verdict.blockingHints == [.bodyShouldersHips, .tooSmall])
  }

  @Test("pose model unavailable: no lock, the body hint becomes a tip, fallback on", arguments: bodyChecked)
  func modelUnavailableFallback(_ family: CaptureShapeFamily) {
    let context = CaptureCheckContext(family: family, mode: .worn)
    let verdict = steadyVerdict(frame(pose: .modelUnavailable), context: context)
    #expect(verdict.passes)
    #expect(verdict.isFallback)
    #expect(verdict.advisoryHint == family.wornHint)
  }

  @Test("pose not run in worn mode is treated as unavailable")
  func notRunInWornIsFallback() {
    let verdict = steadyVerdict(frame(pose: .notRun), context: CaptureCheckContext(family: .top, mode: .worn))
    #expect(verdict.isFallback)
    #expect(verdict.passes)
  }

  @Test("outside worn mode the pose is ignored")
  func poseIgnoredOutsideWorn() {
    let verdict = steadyVerdict(frame(pose: .modelUnavailable), context: topFlat)
    #expect(!verdict.isFallback)
    #expect(verdict.advisoryHints.isEmpty)
  }

  private func wornVerdict(leftShoulder: CaptureKeypoint) -> CaptureVerdict {
    var body = wholeBody()
    body[.leftShoulder] = leftShoulder
    return steadyVerdict(frame(pose: .observed(body)), context: CaptureCheckContext(family: .top, mode: .worn))
  }
}

@Suite("Capture rules: library import")
struct CaptureImportRuleTests {
  @Test("a good still has no tips, even blurred and tilted (no steadiness or tilt check)")
  func goodStill() {
    #expect(CaptureRuleEngine.importTips(for: frame(item: item(sharpness: 0), tilt: 90)).isEmpty)
  }

  @Test("an empty still reports no item, plus the light tips")
  func emptyStill() {
    let dark = frame(item: nil, meanLuma: CaptureRules.Light.tooDarkBelowMeanLuma - 1)
    #expect(CaptureRuleEngine.importTips(for: dark) == [.noItem, .tooDark])
  }

  @Test("every failing check is a tip, in priority order")
  func everyFailingCheck() {
    let over = CaptureRules.Ios.cutOffAboveEdgeContactShare + nudge
    let still = frame(
      item: item(box: centredBox(area: 0.01), contact: EdgeContact(top: over)),
      meanLuma: CaptureRules.Light.tooBrightAboveMeanLuma + 1
    )
    #expect(CaptureRuleEngine.importTips(for: still) == [.cutOffTop, .tooSmall, .tooBright])
  }

  @Test("an import has no mode, so the top edge uses the flat limit")
  func flatEdgeRule() {
    let over = CaptureRules.Ios.cutOffAboveEdgeContactShare + nudge
    #expect(CaptureRuleEngine.importTips(for: frame(item: item(contact: EdgeContact(top: over)))) == [.cutOffTop])
  }

  @Test("without a family the generic minimum applies; a family uses its own")
  func importMinimum() {
    let generic = CaptureShapeFamily.generic.minAreaShare
    #expect(CaptureRuleEngine.importTips(for: frame(item: item(box: strip(area: generic)))).isEmpty)
    #expect(CaptureRuleEngine.importTips(for: frame(item: item(box: strip(area: generic - nudge)))) == [.tooSmall])
    let topStill = frame(item: item(box: strip(area: CaptureShapeFamily.top.minAreaShare - nudge)))
    #expect(CaptureRuleEngine.importTips(for: topStill, family: .top) == [.tooSmall])
  }
}

@Suite("Capture geometry")
struct CaptureGeometryTests {
  @Test("IoU: identical boxes 1, disjoint 0, an empty box 0, half overlap one third")
  func intersectionOverUnion() {
    let box = NormalizedRect(x: 0, y: 0, width: 0.5, height: 0.5)
    let empty = NormalizedRect(x: 0, y: 0, width: 0, height: 0)
    #expect(box.intersectionOverUnion(with: box) == 1)
    #expect(box.intersectionOverUnion(with: NormalizedRect(x: 0.5, y: 0.5, width: 0.5, height: 0.5)) == 0)
    #expect(empty.intersectionOverUnion(with: empty) == 0)
    let shifted = NormalizedRect(x: 0.25, y: 0, width: 0.5, height: 0.5)
    #expect(abs(box.intersectionOverUnion(with: shifted) - 1.0 / 3.0) < 1e-12)
  }
}

// MARK: - Helpers

/// A full-height strip whose area is exactly `area` (width × 1).
private func strip(area: Double) -> NormalizedRect {
  NormalizedRect(x: 0.5 - area / 2, y: 0, width: area, height: 1)
}

private func contact(_ edge: CaptureEdge, _ share: Double) -> EdgeContact {
  switch edge {
  case .top: EdgeContact(top: share)
  case .bottom: EdgeContact(bottom: share)
  case .left: EdgeContact(left: share)
  case .right: EdgeContact(right: share)
  }
}

private func hint(for edge: CaptureEdge) -> CaptureHint {
  switch edge {
  case .top: .cutOffTop
  case .bottom: .cutOffBottom
  case .left: .cutOffLeft
  case .right: .cutOffRight
  }
}
