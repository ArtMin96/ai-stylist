// The live checks of capture brief §3 and their priority (§6). Every threshold comes from the
// generated `CaptureRules`; nothing here restates a number. The types are `nonisolated` pure values so
// the platform layer may evaluate on its analysis queue, off the main actor.
public import AIStylistKernel

/// What a capture is checked for: the shape family and the capture mode.
nonisolated public struct CaptureCheckContext: Equatable, Sendable {
  public let family: CaptureShapeFamily
  public let mode: CaptureMode

  public init(family: CaptureShapeFamily, mode: CaptureMode) {
    self.family = family
    self.mode = mode
  }
}

/// The result of evaluating one observation.
nonisolated public struct CaptureVerdict: Equatable, Sendable {
  /// Every failing blocking check's hint, highest priority first (§6 rows 2–5, covered after the body check).
  public let blockingHints: [CaptureHint]
  /// Every non-blocking hint that applies, highest priority first (§6 rows 6–8; the body tip in the
  /// pose-model fallback comes first).
  public let advisoryHints: [CaptureHint]
  /// The pose model is unavailable in a body-checked worn capture: "Take photo anyway" shows at once.
  public let isFallback: Bool

  public init(blockingHints: [CaptureHint], advisoryHints: [CaptureHint], isFallback: Bool = false) {
    self.blockingHints = blockingHints
    self.advisoryHints = advisoryHints
    self.isFallback = isFallback
  }

  /// True when no blocking check fails.
  public var passes: Bool { blockingHints.isEmpty }
  /// The highest-priority failing blocking check's hint.
  public var blockingHint: CaptureHint? { blockingHints.first }
  /// The lock reason of `blockingHint`.
  public var lockReason: CaptureLockReason? { blockingHint?.lockReason }
  /// The highest-priority advisory hint.
  public var advisoryHint: CaptureHint? { advisoryHints.first }

  /// True when the verdict contains `hint`, blocking or advisory.
  public func reports(_ hint: CaptureHint) -> Bool {
    blockingHints.contains(hint) || advisoryHints.contains(hint)
  }
}

