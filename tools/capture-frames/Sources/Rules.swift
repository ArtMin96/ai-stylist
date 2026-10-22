import Foundation

/// The parts of `packages/shared-kernel/registry/capture-rules.json` the generator reads. Every
/// threshold, family minimum, hint key and lock reason comes from that file; none is restated here.
struct CaptureRules: Decodable {
    struct Hint: Decodable {
        let kind: String
        let lockReason: String?
    }

    struct Family: Decodable {
        let minAreaShare: Double
        let modes: [String]
        let wornRequiredParts: [String]
        let wornHint: String?
    }

    struct AnalysisFrame: Decodable {
        let widthPx: Int
        let heightPx: Int
    }

    struct Steady: Decodable {
        let maxCentreShift: Double
        let minSharpness: Double
        let sharpnessLongSidePx: Int
        let laplacianKernelPx: Int
    }

    struct Evaluation: Decodable {
        let intervalMs: Int
    }

    struct Light: Decodable {
        let tooDarkBelowMeanLuma: Double
        let tooBrightAboveMeanLuma: Double
        let clippedMinLuma: Double
        let tooBrightAboveClippedShare: Double
    }

    struct Timing: Decodable {
        let anywayDelayMs: Int
    }

    struct Worn: Decodable {
        let minAreaShare: Double
        let keypointMinCoordinate: Double
        let keypointMaxCoordinate: Double
    }

    struct IOS: Decodable {
        let minInstanceAreaShare: Double
        let cutOffAboveEdgeContactShare: Double
    }

    let captureModes: [String]
    let lockReasons: [String]
    let bodyParts: [String]
    let hints: [String: Hint]
    let families: [String: Family]
    let edgeBandShare: Double
    let analysisFrame: AnalysisFrame
    let evaluation: Evaluation
    let steady: Steady
    let light: Light
    let timing: Timing
    let worn: Worn
    let ios: IOS

    static func load(from url: URL) throws -> CaptureRules {
        let rules = try JSONDecoder().decode(CaptureRules.self, from: Data(contentsOf: url))
        // The sharpness measure below implements the 3×3 Laplacian only.
        guard rules.steady.laplacianKernelPx == 3 else {
            throw GeneratorError(
                "capture-rules.json steady.laplacianKernelPx is \(rules.steady.laplacianKernelPx); the generator implements 3")
        }
        guard rules.families["generic"] != nil else {
            throw GeneratorError("capture-rules.json has no generic family")
        }
        return rules
    }

    /// The analysis frame in portrait: the short side is the width (brief §3).
    var frameWidthPx: Int { min(analysisFrame.widthPx, analysisFrame.heightPx) }
    var frameHeightPx: Int { max(analysisFrame.widthPx, analysisFrame.heightPx) }

    func family(_ id: String) throws -> Family {
        guard let family = families[id] else {
            throw GeneratorError("capture-rules.json has no family '\(id)'")
        }
        return family
    }

    func mode(_ id: String) throws -> String {
        guard captureModes.contains(id) else {
            throw GeneratorError("capture-rules.json has no capture mode '\(id)'")
        }
        return id
    }

    /// A hint key that must exist in the registry.
    func hint(_ key: String) throws -> String {
        guard hints[key] != nil else {
            throw GeneratorError("capture-rules.json has no hint '\(key)'")
        }
        return key
    }

    /// The one blocking hint the registry ties to a lock reason (no-item, too-small, not-steady).
    func hint(forLockReason reason: String) throws -> String {
        let keys = hints.filter { $0.value.lockReason == reason }.map(\.key)
        guard keys.count == 1, let key = keys.first else {
            throw GeneratorError("capture-rules.json has \(keys.count) hints for lock reason '\(reason)', expected 1")
        }
        return key
    }

    func lockReason(_ reason: String) throws -> String {
        guard lockReasons.contains(reason) else {
            throw GeneratorError("capture-rules.json has no lock reason '\(reason)'")
        }
        return reason
    }
}
