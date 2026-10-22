import CoreGraphics
import Foundation

/// What the generator measured in a frame, for whoever debugs a harness result.
struct FrameMetrics: Encodable {
    let instances: Int
    let maskAreaShare: Double
    let boxAreaShare: Double
    let edgeContact: EdgeShares
    let meanLuma: Double
    let clippedShare: Double
    let sharpness: Double

    init(_ measure: FrameMeasure) {
        instances = measure.instances.count
        maskAreaShare = round4(measure.main?.maskAreaShare ?? 0)
        boxAreaShare = round4(measure.main?.box.area ?? 0)
        edgeContact = (measure.main?.edgeContact ?? .zero).rounded
        meanLuma = round4(measure.meanLuma)
        clippedShare = round4(measure.clippedShare)
        sharpness = round4(measure.sharpness)
    }
}

/// One image played for `frames` frames at `Harness.playbackFps`. A jittered segment moves frame
/// `n` by `offsets[n % offsets.count]` (`[dx, dy]`, shares of the frame, each within ±`jitter`), drawn
/// from `jitterSeed` and checked by `JitterPath`; absent offsets mean no movement. Paths are relative
/// to the frames root.
struct SegmentEntry: Encodable {
    let frame: String
    let mask: String
    let box: String
    let keypoints: String?
    let frames: Int
    let jitter: Double
    let jitterSeed: UInt32
    let offsets: [[Double]]?
    let expected: String
    let metrics: FrameMetrics
}

/// The per-frame offsets of a jittered segment (README "Jitter"). Shaky hands never hold still, so
/// every two frames that consecutive evaluations may read (up to one evaluation interval plus one
/// frame apart, the segment looping) differ by more than `Layout.jitterStepFailFactor` times
/// `steady.maxCentreShift` on at least one axis. Independent draws do not: about one jittered set in
/// 25 held still for three evaluations and unlocked (scoreboard, 2026-10-22).
enum JitterPath {
    static func offsets(seed: UInt32, amplitude: Double, count: Int, rules: CaptureRules) throws -> [[Double]] {
        let frameMs = 1000.0 / Double(Harness.playbackFps)
        let reach = Int((Double(rules.evaluation.intervalMs) / frameMs).rounded(.up)) + 1
        let minStep = rules.steady.maxCentreShift * Layout.jitterStepFailFactor
        var random = SplitMix64(seed: UInt64(seed))
        var offsets: [[Double]] = []
        for index in 0..<count {
            var draws = 0
            while true {
                draws += 1
                guard draws <= Layout.jitterMaxDrawsPerFrame else {
                    throw GeneratorError("jitter seed \(seed): no offset for frame \(index) keeps the frame shaky")
                }
                let offset = [round4((random.nextUnit() * 2 - 1) * amplitude), round4((random.nextUnit() * 2 - 1) * amplitude)]
                // The frames already drawn within `reach`: earlier ones, and near the end the first
                // ones, which the looping segment plays next.
                let neighbours = (1...reach).flatMap { distance -> [[Double]] in
                    (index - distance >= 0 ? [offsets[index - distance]] : [])
                        + (index + distance >= count ? [offsets[index + distance - count]] : [])
                }
                let isShaky = neighbours.allSatisfy { other in
                    abs(other[0] - offset[0]) > minStep || abs(other[1] - offset[1]) > minStep
                }
                if isShaky {
                    offsets.append(offset)
                    break
                }
            }
        }
        return offsets
    }
}

/// A frame set the apps' debug frame source plays (`captureFrameSet=<id>`).
struct SetEntry: Encodable {
    let id: String
    let family: String
    let mode: String
    let variant: String
    /// single: one segment, looped; sweep: every good image of a family with empty gaps; batch: C20.
    let kind: String
    /// dataset, synthetic, or mixed (sweep and batch sets that combine both).
    let source: String
    let baseImages: [String]
    let segments: [SegmentEntry]
}

/// The stored detector result for one frame: the Android fallback when ML Kit cannot run on the
/// emulator, and the instance list the iOS reader pairs with the mask PNG.
struct BoxFile: Encodable {
    struct Object: Encodable {
        let box: NormRect
        let boxAreaShare: Double
        let maskAreaShare: Double
        let edgeContact: EdgeShares
    }

    let source = "vision-foreground-instance-mask"
    let frameWidthPx: Int
    let frameHeightPx: Int
    /// Largest first.
    let objects: [Object]
}

struct KeypointFile: Encodable {
    let parts: [String: Keypoint]
}

struct FrameIndex: Encodable {
    struct FrameInfo: Encodable {
        let widthPx: Int
        let heightPx: Int
        let orientation = "portrait"
        let origin = "top-left"
    }

    struct Playback: Encodable {
        let fps: Int
        let segmentFrames: Int
        let gapFrames: Int
    }

    struct Acceptance: Encodable {
        let maxUnlockMs: Int
        let anywayAtMs: Int
        let anywayToleranceMs: Int
    }

    struct RulesReference: Encodable {
        let path: String
        let sha256: String
    }

