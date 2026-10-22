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
    /// Blur directions tried in turn, until the item's sharpness falls clearly under the minimum.
    /// 45° first: a horizontal or vertical blur leaves the item's edges along that axis sharp, and
    /// the diagonals and axes cover outlines that run along the first angle.
    static let motionBlurAngles = [Double.pi / 4, 3 * Double.pi / 4, 0, Double.pi / 2]
    /// Too dark: detail finer than this box radius (px at the 640 px long side) keeps its contrast,
    /// and the gain noise has this standard deviation in luma (README "Too dark").
    static let darkDetailRadiusPx = 3
    static let darkNoiseSigma = 2.0
    static let sourceMinItemShare = 0.03
    static let sourceMaxSidePx = 1024
    static let sharpPassFactor = 2.0
    static let blurFailFactor = 0.5
    static let sizePassFactor = 1.1
    static let sizeFailFactor = 0.9
    static let contactFailFactor = 1.25
    static let contactPassFactor = 0.5
    /// Jitter: frames that two evaluations may read differ by over this many times the steady
    /// centre-shift limit (README "Jitter").
    static let jitterStepFailFactor = 1.25
    /// Jitter: random draws tried per frame before the generator gives up on a seed.
    static let jitterMaxDrawsPerFrame = 1000
    static let lumaMargin = 10.0
    /// Hard cases (README "Hard cases"). Vision "found" the item when an instance overlaps its true
    /// mask with at least this IoU.
    static let visionFoundMinIoU = 0.5
    /// The first bases of each family that ship the surface and covered sets; Vision is checked on every base.
    static let hardCaseBases = 2
    /// C8: dark fabric and the garment toned to about the same mean luma, both clear of the too-dark
    /// limit plus `lumaMargin` (45 + 10), so the case is contrast, not light.
    static let darkSurfaceLuma = 62.0
    static let darkGarmentLuma = 64.0
    /// C9: white bedding and a white garment, clear of the too-bright limit minus `lumaMargin` and of
    /// the clipped luma.
    static let whiteSurfaceLuma = 192.0
    static let whiteSurfaceMaxLuma = 236.0
    static let whiteGarmentLuma = 196.0
    /// C8, C9: the toned garment keeps this share of its saturation, and loses this many outline pixels
    /// (the photo's own background fringe).
    static let hardGarmentSaturation = 0.3
    static let hardGarmentErodePx = 2
    /// C10: stripe width and flower spacing in pixels at the 480 px frame width.
    static let stripeWidthPx = 26
    static let flowerSpacingPx = 64
    /// C32: the object's width as a share of the item's box width, its height capped at a share of the
    /// box height, its area at least this many times `covered.minOtherBoxAreaShare`, and for
    /// `covered-edge` this share of its width inside the item's box.
    static let occluderWidthShareOfBox = 0.3
    static let occluderMaxHeightShareOfBox = 0.7
    static let occluderMinAreaTimesLimit = 4.0
    static let occluderEdgeInsideShare = 0.8
    /// Tilt frames: this far over the hint angle (hint on), and this far under it (hint off).
    static let tiltOverDegrees = 5.0
    static let tiltUnderDegrees = 2.0
    /// Overexposed: the frame's mean luma this far over the too-bright limit (twice `lumaMargin`).
    static let overexposedOverLuma = 20.0
    /// Glare spots on the garment, in shares of its box, each this radius (share of the frame width)
    /// with this clipped core.
    static let glareSpots: [(x: Double, y: Double)] = [(0.35, 0.3), (0.62, 0.5), (0.42, 0.72)]
    static let glareSpotRadius = 0.045
    static let glareCore = 0.5
    /// Direct sun from a window: a large patch whose clipped core covers well over the clipped limit.
    static let windowLight = LightSpot(centreX: 0.12, centreY: 0.3, radiusX: 0.85, radiusY: 0.62, core: 0.7)
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

