// The guide outline of each shape family and mode (surface brief sc16, board C11 "Guide per shape family
// and mode"). The paths are the board's path data, verbatim, in the 350 × 506 preview the board measures
// (the guide box inside it: top 68, sides 32, bottom 104). The back step reuses the front outline, the
// shoes' pair step has its own two-shoe outline, and `generic` worn reuses the outerwear worn crop (C11).
// The app scales `segments` into its preview; parsing here keeps the drawing testable on Linux.
// `nonisolated`: pure values, read by the view on the main actor and by tests anywhere.
import AIStylistKernel
import Foundation

/// A point of an outline: the guide's canvas space (`CaptureGuideOutline.canvasWidth` × `canvasHeight`), or
/// for the live outline the frame normalised to 0–1 (origin top-left).
nonisolated public struct CaptureOutlinePoint: Hashable, Sendable {
  public let x: Double
  public let y: Double

  public init(x: Double, y: Double) {
    self.x = x
    self.y = y
  }
}

/// One drawing command of an outline; arcs arrive as cubic curves.
nonisolated public enum CaptureOutlineSegment: Hashable, Sendable {
  case move(CaptureOutlinePoint)
  case line(CaptureOutlinePoint)
  case quad(control: CaptureOutlinePoint, to: CaptureOutlinePoint)
  case cubic(control1: CaptureOutlinePoint, control2: CaptureOutlinePoint, to: CaptureOutlinePoint)
  case close
}

