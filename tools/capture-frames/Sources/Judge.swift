import CoreGraphics
import Foundation

/// Harness values the brief fixes (§11 playback and variants, §0/§12 acceptance). They describe the
/// test set, not a live check, so they are not in capture-rules.json.
enum Harness {
    static let playbackFps = 30
    static let segmentFrames = 180
    /// Sweep and batch: 1 s of empty background between items.
    static let gapFrames = 30
    static let jitterShare = 0.06
    /// Cut-off variants: this share of the item's box lies past the edge.
    static let cutPastEdgeShare = 0.25
    static let tooSmallShareOfMinimum = 0.35
    static let tooDarkMeanLuma = 30.0
    /// Core Image motion blur radius: 25 px when the frame's long side is 640 px.
    static let motionBlurPx = 25.0
    static let motionBlurReferenceLongSidePx = 640.0
    /// Worn cut-off variants: the body part lies this share of the torso height past the edge.
    static let wornPastEdgeShareOfTorso = 0.25
    /// C1: unlock within 3 s of the segment's first frame.
    static let maxUnlockMs = 3000
    /// Finish line: "Take photo anyway" at 10.0 s ± 0.5 s.
    static let anywayToleranceMs = 500
    static let basesPerFamily = 5
    static let maxCandidatesPerFamily = 40
    static let batchItems = 10
}

/// Generator choices: placement, and the margins that keep every verdict clear of its threshold so
/// small differences between the Mac's Vision and a phone's detector cannot flip it.
enum Layout {
    static let goodSizeTimesMinimum = 2.0
    static let minGoodSizeTimesMinimum = 1.25
    /// Good frames keep this margin on every side: jitter 0.06 plus the 0.02 edge band plus slack.
    static let jitterSafeMargin = 0.10
    static let twoItemMargin = 0.05
    static let twoItemGap = 0.04
    /// 45°: a horizontal or vertical blur leaves the item's edges along that axis sharp.
    static let motionBlurAngle = Double.pi / 4
    static let sourceMinItemShare = 0.03
    static let sourceMaxSidePx = 1024
    static let sharpPassFactor = 2.0
    static let blurFailFactor = 0.5
    static let sizePassFactor = 1.1
    static let sizeFailFactor = 0.9
    static let contactFailFactor = 1.25
    static let contactPassFactor = 0.5
    static let lumaMargin = 10.0
    static let wornWholeHeightShare = 0.86
    static let wornWholeTopShare = 0.06
    /// Worn zoom variants (hips or knees past the bottom) keep the shoulders this far from the top.
    static let wornShoulderAnchorShare = 0.10
}

/// A rejected candidate or variant: recorded in the manifest, the generator carries on.
struct Rejection: Error {
    let reason: String

    init(_ reason: String) {
        self.reason = reason
    }
}

/// What Vision sees in a finished frame, measured the way the iOS rules read it (brief §3).
struct FrameMeasure {
    /// Largest first.
    let instances: [MaskStats]
    /// Every instance merged: the mask PNG stored next to the frame.
    let mask: BinaryMask
    let meanLuma: Double
    let clippedShare: Double
    /// Inside the largest instance's box; 0 without an instance.
    let sharpness: Double

    var main: MaskStats? { instances.first }

    static func of(_ image: CGImage, rules: CaptureRules) throws -> FrameMeasure {
        var mask = BinaryMask.empty(width: image.width, height: image.height)
        var instances: [MaskStats] = []
        for instance in try VisionMasks.instances(in: image) {
            mask = mask.union(instance)
            if let stats = instance.stats(edgeBandShare: rules.edgeBandShare) {
                instances.append(stats)
            }
        }
        instances.sort { $0.maskAreaShare > $1.maskAreaShare }
        let raster = try Imaging.raster(of: image, width: image.width, height: image.height)
        let sharpness =
            try instances.first.map {
                try Imaging.sharpness(of: image, inside: $0.box, longSidePx: rules.steady.sharpnessLongSidePx)
            } ?? 0
        return FrameMeasure(
            instances: instances, mask: mask, meanLuma: raster.meanLuma,
            clippedShare: raster.clippedShare(minLuma: rules.light.clippedMinLuma), sharpness: sharpness)
    }

