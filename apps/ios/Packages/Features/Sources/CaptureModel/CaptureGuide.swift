// The guide a camera screen shows (capture brief §6 "Family instructions", §10 guide outline IDs).
// The model hands out keys only; each app keeps the copy in its string resources (brief §1).
// `nonisolated` values: they travel inside effects and outputs to whichever actor performs them.
public import AIStylistKernel

/// Which photo of the item the camera takes (capture brief §7).
nonisolated public enum CaptureSide: String, CaseIterable, Sendable {
  case front
  /// The back step, after "Is the back different?" → Different.
  case back
  /// Shoes only: the pair step, after "Add a photo of the pair?" (Q-D).
  case pair
}

/// The family instruction and guide outline for one camera step.
nonisolated public struct CaptureGuide: Hashable, Sendable {
  public let family: CaptureShapeFamily
  public let mode: CaptureMode
  public let side: CaptureSide

  public init(family: CaptureShapeFamily, mode: CaptureMode, side: CaptureSide) {
    self.family = family
    self.mode = mode
    self.side = side
  }

  /// The guide outline's test ID: `cap-guide-<family>-<mode>[-back|-pair]`.
  public var testID: String {
    let base = "cap-guide-\(family.rawValue)-\(mode.rawValue)"
    switch side {
    case .front: return base
    case .back, .pair: return "\(base)-\(side.rawValue)"
    }
  }
}

/// One spoken line: the hint, and for `cap-hint-guide` the guide whose instruction is read.
nonisolated public struct CaptureUtterance: Hashable, Sendable {
  public let hint: CaptureHint
  public let guide: CaptureGuide?

  public init(hint: CaptureHint, guide: CaptureGuide? = nil) {
    self.hint = hint
    self.guide = guide
  }
}