/// Evaluates observations one after another. It keeps the state the rules need across evaluations: the
/// last mask's box and whether the box was still between the last two masks (steadiness), and whether
/// the tilt hint is on (hysteresis).
nonisolated public struct CaptureRuleEngine: Sendable {
  public private(set) var context: CaptureCheckContext
  private var lastMask: (timestampMs: Int?, box: NormalizedRect)?
  private var isBoxStill = false
  private var isTiltHintOn = false

  public init(context: CaptureCheckContext) {
    self.context = context
  }

  /// Switches family or mode and forgets the previous box and tilt state.
  public mutating func reset(context: CaptureCheckContext) {
    self.context = context
    reset()
  }

  /// Forgets the previous box and tilt state (camera restart, mode change).
  public mutating func reset() {
    lastMask = nil
    isBoxStill = false
    isTiltHintOn = false
  }

  /// Evaluates one live frame.
  public mutating func evaluate(_ observation: CaptureObservation) -> CaptureVerdict {
    let item = Self.foundItem(in: observation)
    updateBoxMotion(item?.box, maskTimestampMs: observation.maskTimestampMs)

    var blocking: [CaptureHint] = []
    var advisory: [CaptureHint] = []
    var isFallback = false

    if let item {
      if context.mode != .worn, let cutOff = Self.cutOffHint(item.edgeContact, topLimit: topEdgeLimit) {
        blocking.append(cutOff)
      }
      if context.mode == .worn, let wornHint = context.family.wornHint {
        switch Self.bodyCheck(observation.bodyPose, required: context.family.wornRequiredParts) {
        case .passes:
          break
        case .missingParts:
          blocking.append(wornHint)
        case .modelUnavailable:
          advisory.append(wornHint)
          isFallback = true
        }
      }
      if context.mode != .worn, Self.isCovered(item) {
        blocking.append(.covered)
      }
      if item.box.area < minAreaShare {
        blocking.append(.tooSmall)
      }
      if !isBoxStill || !Self.isSharpAndStill(item, motion: observation.deviceMotion) {
        blocking.append(.notSteady)
      }
    } else {
      blocking.append(.noItem)
    }

    advisory += Self.lightHints(meanLuma: observation.meanLuma, clippedShare: observation.clippedShare)
    if updateTilt(observation.tiltDegrees) {
      advisory.append(.tilt)
    }
    return CaptureVerdict(blockingHints: blocking, advisoryHints: advisory, isFallback: isFallback)
  }

  /// Library import (capture brief §7): the checks that apply to one still, in priority order: item
  /// found, cut off, too small, too dark, too bright. No steadiness, tilt or body check; the edge rule
  /// is the flat one because an import has no mode.
  public static func importTips(
    for observation: CaptureObservation,
    family: CaptureShapeFamily = .generic
  ) -> [CaptureHint] {
    var tips: [CaptureHint] = []
    if let item = foundItem(in: observation) {
      if let cutOff = cutOffHint(item.edgeContact, topLimit: CaptureRules.Ios.cutOffAboveEdgeContactShare) {
        tips.append(cutOff)
      }
      if item.box.area < family.minAreaShare {
        tips.append(.tooSmall)
      }
    } else {
      tips.append(.noItem)
    }
    return tips + lightHints(meanLuma: observation.meanLuma, clippedShare: observation.clippedShare)
  }

  // MARK: - Checks

  private var minAreaShare: Double {
    context.mode == .worn ? CaptureRules.Worn.minAreaShare : context.family.minAreaShare
  }

  /// Hanger mode tolerates the hook at the top edge (§3, C2).
  private var topEdgeLimit: Double {
    context.mode == .hanger
      ? CaptureRules.Ios.hangerTopCutOffAboveEdgeContactShare : CaptureRules.Ios.cutOffAboveEdgeContactShare
  }

  private static func foundItem(in observation: CaptureObservation) -> CaptureItemObservation? {
    guard let item = observation.item, item.maskAreaShare >= CaptureRules.Ios.minInstanceAreaShare else {
      return nil
    }
    return item
  }

  /// One edge touched → that edge's hint; two or more → `cutOffMultiple`.
  private static func cutOffHint(_ contact: EdgeContact, topLimit: Double) -> CaptureHint? {
    let edges = CaptureEdge.allCases.filter { edge in
      let limit = edge == .top ? topLimit : CaptureRules.Ios.cutOffAboveEdgeContactShare
      return contact.share(at: edge) > limit
    }
    guard let edge = edges.first else { return nil }
    guard edges.count == 1 else { return .cutOffMultiple }
    switch edge {
    case .top: return .cutOffTop
    case .bottom: return .cutOffBottom
    case .left: return .cutOffLeft
    case .right: return .cutOffRight
    }
  }

  /// Partly covered (§4, C32): another object's box at least `minOtherBoxAreaShare` of the frame overlaps
  /// the item's box by more than `aboveOverlapShare` of the smaller box. Two items side by side do not
  /// overlap, so they never lock (Q15).
  private static func isCovered(_ item: CaptureItemObservation) -> Bool {
    item.otherBoxes.contains { other in
      other.area >= CaptureRules.Covered.minOtherBoxAreaShare
        && item.box.overlapShareOfSmaller(with: other) > CaptureRules.Covered.aboveOverlapShare
    }
  }

  private enum BodyCheck {
    case passes
    case missingParts
    case modelUnavailable
  }

  /// The worn-mode body check (§3). `.notRun` in worn mode means the platform could not run the pose
  /// model, so it is treated as unavailable.
  private static func bodyCheck(_ pose: CaptureBodyPose, required: [CaptureBodyPart]) -> BodyCheck {
    switch pose {
    case .notRun, .modelUnavailable:
      return .modelUnavailable
    case .observed(let keypoints):
      let allPresent = required.allSatisfy { part in
        keypoints[part].map(isPresent) ?? false
      }
      return allPresent ? .passes : .missingParts
    }
  }

  private static func isPresent(_ keypoint: CaptureKeypoint) -> Bool {
    let range = CaptureRules.Worn.keypointMinCoordinate...CaptureRules.Worn.keypointMaxCoordinate
    return keypoint.confidence >= CaptureRules.Ios.minKeypointConfidence
      && range.contains(keypoint.x) && range.contains(keypoint.y)
  }

  /// Steady, box part (§3): the box moved less than the limits between the last two masks. A reused mask
  /// keeps the verdict of its own comparison, because a box compared with itself never moves. The first
  /// mask that shows an item never passes, because there is no earlier mask.
  private mutating func updateBoxMotion(_ box: NormalizedRect?, maskTimestampMs: Int?) {
    guard let box else {
      lastMask = nil
      isBoxStill = false
      return
    }
    if let lastMask, let maskTimestampMs, lastMask.timestampMs == maskTimestampMs {
      return
    }
    isBoxStill = lastMask.map { Self.isStill(box, previous: $0.box) } ?? false
    lastMask = (maskTimestampMs, box)
  }

  private static func isStill(_ box: NormalizedRect, previous: NormalizedRect) -> Bool {
    previous.area > 0
      && abs(box.centreX - previous.centreX) <= CaptureRules.Steady.maxCentreShift
      && abs(box.centreY - previous.centreY) <= CaptureRules.Steady.maxCentreShift
      && abs(box.area - previous.area) / previous.area <= CaptureRules.Steady.maxAreaChangeShare
  }

  /// Steady, every evaluation (§3): the item is sharp and the device is still.
  private static func isSharpAndStill(_ item: CaptureItemObservation, motion: CaptureDeviceMotion?) -> Bool {
    let isSharp = item.sharpness >= CaptureRules.Steady.minSharpness
    let deviceIsStill =
      motion.map {
        $0.userAccelerationG <= CaptureRules.Ios.maxUserAccelerationG
          && $0.rotationRateRadPerS <= CaptureRules.Ios.maxRotationRateRadPerS
      } ?? true
    return isSharp && deviceIsStill
  }

  /// Too dark before too bright (§6 rows 6–7); hints only, never a lock (Q15).
  private static func lightHints(meanLuma: Double, clippedShare: Double) -> [CaptureHint] {
    var hints: [CaptureHint] = []
    if meanLuma < CaptureRules.Light.tooDarkBelowMeanLuma {
      hints.append(.tooDark)
    }
    if meanLuma > CaptureRules.Light.tooBrightAboveMeanLuma
      || clippedShare > CaptureRules.Light.tooBrightAboveClippedShare
    {
      hints.append(.tooBright)
    }
    return hints
  }

  /// Tilt (flat mode, phones only): on above `hintAboveDegrees`, off below `clearBelowDegrees`.
  private mutating func updateTilt(_ degrees: Double?) -> Bool {
    guard context.mode == .flat, let degrees else {
      isTiltHintOn = false
      return false
    }
    if isTiltHintOn {
      isTiltHintOn = degrees >= CaptureRules.Tilt.clearBelowDegrees
    } else {
      isTiltHintOn = degrees > CaptureRules.Tilt.hintAboveDegrees
    }
    return isTiltHintOn
  }
}