    /// Per edge, the largest contact of any instance big enough to count as an item on iOS.
    func itemContact(minInstanceAreaShare: Double) -> EdgeShares {
        var contact = EdgeShares.zero
        for instance in instances where instance.maskAreaShare >= minInstanceAreaShare {
            contact.top = max(contact.top, instance.edgeContact.top)
            contact.bottom = max(contact.bottom, instance.edgeContact.bottom)
            contact.left = max(contact.left, instance.edgeContact.left)
            contact.right = max(contact.right, instance.edgeContact.right)
        }
        return contact
    }
}

/// What a variant is built to show, from its geometry: the input to the expected result.
struct Intent {
    /// An item is drawn, so a stored box exists (the Android fallback).
    var itemPresent = true
    /// Mask area share of the largest item, from the drawing: decides "item found" on iOS.
    var iosMaskShare: Double
    var touchedEdges: [Edge] = []
    var missingParts: [String] = []
    /// The largest item's box inside the frame.
    var boxAreaShare: Double
    /// False for the motion-blurred variant.
    var sharp = true
    var jittered = false
    var dark = false
}

/// The lock machine's checks in priority order (brief §4, §6); `unlocked` when none fails.
enum Stage: Int, Comparable {
    case item, edges, body, size, steady, unlocked

    static func < (lhs: Stage, rhs: Stage) -> Bool { lhs.rawValue < rhs.rawValue }
}

struct Outcome: Equatable {
    let stage: Stage
    let hint: String
    let lockReason: String?
}

/// One platform's expected result (brief §11 expected-result file).
struct PlatformExpectation: Encodable, Equatable {
    let shutter: String
    let hint: String
    let lockReason: String?
    let maxUnlockMs: Int?
    let anywayAtMs: Int?
}

/// The expected-result file. `platform` holds only the platforms whose result differs.
struct Expectation: Encodable {
    let shutter: String
    let hint: String
    let lockReason: String?
    let maxUnlockMs: Int?
    let anywayAtMs: Int?
    let platform: [String: PlatformExpectation]
}

/// Applies capture-rules.json to a variant's intent. Never runs the app: the expected result comes
/// from the variant's geometry and the registry's thresholds.
struct Judge {
    let rules: CaptureRules
    let family: String
    let mode: String

    func expectation(_ intent: Intent, measure: FrameMeasure) throws -> Expectation {
        let base = try outcome(intent, itemFound: intent.itemPresent, measure: measure)
        let ios = try outcome(intent, itemFound: iosFindsItem(intent), measure: measure)
        let shared = platformExpectation(base)
        var platform: [String: PlatformExpectation] = [:]
        if ios != base {
            platform["ios"] = platformExpectation(ios)
        }
        return Expectation(
            shutter: shared.shutter, hint: shared.hint, lockReason: shared.lockReason,
            maxUnlockMs: shared.maxUnlockMs, anywayAtMs: shared.anywayAtMs, platform: platform)
    }

    /// Why the finished frame does not show what the variant means, or nil when it does. Checks
    /// before the deciding one must pass clearly, the deciding one must fail clearly, later ones
    /// do not matter.
    func problem(_ intent: Intent, measure: FrameMeasure) throws -> String? {
        let minInstance = rules.ios.minInstanceAreaShare
        let found = iosFindsItem(intent)
        let measuredShare = measure.main?.maskAreaShare ?? 0
        guard found == (measuredShare >= minInstance) else {
            return "Vision's largest instance covers \(round4(measuredShare)) of the frame; the variant means item found = \(found)"
        }
        if let light = lightProblem(intent, measure: measure) { return light }
        guard found, let main = measure.main else { return nil }
        let decisive = try outcome(intent, itemFound: true, measure: measure).stage
        if mode != "worn", decisive >= .edges,
            let edges = edgeProblem(intent, main: main, contact: measure.itemContact(minInstanceAreaShare: minInstance))
        {
            return edges
        }
        let minimum = try mode == "worn" ? rules.worn.minAreaShare : rules.family(family).minAreaShare
        if decisive == .size, main.box.area > minimum * Layout.sizeFailFactor {
            return "box covers \(round4(main.box.area)), not clearly under the minimum \(minimum)"
        }
        if decisive > .size, main.box.area < minimum * Layout.sizePassFactor {
            return "box covers \(round4(main.box.area)), not clearly over the minimum \(minimum)"
        }
        if decisive >= .steady {
            let threshold = rules.steady.minSharpness
            if intent.sharp, measure.sharpness < threshold * Layout.sharpPassFactor {
                return "sharpness \(round4(measure.sharpness)) is not clearly over \(threshold)"
            }
            if !intent.sharp, measure.sharpness > threshold * Layout.blurFailFactor {
                return "blurred sharpness \(round4(measure.sharpness)) is not clearly under \(threshold)"
            }
        }
        return nil
    }