/// The outline drawn for one camera step.
nonisolated public struct CaptureGuideOutline: Hashable, Sendable {
  /// The preview size the C11 paths are drawn in (pt at the 390-wide phone).
  public static let canvasWidth = 350.0
  public static let canvasHeight = 506.0

  public let segments: [CaptureOutlineSegment]

  /// The outline for `guide`: its family and mode as drawn on C11.
  public init(guide: CaptureGuide) {
    // Every path in the table parses (CaptureGuideOutlineTests); an unparsable one draws nothing.
    segments = CaptureOutlinePathParser.segments(Self.pathData(for: guide)) ?? []
  }

  /// Every point the outline passes through or bends toward.
  public var points: [CaptureOutlinePoint] {
    segments.flatMap { segment -> [CaptureOutlinePoint] in
      switch segment {
      case .move(let point), .line(let point): [point]
      case .quad(let control, let point): [control, point]
      case .cubic(let control1, let control2, let point): [control1, control2, point]
      case .close: []
      }
    }
  }

  /// The C11 path data for `guide`.
  static func pathData(for guide: CaptureGuide) -> String {
    if guide.side == .pair { return Paths.shoesPair }
    switch guide.mode {
    case .flat: return flatPath(guide.family)
    case .hanger: return hangerPath(guide.family)
    case .worn: return wornPath(guide.family)
    }
  }

  private static func flatPath(_ family: CaptureShapeFamily) -> String {
    switch family {
    case .top: Paths.topFlat
    case .longBottom: Paths.longBottomFlat
    case .shortBottom: Paths.shortBottomFlat
    case .onePiece: Paths.onePieceFlat
    case .outerwear: Paths.outerwearFlat
    case .shoes: Paths.shoesFlat
    case .bag: Paths.bagFlat
    case .smallItem: Paths.smallItemFlat
    case .generic: Paths.genericFlat
    }
  }

  /// Shoes and small items have no hanger mode (brief §2); they fall back to the generic hanger outline.
  private static func hangerPath(_ family: CaptureShapeFamily) -> String {
    switch family {
    case .top: Paths.topHanger
    case .longBottom: Paths.longBottomHanger
    case .shortBottom: Paths.shortBottomHanger
    case .onePiece: Paths.onePieceHanger
    case .outerwear: Paths.outerwearHanger
    case .bag: Paths.bagHanger
    case .shoes, .smallItem, .generic: Paths.genericHanger
    }
  }

  /// Shoes, bags and small items have no worn mode (brief §2); `generic` reuses the outerwear crop (C11).
  private static func wornPath(_ family: CaptureShapeFamily) -> String {
    switch family {
    case .top: Paths.topWorn
    case .longBottom: Paths.longBottomWorn
    case .shortBottom: Paths.shortBottomWorn
    case .onePiece: Paths.onePieceWorn
    case .outerwear, .shoes, .bag, .smallItem, .generic: Paths.outerwearWorn
    }
  }

  /// The C11 path data, verbatim. The hanger outlines start with the board's hook at that outline's top.
  private enum Paths {
    static func hook(_ y: Int) -> String { "M175 \(y) L175 \(y - 12) A9 9 0 1 1 184 \(y - 21)" }

    static let topFlat =
      "M140 92 Q175 110 210 92 L286 124 L268 190 L238 180 L238 380 L112 380 L112 180 L82 190 L64 124 Z"
    static let topHanger =
      hook(84)
      + " M118 104 L175 84 L232 104 M140 100 Q175 118 210 100 L256 118 L262 220 L238 222 L236 186 L236 392"
      + " L114 392 L114 186 L112 222 L88 220 L94 118 Z"
    static let topWorn =
      "M203 112A28 28 0 1 1 147 112A28 28 0 1 1 203 112Z M160 140 L160 152 L112 166 Q96 172 94 190 L86 320"
      + " L106 322 L116 210 L118 400 M232 400 L234 210 L244 322 L264 320 L256 190 Q254 172 238 166 L190 152"
      + " L190 140 M168 400 L175 336 L182 400"
    static let longBottomFlat = "M112 76 L238 76 L258 404 L196 404 L175 170 L154 404 L92 404 Z"
    static let longBottomHanger =
      hook(84) + " M120 96 L175 84 L230 96 M120 96 L230 96 L248 404 L192 404 L175 190 L158 404 L102 404 Z"
    static let longBottomWorn =
      "M122 78 L228 78 L236 150 L230 384 L246 400 L194 400 L192 384 L180 170 L170 170 L158 384 L156 400"
      + " L104 400 L120 384 L114 150 Z"
    static let shortBottomFlat = "M96 120 L254 120 L276 330 L190 330 L175 220 L160 330 L74 330 Z"
    static let shortBottomHanger =
      hook(118) + " M108 130 L175 118 L242 130 M108 130 L242 130 L262 330 L190 330 L175 230 L160 330 L88 330 Z"
    static let shortBottomWorn =
      "M110 90 L240 90 L252 200 L246 390 L196 390 L184 230 L166 230 L154 390 L104 390 L98 200 Z"
    static let onePieceFlat =
      "M140 74 L152 70 Q175 92 198 70 L210 74 L214 150 Q224 176 236 196 L282 404 L68 404 L114 196"
      + " Q126 176 136 150 Z"
    static let onePieceHanger =
      hook(82)
      + " M120 102 L175 82 L230 102 M140 96 Q175 116 210 96 L222 106 L220 170 Q230 190 240 206 L280 404"
      + " L70 404 L110 206 Q120 190 130 170 L128 106 Z"
    static let onePieceWorn =
      "M150 74 A26 26 0 0 1 200 74 M160 92 L160 100 L114 114 Q98 120 96 138 L88 300 L108 302 L118 170"
      + " L110 330 L240 330 L232 170 L242 302 L262 300 L254 138 Q252 120 236 114 L190 100 L190 92"
      + " M140 330 L142 402 M210 330 L208 402"
    static let outerwearFlat =
      "M144 72 L175 100 L206 72 L262 92 L300 300 L268 308 L246 178 L250 404 L100 404 L104 178 L82 308"
      + " L50 300 L88 92 Z"
    static let outerwearHanger =
      hook(80)
      + " M112 102 L175 80 L238 102 M146 96 L175 120 L204 96 L250 110 L270 330 L244 334 L236 200 L240 404"
      + " L110 404 L114 200 L106 334 L80 330 L100 110 Z"
    static let outerwearWorn =
      "M199 100A24 24 0 1 1 151 100A24 24 0 1 1 199 100Z M162 124 L162 134 L118 148 Q102 154 100 172 L90 330"
      + " L110 332 L120 196 L118 380 L232 380 L230 196 L240 332 L260 330 L250 172 Q248 154 232 148 L188 134"
      + " L188 124 M140 380 L142 402 M210 380 L208 402"
    static let shoesFlat =
      "M60 300 L60 214 Q60 196 78 196 L118 196 Q132 236 176 240 L236 252 Q290 262 292 290 L292 300"
      + " Q292 312 280 312 L72 312 Q60 312 60 300 Z"
    static let shoesPair =
      "M70 250 L70 186 Q70 172 84 172 L116 172 Q128 204 166 208 L226 218 Q276 226 278 248 L278 250"
      + " Q278 262 266 262 L82 262 Q70 262 70 250 Z M70 370 L70 306 Q70 292 84 292 L116 292 Q128 324 166 328"
      + " L226 338 Q276 346 278 368 L278 370 Q278 382 266 382 L82 382 Q70 382 70 370 Z"
    static let bagFlat = "M86 210 L264 210 L276 390 L74 390 Z M126 210 Q126 110 175 110 Q224 110 224 210"
    static let bagHanger = hook(92) + " M175 92 L120 200 M175 92 L230 200 M100 200 L250 200 L262 380 L88 380 Z"
    static let smallItemFlat =
      "M115 135 L235 135 Q255 135 255 155 L255 315 Q255 335 235 335 L115 335 Q95 335 95 315 L95 155"
      + " Q95 135 115 135 Z"
    static let genericFlat =
      "M50 68 L300 68 Q318 68 318 86 L318 384 Q318 402 300 402 L50 402 Q32 402 32 384 L32 86 Q32 68 50 68 Z"
    static let genericHanger =
      hook(96)
      + " M50 96 L300 96 Q318 96 318 114 L318 384 Q318 402 300 402 L50 402 Q32 402 32 384 L32 114"
      + " Q32 96 50 96 Z"
  }
}