    let schemaVersion = 1
    let frame: FrameInfo
    let playback: Playback
    let acceptance: Acceptance
    let rules: RulesReference
    let manifest = "manifest.json"
    let sets: [SetEntry]
}

struct Manifest: Encodable {
    struct DatasetInfo: Encodable {
        let name: String
        let url: String
        let branch: String?
        let licence: String
        let licenceVerified: Bool
        let licenceEvidence: String?
        let status: String
    }

    struct BaseInfo: Encodable {
        let id: String
        let source: String
        let label: String?
        let sha256: String?
    }

    struct Rejected: Encodable {
        let id: String
        let reason: String
    }

    struct FamilyInfo: Encodable {
        let bases: [BaseInfo]
        let rejected: [Rejected]
        let wornGarment: String?
    }

    let dataset: DatasetInfo
    let synthetic: String
    let families: [String: FamilyInfo]
}

/// Paths of one written frame, relative to the frames root.
struct WrittenFrame {
    let frame: String
    let mask: String
    let box: String
    let keypoints: String?
    let metrics: FrameMetrics

    func segment(frames: Int, jitter: Double, setId: String, expected: String, rules: CaptureRules? = nil) throws
        -> SegmentEntry
    {
        let seed = stableSeed(setId)
        var offsets: [[Double]]?
        if jitter > 0 {
            guard let rules else { throw GeneratorError("\(setId): a jittered segment needs the rules") }
            offsets = try JitterPath.offsets(seed: seed, amplitude: jitter, count: frames, rules: rules)
        }
        return SegmentEntry(
            frame: frame, mask: mask, box: box, keypoints: keypoints, frames: frames, jitter: jitter,
            jitterSeed: seed, offsets: offsets, expected: expected, metrics: metrics)
    }
}

/// Writes frames, masks, box and keypoint files, and expected results under the frames root.
final class FrameWriter {
    let root: URL
    let size: FrameSize
    private(set) var imageCount = 0

    init(root: URL, size: FrameSize) {
        self.root = root
        self.size = size
    }

    func write(_ image: CGImage, measure: FrameMeasure, keypoints: [String: Keypoint]?, directory: String) throws
        -> WrittenFrame
    {
        let frame = "\(directory)/frame.png"
        let mask = "\(directory)/frame.mask.png"
        let box = "\(directory)/frame.box.json"
        try Imaging.writePNG(image, to: root.appendingPathComponent(frame))
        let maskImage = try Imaging.grayImage(
            measure.mask.values, width: measure.mask.width, height: measure.mask.height)
        try Imaging.writePNG(maskImage, to: root.appendingPathComponent(mask))
        let objects = measure.instances.map {
            BoxFile.Object(
                box: $0.box.rounded, boxAreaShare: round4($0.box.area), maskAreaShare: round4($0.maskAreaShare),
                edgeContact: $0.edgeContact.rounded)
        }
        try writeJSON(
            BoxFile(frameWidthPx: size.width, frameHeightPx: size.height, objects: objects),
            to: root.appendingPathComponent(box))
        var keypointPath: String?
        if let keypoints {
            let path = "\(directory)/frame.keypoints.json"
            try writeJSON(KeypointFile(parts: keypoints), to: root.appendingPathComponent(path))
            keypointPath = path
        }
        imageCount += 1
        return WrittenFrame(
            frame: frame, mask: mask, box: box, keypoints: keypointPath, metrics: FrameMetrics(measure))
    }

    func writeExpectation(_ expectation: Expectation, path: String) throws -> String {
        try writeJSON(expectation, to: root.appendingPathComponent(path))
        return path
    }

    /// One contact sheet per family: every frame with its mask tinted red, for review by eye.
    func contactSheet(_ frames: [WrittenFrame], path: String) throws {
        guard !frames.isEmpty else { return }
        let columns = 10
        let cellWidth = 120
        let cellHeight = 160
        let padding = 4
        let rows = (frames.count + columns - 1) / columns
        let width = columns * (cellWidth + padding) + padding
        let height = rows * (cellHeight + padding) + padding
        let context = try Imaging.makeContext(width: width, height: height)
        context.setFillColor(red: 1, green: 1, blue: 1, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        for (index, written) in frames.enumerated() {
            let column = index % columns
            let row = index / columns
            let cell = CGRect(
                x: padding + column * (cellWidth + padding),
                y: height - padding - row * (cellHeight + padding) - cellHeight, width: cellWidth, height: cellHeight)
            if let image = Imaging.loadImage(at: root.appendingPathComponent(written.frame), maxSide: cellHeight) {
                context.draw(image, in: cell)
            }
            if let mask = Imaging.loadImage(at: root.appendingPathComponent(written.mask), maxSide: cellHeight) {
                context.saveGState()
                context.clip(to: cell, mask: mask)
                context.setFillColor(red: 1, green: 0, blue: 0, alpha: 0.35)
                context.fill(cell)
                context.restoreGState()
            }
        }
        guard let sheet = context.makeImage() else {
            throw GeneratorError("cannot finish the contact sheet \(path)")
        }
        try Imaging.writePNG(sheet, to: root.appendingPathComponent(path))
    }
}