    private func iosFindsItem(_ intent: Intent) -> Bool {
        intent.itemPresent && intent.iosMaskShare >= rules.ios.minInstanceAreaShare
    }

    private func outcome(_ intent: Intent, itemFound: Bool, measure: FrameMeasure) throws -> Outcome {
        guard itemFound else { return try locked(.item, reason: "no-item") }
        if mode != "worn", !intent.touchedEdges.isEmpty {
            let key =
                intent.touchedEdges.count == 1
                ? "cap-hint-cut-off-\(intent.touchedEdges[0].rawValue)" : "cap-hint-cut-off-multiple"
            return Outcome(stage: .edges, hint: try rules.hint(key), lockReason: try rules.lockReason("cut-off"))
        }
        let familyRules = try rules.family(family)
        if mode == "worn", !intent.missingParts.isEmpty {
            guard let hint = familyRules.wornHint else {
                throw GeneratorError("family '\(family)' requires body parts but has no wornHint")
            }
            return Outcome(
                stage: .body, hint: try rules.hint(hint), lockReason: try rules.lockReason("body-parts-missing"))
        }
        let minimum = mode == "worn" ? rules.worn.minAreaShare : familyRules.minAreaShare
        if intent.boxAreaShare < minimum { return try locked(.size, reason: "too-small") }
        if !intent.sharp || intent.jittered { return try locked(.steady, reason: "not-steady") }
        let light = rules.light
        let hint: String
        if measure.meanLuma < light.tooDarkBelowMeanLuma {
            hint = try rules.hint("cap-hint-too-dark")
        } else if measure.meanLuma > light.tooBrightAboveMeanLuma
            || measure.clippedShare > light.tooBrightAboveClippedShare
        {
            hint = try rules.hint("cap-hint-too-bright")
        } else {
            hint = try rules.hint("cap-hint-ready")
        }
        return Outcome(stage: .unlocked, hint: hint, lockReason: nil)
    }

    private func locked(_ stage: Stage, reason: String) throws -> Outcome {
        Outcome(stage: stage, hint: try rules.hint(forLockReason: reason), lockReason: try rules.lockReason(reason))
    }

    private func platformExpectation(_ outcome: Outcome) -> PlatformExpectation {
        let unlocked = outcome.stage == .unlocked
        return PlatformExpectation(
            shutter: unlocked ? "unlocked" : "locked", hint: outcome.hint, lockReason: outcome.lockReason,
            maxUnlockMs: unlocked ? Harness.maxUnlockMs : nil,
            anywayAtMs: unlocked ? nil : rules.timing.anywayDelayMs)
    }

    private func lightProblem(_ intent: Intent, measure: FrameMeasure) -> String? {
        let light = rules.light
        if intent.dark {
            return measure.meanLuma < light.tooDarkBelowMeanLuma
                ? nil : "mean luma \(round4(measure.meanLuma)) is not under \(light.tooDarkBelowMeanLuma)"
        }
        let inRange =
            measure.meanLuma >= light.tooDarkBelowMeanLuma + Layout.lumaMargin
            && measure.meanLuma <= light.tooBrightAboveMeanLuma - Layout.lumaMargin
            && measure.clippedShare <= light.tooBrightAboveClippedShare / 2
        return inRange ? nil : "mean luma \(round4(measure.meanLuma)) or clipped share is near a light threshold"
    }

    private func edgeProblem(_ intent: Intent, main: MaskStats, contact: EdgeShares) -> String? {
        let threshold = rules.ios.cutOffAboveEdgeContactShare
        for edge in Edge.allCases {
            if intent.touchedEdges.contains(edge) {
                if contact[edge] <= threshold * Layout.contactFailFactor {
                    return "\(edge.rawValue) contact \(round4(contact[edge])) is not clearly over \(threshold)"
                }
            } else if contact[edge] > threshold * Layout.contactPassFactor
                || main.box.gap(to: edge) <= rules.edgeBandShare
            {
                return "the item reaches the \(edge.rawValue) edge band"
            }
        }
        return nil
    }
}
