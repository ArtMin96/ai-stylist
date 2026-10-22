import CryptoKit
import Foundation

/// A failure that stops the generator, or the reason a candidate image is not used.
struct GeneratorError: Error, CustomStringConvertible {
    let description: String

    init(_ description: String) {
        self.description = description
    }
}

/// Progress goes to stderr with the tool prefix; stdout carries only the final summary.
func progress(_ message: String) {
    FileHandle.standardError.write(Data("capture-frames: \(message)\n".utf8))
}

/// The four frame edges, named as the user sees the portrait screen (brief §6).
enum Edge: String, CaseIterable {
    case top, bottom, left, right
}

/// One share per edge, e.g. how much of each edge the item's mask touches.
struct EdgeShares: Codable, Equatable {
    var top: Double
    var bottom: Double
    var left: Double
    var right: Double

    static let zero = EdgeShares(top: 0, bottom: 0, left: 0, right: 0)

    subscript(edge: Edge) -> Double {
        switch edge {
        case .top: top
        case .bottom: bottom
        case .left: left
        case .right: right
        }
    }

    var rounded: EdgeShares {
        EdgeShares(top: round4(top), bottom: round4(bottom), left: round4(left), right: round4(right))
    }
}

/// A rectangle normalised to the frame (0–1, portrait, origin top-left; brief §3). It may reach
/// past the frame when an item is placed partly outside it.
struct NormRect: Codable, Equatable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double

    var maxX: Double { x + width }
    var maxY: Double { y + height }
    var area: Double { width * height }

    /// The part inside the frame.
    var clippedToFrame: NormRect {
        let minX = max(0, x)
        let minY = max(0, y)
        let clippedWidth = max(0, min(1, maxX) - minX)
        let clippedHeight = max(0, min(1, maxY) - minY)
        return NormRect(x: minX, y: minY, width: clippedWidth, height: clippedHeight)
    }

    var rounded: NormRect {
        NormRect(x: round4(x), y: round4(y), width: round4(width), height: round4(height))
    }

    /// Distance from this box to the given frame edge (negative when the box reaches past it).
    func gap(to edge: Edge) -> Double {
        switch edge {
        case .top: y
        case .bottom: 1 - maxY
        case .left: x
        case .right: 1 - maxX
        }
    }
}

/// Keeps the JSON files readable: four decimals is finer than one pixel of a 640 px frame.
func round4(_ value: Double) -> Double {
    (value * 10_000).rounded() / 10_000
}

func sha256Hex(of data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

/// A seeded SplitMix64 stream of uniform values in 0..<1, so a run repeats exactly.
struct SplitMix64 {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func nextUnit() -> Double {
        state &+= 0x9E37_79B9_7F4A_7C15
        var mixed = state
        mixed = (mixed ^ (mixed >> 30)) &* 0xBF58_476D_1CE4_E5B9
        mixed = (mixed ^ (mixed >> 27)) &* 0x94D0_49BB_1331_11EB
        mixed ^= mixed >> 31
        return Double(mixed >> 11) / Double(1 << 53)
    }
}

/// Stable 32-bit FNV-1a hash of a set id: the per-set jitter seed, so playback repeats exactly.
func stableSeed(_ text: String) -> UInt32 {
    var hash: UInt32 = 2_166_136_261
    for byte in text.utf8 {
        hash ^= UInt32(byte)
        hash = hash &* 16_777_619
    }
    return hash
}

func writeJSON<Value: Encodable>(_ value: Value, to url: URL) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    try FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    var data = try encoder.encode(value)
    data.append(contentsOf: Array("\n".utf8))
    try data.write(to: url)
}