/// Reads the SVG path data subset the C11 board uses: absolute `M`, `L`, `H`, `V`, `Q`, `C`, `A` and `Z`.
nonisolated enum CaptureOutlinePathParser {
  /// The segments of `data`, or nil when it holds a command or number outside the subset.
  static func segments(_ data: String) -> [CaptureOutlineSegment]? {
    var reader = Reader(tokens: tokenize(data))
    var segments: [CaptureOutlineSegment] = []
    var current = CaptureOutlinePoint(x: 0, y: 0)
    var subpathStart = current
    var command: Character?
    while !reader.isAtEnd {
      if let next = reader.command() {
        command = next
      }
      guard let active = command else { return nil }
      switch active {
      case "M":
        guard let point = reader.point() else { return nil }
        segments.append(.move(point))
        current = point
        subpathStart = point
        command = "L"  // Further pairs after M are lines (SVG paths §9.3.3).
      case "L":
        guard let point = reader.point() else { return nil }
        segments.append(.line(point))
        current = point
      case "H":
        guard let x = reader.number() else { return nil }
        current = CaptureOutlinePoint(x: x, y: current.y)
        segments.append(.line(current))
      case "V":
        guard let y = reader.number() else { return nil }
        current = CaptureOutlinePoint(x: current.x, y: y)
        segments.append(.line(current))
      case "Q":
        guard let control = reader.point(), let point = reader.point() else { return nil }
        segments.append(.quad(control: control, to: point))
        current = point
      case "C":
        guard let control1 = reader.point(), let control2 = reader.point(), let point = reader.point() else {
          return nil
        }
        segments.append(.cubic(control1: control1, control2: control2, to: point))
        current = point
      case "A":
        guard let radiusX = reader.number(), let radiusY = reader.number(), let rotation = reader.number(),
          let largeArc = reader.number(), let sweep = reader.number(), let point = reader.point()
        else { return nil }
        let arc = Arc(
          from: current,
          to: point,
          radiusX: radiusX,
          radiusY: radiusY,
          rotationDegrees: rotation,
          isLargeArc: largeArc != 0,
          sweepsPositive: sweep != 0
        )
        segments.append(contentsOf: arc.cubics())
        current = point
      case "Z":
        segments.append(.close)
        current = subpathStart
        command = nil
      default:
        return nil
      }
    }
    return segments
  }

  private enum Token: Equatable {
    case command(Character)
    case number(Double)
  }

  /// Splits on spaces and commas, and before each command letter.
  private static func tokenize(_ data: String) -> [Token] {
    var tokens: [Token] = []
    var number = ""
    func flush() {
      guard !number.isEmpty else { return }
      // A malformed number becomes NaN, which `Reader.number()` rejects.
      tokens.append(.number(Double(number) ?? .nan))
      number = ""
    }
    for character in data {
      if character.isLetter {
        flush()
        tokens.append(.command(character))
      } else if character == " " || character == "," {
        flush()
      } else if character == "-", !number.isEmpty {
        flush()
        number.append(character)
      } else {
        number.append(character)
      }
    }
    flush()
    return tokens
  }

  private struct Reader {
    let tokens: [Token]
    var index = 0

    var isAtEnd: Bool { index >= tokens.count }

    mutating func command() -> Character? {
      guard index < tokens.count, case .command(let letter) = tokens[index] else { return nil }
      index += 1
      return letter
    }

    mutating func number() -> Double? {
      guard index < tokens.count, case .number(let value) = tokens[index], value.isFinite else { return nil }
      index += 1
      return value
    }

    mutating func point() -> CaptureOutlinePoint? {
      guard let x = number(), let y = number() else { return nil }
      return CaptureOutlinePoint(x: x, y: y)
    }
  }

  /// An SVG elliptical arc, converted to its centre form (SVG 1.1 implementation notes F.6.5) and drawn as
  /// cubic curves of at most a quarter turn each.
  private struct Arc {
    let from: CaptureOutlinePoint
    let to: CaptureOutlinePoint
    let radiusX: Double
    let radiusY: Double
    let rotationDegrees: Double
    let isLargeArc: Bool
    /// SVG's sweep flag: the angle grows from start to end (clockwise on a y-down screen).
    let sweepsPositive: Bool

    func cubics() -> [CaptureOutlineSegment] {
      var radiusX = abs(radiusX)
      var radiusY = abs(radiusY)
      guard radiusX > 0, radiusY > 0, from != to else { return [.line(to)] }
      let phi = rotationDegrees * .pi / 180
      let cosPhi = cos(phi)
      let sinPhi = sin(phi)
      let halfDX = (from.x - to.x) / 2
      let halfDY = (from.y - to.y) / 2
      let x1 = cosPhi * halfDX + sinPhi * halfDY
      let y1 = -sinPhi * halfDX + cosPhi * halfDY
      // Radii too small to reach the end point grow until they just do (F.6.6).
      let lambda = (x1 * x1) / (radiusX * radiusX) + (y1 * y1) / (radiusY * radiusY)
      if lambda > 1 {
        radiusX *= lambda.squareRoot()
        radiusY *= lambda.squareRoot()
      }
      let rx2 = radiusX * radiusX
      let ry2 = radiusY * radiusY
      let numerator = rx2 * ry2 - rx2 * y1 * y1 - ry2 * x1 * x1
      let denominator = rx2 * y1 * y1 + ry2 * x1 * x1
      let sign: Double = isLargeArc == sweepsPositive ? -1 : 1
      let factor = sign * max(0, numerator / denominator).squareRoot()
      let centerX1 = factor * radiusX * y1 / radiusY
      let centerY1 = -factor * radiusY * x1 / radiusX
      let centerX = cosPhi * centerX1 - sinPhi * centerY1 + (from.x + to.x) / 2
      let centerY = sinPhi * centerX1 + cosPhi * centerY1 + (from.y + to.y) / 2
      let startAngle = atan2((y1 - centerY1) / radiusY, (x1 - centerX1) / radiusX)
      let endAngle = atan2((-y1 - centerY1) / radiusY, (-x1 - centerX1) / radiusX)
      var sweep = endAngle - startAngle
      if sweepsPositive, sweep < 0 { sweep += 2 * .pi }
      if !sweepsPositive, sweep > 0 { sweep -= 2 * .pi }

      func point(unitX: Double, unitY: Double) -> CaptureOutlinePoint {
        CaptureOutlinePoint(
          x: centerX + radiusX * unitX * cosPhi - radiusY * unitY * sinPhi,
          y: centerY + radiusX * unitX * sinPhi + radiusY * unitY * cosPhi
        )
      }

      let count = max(1, Int((abs(sweep) / (.pi / 2)).rounded(.up)))
      let step = sweep / Double(count)
      let handle = 4.0 / 3.0 * tan(step / 4)
      var segments: [CaptureOutlineSegment] = []
      for index in 0..<count {
        let start = startAngle + Double(index) * step
        let end = start + step
        let isLast = index == count - 1
        segments.append(
          .cubic(
            control1: point(unitX: cos(start) - handle * sin(start), unitY: sin(start) + handle * cos(start)),
            control2: point(unitX: cos(end) + handle * sin(end), unitY: sin(end) - handle * cos(end)),
            // The last curve ends exactly on the path's end point, free of rounding.
            to: isLast ? to : point(unitX: cos(end), unitY: sin(end))
          )
        )
      }
      return segments
    }
  }
}