/// What the detector sees in a finished frame, measured the way the iOS rules read it (brief §3). The
/// detector is the Mac's Vision foreground instance mask, or for the hard cases the ground truth the
/// generator drew ("as a good detector would see it"), with Vision's own result kept in `vision`.
struct FrameMeasure {
    /// Largest first.
    let instances: [MaskStats]
    /// Every instance merged: the mask PNG stored next to the frame.
    let mask: BinaryMask
    let meanLuma: Double
    let clippedShare: Double
    /// Inside the largest instance's box; 0 without an instance.
    let sharpness: Double
    /// With two or more instances: each pixel's instance, 1 for the largest, 2 for the next, 0 for
    /// background (the stored `frame.instances.png`, read like the phone's Vision label mask).
    let labels: [UInt8]?
    /// Where the instances come from: the `source` of the stored box file.
    var detector = Detector.vision
    /// Ground-truth frames only: what the Mac's Vision made of the same image.
    var vision: VisionCheck?

    var main: MaskStats? { instances.first }

    static func of(_ image: CGImage, rules: CaptureRules) throws -> FrameMeasure {
        try measured(image, masks: try VisionMasks.instances(in: image), rules: rules)
    }

    /// The frame measured on the masks the generator drew instead of Vision's (hard backgrounds, the
    /// covered item); `masks` empty is a detector that finds nothing.
    static func groundTruth(_ image: CGImage, masks: [BinaryMask], vision: VisionCheck, rules: CaptureRules)
        throws -> FrameMeasure
    {
        var measure = try measured(image, masks: masks, rules: rules)
        measure.detector = .groundTruth
        measure.vision = vision
        return measure
    }

    /// The largest overlap of another instance's box with the item's box, as a share of the smaller
    /// box, over the instances the covered rule counts (brief §4, C32); 0 with fewer than two.
    func coveredOverlap(rules: CaptureRules) -> Double {
        guard let main else { return 0 }
        return instances.dropFirst()
            .filter { $0.box.area >= rules.covered.minOtherBoxAreaShare }
            .map { main.box.overlapShareOfSmaller(with: $0.box) }
            .max() ?? 0
    }

    private static func measured(_ image: CGImage, masks: [BinaryMask], rules: CaptureRules) throws -> FrameMeasure {
        var mask = BinaryMask.empty(width: image.width, height: image.height)
        var measured: [(mask: BinaryMask, stats: MaskStats)] = []
        for instance in masks {
            mask = mask.union(instance)
            if let stats = instance.stats(edgeBandShare: rules.edgeBandShare) {
                measured.append((instance, stats))
            }
        }
        measured.sort { $0.stats.maskAreaShare > $1.stats.maskAreaShare }
        let instances = measured.map(\.stats)
        var labels: [UInt8]?
        if measured.count >= 2 {
            var values = [UInt8](repeating: 0, count: image.width * image.height)
            // Smaller instances last, so a pixel two masks share goes to the smaller one, as Vision's
            // label mask gives every pixel to exactly one instance.
            for (rank, instance) in measured.enumerated().prefix(Int(UInt8.max)) {
                for index in 0..<values.count where instance.mask.values[index] > 0 {
                    values[index] = UInt8(rank + 1)
                }
            }
            labels = values
        }
        let raster = try Imaging.raster(of: image, width: image.width, height: image.height)
        let sharpness =
            try instances.first.map {
                try Imaging.sharpness(of: image, inside: $0.box, longSidePx: rules.steady.sharpnessLongSidePx)
            } ?? 0
        return FrameMeasure(
            instances: instances, mask: mask, meanLuma: raster.meanLuma,
            clippedShare: raster.clippedShare(minLuma: rules.light.clippedMinLuma), sharpness: sharpness,
            labels: labels)
    }

