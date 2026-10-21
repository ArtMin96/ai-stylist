// Per-frame input of the capture rules (capture brief §3, §4 "Inputs"). The platform layer fills it
// (phase B: AVFoundation + Vision, or the debug frame source); the rules never see pixels.
// The value types are `nonisolated` because the platform layer builds them on its analysis queue,
// off the main actor, before handing them to the model.
public import AIStylistKernel

/// A rectangle in the analysis frame, normalised to 0–1 (portrait, origin top-left).
nonisolated public struct NormalizedRect: Equatable, Sendable {
  public let x: Double
  public let y: Double
  public let width: Double
  public let height: Double

  public init(x: Double, y: Double, width: Double, height: Double) {
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }

  /// Share of the frame the rectangle covers.
  public var area: Double { width * height }
  public var centreX: Double { x + width / 2 }
  public var centreY: Double { y + height / 2 }

  /// Intersection over union with `other`: 0 when they do not overlap or both are empty.
  public func intersectionOverUnion(with other: NormalizedRect) -> Double {
    let overlapWidth = max(0, min(x + width, other.x + other.width) - max(x, other.x))
    let overlapHeight = max(0, min(y + height, other.y + other.height) - max(y, other.y))
    let intersection = overlapWidth * overlapHeight
    let union = area + other.area - intersection
    return union > 0 ? intersection / union : 0
  }
}

/// For each frame edge, the share of that edge's length the item mask spans inside the edge band
/// (`CaptureRules.edgeBandShare` of the frame). Edges are named as the user sees the screen.
nonisolated public struct EdgeContact: Equatable, Sendable {
  public let top: Double
  public let bottom: Double
  public let left: Double
  public let right: Double

  public init(top: Double = 0, bottom: Double = 0, left: Double = 0, right: Double = 0) {
    self.top = top
    self.bottom = bottom
    self.left = left
    self.right = right
  }

  /// The contact share of one edge.
  public func share(at edge: CaptureEdge) -> Double {
    switch edge {
    case .top: top
    case .bottom: bottom
    case .left: left
    case .right: right
    }
  }
}

/// A frame edge, as the user sees the screen.
nonisolated public enum CaptureEdge: CaseIterable, Hashable, Sendable {
  case top
  case bottom
  case left
  case right
}

/// The item the platform detector found (iOS: the largest Vision foreground instance).
nonisolated public struct CaptureItemObservation: Equatable, Sendable {
  /// Bounding box of the item's mask.
  public let box: NormalizedRect
  /// Mask pixels of that instance ÷ frame pixels ("item found" needs `CaptureRules.Ios.minInstanceAreaShare`).
  public let maskAreaShare: Double
  public let edgeContact: EdgeContact
  /// Foreground instances in the frame. Several items never lock (Q15); kept for the results log.
  public let instanceCount: Int
  /// Variance of the 3×3 Laplacian on luma inside the box, luma scaled to `Steady.sharpnessLongSidePx`.
  public let sharpness: Double

  public init(
    box: NormalizedRect,
    maskAreaShare: Double,
    edgeContact: EdgeContact = EdgeContact(),
    instanceCount: Int = 1,
    sharpness: Double
  ) {
    self.box = box
    self.maskAreaShare = maskAreaShare
    self.edgeContact = edgeContact
    self.instanceCount = instanceCount
    self.sharpness = sharpness
  }
}

/// Device motion read at the frame (phones only).
nonisolated public struct CaptureDeviceMotion: Equatable, Sendable {
  /// User acceleration magnitude, in g.
  public let userAccelerationG: Double
  /// Rotation rate magnitude, in rad/s.
  public let rotationRateRadPerS: Double

  public init(userAccelerationG: Double, rotationRateRadPerS: Double) {
    self.userAccelerationG = userAccelerationG
    self.rotationRateRadPerS = rotationRateRadPerS
  }
}

/// One body keypoint, normalised to the analysis frame with origin top-left (Vision's y flipped first).
nonisolated public struct CaptureKeypoint: Equatable, Sendable {
  public let x: Double
  public let y: Double
  /// Joint confidence, 0–1.
  public let confidence: Double

  public init(x: Double, y: Double, confidence: Double) {
    self.x = x
    self.y = y
    self.confidence = confidence
  }
}

/// What the body-pose model reported for the frame (capture brief §3 "Worn mode").
nonisolated public enum CaptureBodyPose: Equatable, Sendable {
  /// Not requested: every mode but worn.
  case notRun
  /// The pose model failed to load or errored: the doc-10 fallback applies (no lock, tip, anyway at once).
  case modelUnavailable
  /// Keypoints of the person found; an empty dictionary means no person was found.
  case observed([CaptureBodyPart: CaptureKeypoint])
}

/// Everything the rules read from one analysed frame.
nonisolated public struct CaptureObservation: Equatable, Sendable {
  /// Frame time in milliseconds, for the results log; the rules time everything with the injected clock.
  public let timestampMs: Int
  /// The item, or nil when no item was found.
  public let item: CaptureItemObservation?
  /// Mean luma of the whole frame, 0–255.
  public let meanLuma: Double
  /// Share of pixels with luma ≥ `CaptureRules.Light.clippedMinLuma`.
  public let clippedShare: Double
  /// Nil when the device has no motion sensor (not a phone): the device-motion check is skipped.
  public let deviceMotion: CaptureDeviceMotion?
  /// Angle between gravity and the phone's back axis, in degrees; nil when not a phone.
  public let tiltDegrees: Double?
  public let bodyPose: CaptureBodyPose

  public init(
    timestampMs: Int,
    item: CaptureItemObservation?,
    meanLuma: Double,
    clippedShare: Double = 0,
    deviceMotion: CaptureDeviceMotion? = nil,
    tiltDegrees: Double? = nil,
    bodyPose: CaptureBodyPose = .notRun
  ) {
    self.timestampMs = timestampMs
    self.item = item
    self.meanLuma = meanLuma
    self.clippedShare = clippedShare
    self.deviceMotion = deviceMotion
    self.tiltDegrees = tiltDegrees
    self.bodyPose = bodyPose
  }
}