    enum Detector: String {
        case vision = "vision-foreground-instance-mask"
        case groundTruth = "ground-truth"
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
    /// The too-bright variant: the light check must fail clearly (a hint, never a lock).
    var bright = false
    /// Another object lies on the item (C32): the covered rule must fail clearly.
    var covered = false
    /// The phone's stored tilt during playback, in degrees; nil means no gravity sensor.
    var tiltDegrees: Double?
}

/// What the Mac's Vision foreground instance mask made of a ground-truth frame (the evidence for the
/// hard cases, README "Hard cases").
struct VisionCheck: Encodable {
    /// Instances Vision found.
    let instances: Int
    /// Vision found the item: one instance of at least `ios.minInstanceAreaShare` overlaps its true
    /// mask with IoU of at least `Layout.visionFoundMinIoU`.
    let foundItem: Bool
    /// The best IoU of a Vision instance with the item's true mask.
    let itemIoU: Double
    /// Covered frames: Vision found the occluder as an instance of its own as well.
    let separatedOccluder: Bool?
}

/// The lock machine's checks in priority order (brief §4, §6); `unlocked` when none fails.
enum Stage: Int, Comparable {
    case item, edges, body, covered, size, steady, unlocked

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
    let anywayReason: String?
}

/// The expected-result file. `platform` holds only the platforms whose result differs.
struct Expectation: Encodable {
    let shutter: String
    let hint: String
    let lockReason: String?
    let maxUnlockMs: Int?
    let anywayAtMs: Int?
    /// Locked only: the "Take photo anyway" reason line (brief §6): `surface-tip`, `try-hanger-mode`, or
    /// the blocking hint's test ID.
    let anywayReason: String?
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
            maxUnlockMs: shared.maxUnlockMs, anywayAtMs: shared.anywayAtMs, anywayReason: shared.anywayReason,
            platform: platform)
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
        if mode != "worn", decisive >= .covered, let covered = coveredProblem(intent, measure: measure) {
            return covered
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
        if mode != "worn", intent.covered { return try locked(.covered, reason: "covered") }
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
        } else if mode == "flat", let tilt = intent.tiltDegrees, tilt > rules.tilt.hintAboveDegrees {
            // Tilt starts off, so only the on-limit matters for a segment played at one angle.
            hint = try rules.hint("cap-hint-tilt")
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
            anywayAtMs: unlocked ? nil : rules.timing.anywayDelayMs, anywayReason: anywayReason(outcome))
    }

    /// The reason line under "Take photo anyway" (brief §6): the surface tip for no item (C8–C10),
    /// "Try hanger mode" for a flat cut-off where the family offers hanger mode (C11), else the hint.
    private func anywayReason(_ outcome: Outcome) -> String? {
        guard outcome.stage != .unlocked else { return nil }
        if outcome.lockReason == "no-item" { return "surface-tip" }
        if outcome.lockReason == "cut-off", mode == "flat", rules.families[family]?.modes.contains("hanger") == true {
            return "try-hanger-mode"
        }
        return outcome.hint
    }

    /// A covered frame must overlap clearly over the limit; every other frame clearly under it.
    private func coveredProblem(_ intent: Intent, measure: FrameMeasure) -> String? {
        let overlap = measure.coveredOverlap(rules: rules)
        let limit = rules.covered.aboveOverlapShare
        if intent.covered, overlap <= limit * Layout.contactFailFactor {
            return "covered overlap \(round4(overlap)) is not clearly over \(limit)"
        }
        if !intent.covered, overlap > limit * Layout.contactPassFactor {
            return "another object overlaps the item by \(round4(overlap)), near the covered limit \(limit)"
        }
        return nil
    }

    private func lightProblem(_ intent: Intent, measure: FrameMeasure) -> String? {
        let light = rules.light
        if intent.dark {
            return measure.meanLuma < light.tooDarkBelowMeanLuma
                ? nil : "mean luma \(round4(measure.meanLuma)) is not under \(light.tooDarkBelowMeanLuma)"
        }
        if intent.bright {
            let clearlyBright =
                measure.meanLuma > light.tooBrightAboveMeanLuma + Layout.lumaMargin
                || measure.clippedShare > light.tooBrightAboveClippedShare * Layout.contactFailFactor
            return clearlyBright
                ? nil : "mean luma \(round4(measure.meanLuma)) and clipped share \(round4(measure.clippedShare)) are not clearly too bright"
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
