import CoreGraphics
import Foundation

/// A base image that passed selection, with its flat variants in `Renderer.flatVariantNames` order.
struct Base {
    /// The dataset image id, `synthetic-<family>-<n>`, or `<family>/<id>` for a generic base.
    let id: String
    let source: String
    let label: String?
    let sha256: String?
    let cutout: Cutout
    let frames: [RenderedFrame]

    /// The same base without its rendered images, once they are written (keeps memory flat).
    var withoutFrames: Base {
        Base(id: id, source: source, label: label, sha256: sha256, cutout: cutout, frames: [])
    }
}

/// A written good frame: what the sweep and batch sets replay.
struct GoodFrame {
    let written: WrittenFrame
    let frame: RenderedFrame
    let base: Base
    let expected: String
}

struct FamilyResult {
    var bases: [Base] = []
    var rejected: [Manifest.Rejected] = []
    var flatCounts: [String: Int] = [:]
    var wornCounts: [String: Int] = [:]
    var wornGarment: String?
    var contactFrames: [WrittenFrame] = []
}

/// Builds every frame set of brief §11 into `output` and returns the summary it prints.
struct Generator {
    let repoRoot: URL
    let artifacts: URL
    let output: URL

    private static let rulesPath = "packages/shared-kernel/registry/capture-rules.json"
    private static let flatColumns = Renderer.flatVariantNames + ["two-items", "empty", "sweep"]

    func run() throws -> String {
        let rulesURL = repoRoot.appendingPathComponent(Generator.rulesPath)
        let rules = try CaptureRules.load(from: rulesURL)
        let renderer = Renderer(rules: rules)
        let writer = FrameWriter(root: output, size: renderer.size)

        let dataset: Dataset?
        let datasetStatus: String
        do {
            dataset = try Dataset.open(cacheDirectory: artifacts.appendingPathComponent("source/clothing-dataset"))
            datasetStatus = "used"
            let labels = Set(dataset?.images.map(\.label) ?? []).sorted()
            progress("dataset labels in images.csv: \(labels.joined(separator: ", "))")
        } catch {
            dataset = nil
            datasetStatus = "unavailable (\(error)); every family uses drawn silhouettes"
            progress("dataset \(datasetStatus)")
        }

        let empty = try renderer.emptyFrame()
        let emptyWritten = try writer.write(empty.image, measure: empty.measure, keypoints: nil, directory: "common/empty")

        let otherFamilies = rules.families.keys.filter { $0 != "generic" }.sorted()
        var results: [String: FamilyResult] = [:]
        var goodFrames: [String: [GoodFrame]] = [:]
        var sets: [SetEntry] = []

        for family in otherFamilies + ["generic"] {
            var result = FamilyResult()
            try chooseBases(
                family: family, into: &result, dataset: dataset, earlier: results, otherFamilies: otherFamilies,
                renderer: renderer)
            if result.bases.count < Harness.basesPerFamily {
                progress("\(family): only \(result.bases.count) of \(Harness.basesPerFamily) base images passed")
            }
            let emptyExpected = try writer.writeExpectation(
                try renderer.emptyExpectation(family: family, measure: empty.measure),
                path: "\(family)/\(family)-flat-empty/expected.json")
            let emptyId = "\(family)-flat-empty"
            sets.append(
                SetEntry(
                    id: emptyId, family: family, mode: "flat", variant: "empty", kind: "single", source: "synthetic",
                    baseImages: [],
                    segments: [
                        emptyWritten.segment(
                            frames: Harness.segmentFrames, jitter: 0, setId: emptyId, expected: emptyExpected)
                    ]))
            result.flatCounts["empty", default: 0] += 1

            for (index, base) in result.bases.enumerated() {
                let number = String(format: "%02d", index + 1)
                var goodWritten: WrittenFrame?
                for frame in base.frames {
                    let id = "\(family)-flat-\(number)-\(frame.variant)"
                    let written: WrittenFrame
                    if let image = frame.image {
                        written = try writer.write(image, measure: frame.measure, keypoints: nil, directory: "\(family)/\(id)")
                        result.contactFrames.append(written)
                    } else if let goodWritten {
                        written = goodWritten
                    } else {
                        throw GeneratorError("\(id) plays the good frame, which was not written")
                    }
                    let expected = try writer.writeExpectation(frame.expectation, path: "\(family)/\(id)/expected.json")
                    sets.append(
                        SetEntry(
                            id: id, family: family, mode: "flat", variant: frame.variant, kind: "single",
                            source: base.source, baseImages: [base.id],
                            segments: [
                                written.segment(
                                    frames: Harness.segmentFrames, jitter: frame.jitter, setId: id, expected: expected)
                            ]))
                    result.flatCounts[frame.variant, default: 0] += 1
                    if frame.variant == "good" {
                        goodWritten = written
                        goodFrames[family, default: []].append(
                            GoodFrame(written: written, frame: frame, base: base.withoutFrames, expected: expected))
                    }
                }
            }

            if result.bases.count >= 2 {
                for (index, base) in result.bases.enumerated() {
                    let second = result.bases[(index + 1) % result.bases.count]
                    let id = "\(family)-flat-\(String(format: "%02d", index + 1))-two-items"
                    do {
                        let frame = try renderer.twoItems(main: base.cutout, second: second.cutout, family: family)
                        guard let image = frame.image else { continue }
                        let written = try writer.write(image, measure: frame.measure, keypoints: nil, directory: "\(family)/\(id)")
                        result.contactFrames.append(written)
                        let expected = try writer.writeExpectation(frame.expectation, path: "\(family)/\(id)/expected.json")
                        sets.append(
                            SetEntry(
                                id: id, family: family, mode: "flat", variant: "two-items", kind: "single",
                                source: base.source == second.source ? base.source : "mixed",
                                baseImages: [base.id, second.id],
                                segments: [
                                    written.segment(frames: Harness.segmentFrames, jitter: 0, setId: id, expected: expected)
                                ]))
                        result.flatCounts["two-items", default: 0] += 1
                    } catch let rejection as Rejection {
                        result.rejected.append(Manifest.Rejected(id: base.id, reason: rejection.reason))
                    }
                }
            }

            if let goods = goodFrames[family], !goods.isEmpty {
                let id = "\(family)-flat-sweep"
                var segments: [SegmentEntry] = []
                for good in goods {
                    segments.append(
                        good.written.segment(frames: Harness.segmentFrames, jitter: 0, setId: id, expected: good.expected))
                    segments.append(
                        emptyWritten.segment(frames: Harness.gapFrames, jitter: 0, setId: id, expected: emptyExpected))
                }
                let sources = Set(goods.map(\.base.source))
                sets.append(
                    SetEntry(
                        id: id, family: family, mode: "flat", variant: "sweep", kind: "sweep",
                        source: sources.count == 1 ? goods[0].base.source : "mixed", baseImages: goods.map(\.base.id),
                        segments: segments))
                result.flatCounts["sweep", default: 0] += 1
            }
            result.bases = result.bases.map(\.withoutFrames)
            results[family] = result
        }

        for family in otherFamilies + ["generic"] {
            guard rules.families[family]?.modes.contains("worn") == true, var result = results[family] else { continue }
            // Generic's bases are "<family>/<id>": only garments of a family that is worn qualify.
            let garments: [(base: Base, family: String)] = result.bases.compactMap { base in
                guard family == "generic" else { return (base, family) }
                guard let source = base.id.split(separator: "/").first.map(String.init),
                    rules.families[source]?.modes.contains("worn") == true
                else { return nil }
                return (base, source)
            }
            // The first garment whose worn variants all hold up; else the one with fewest rejections.
            var chosen: (garment: Base, worn: (frames: [RenderedFrame], rejections: [Rejection]))?
            for (garment, garmentFamily) in garments {
                let worn = try renderer.wornVariants(
                    garment: garment.cutout, family: family, garmentFamily: garmentFamily)
                if chosen == nil || worn.rejections.count < chosen?.worn.rejections.count ?? 0 {
                    chosen = (garment, worn)
                }
                if worn.rejections.isEmpty { break }
            }
            guard let chosen else {
                progress("\(family): no base image to dress the worn figure")
                continue
            }
            let worn = chosen.worn
            result.wornGarment = chosen.garment.id
            for rejection in worn.rejections {
                result.rejected.append(Manifest.Rejected(id: "worn", reason: rejection.reason))
            }
            var wholeWritten: WrittenFrame?
            for frame in worn.frames {
                let id = "\(family)-worn-\(frame.variant)"
                let written: WrittenFrame
                if let image = frame.image {
                    written = try writer.write(
                        image, measure: frame.measure, keypoints: frame.keypoints, directory: "\(family)/\(id)")
                    result.contactFrames.append(written)
                } else if let wholeWritten {
                    written = wholeWritten
                } else {
                    throw GeneratorError("\(id) plays the whole-body frame, which was not written")
                }
                if frame.variant == "whole" { wholeWritten = written }
                let expected = try writer.writeExpectation(frame.expectation, path: "\(family)/\(id)/expected.json")
                sets.append(
                    SetEntry(
                        id: id, family: family, mode: "worn", variant: frame.variant, kind: "single",
                        source: "synthetic", baseImages: ["synthetic-figure", chosen.garment.id],
                        segments: [
                            written.segment(frames: Harness.segmentFrames, jitter: frame.jitter, setId: id, expected: expected)
                        ]))
                result.wornCounts[frame.variant, default: 0] += 1
            }
            results[family] = result
        }

        let batch = try batchSet(
            goodFrames: goodFrames, otherFamilies: otherFamilies, renderer: renderer, writer: writer,
            empty: emptyWritten, emptyMeasure: empty.measure)
        if let batch { sets.append(batch) }

        let rulesData = try Data(contentsOf: rulesURL)
        let index = FrameIndex(
            frame: FrameIndex.FrameInfo(widthPx: renderer.size.width, heightPx: renderer.size.height),
            playback: FrameIndex.Playback(
                fps: Harness.playbackFps, segmentFrames: Harness.segmentFrames, gapFrames: Harness.gapFrames),
            acceptance: FrameIndex.Acceptance(
                maxUnlockMs: Harness.maxUnlockMs, anywayAtMs: rules.timing.anywayDelayMs,
                anywayToleranceMs: Harness.anywayToleranceMs),
            rules: FrameIndex.RulesReference(path: Generator.rulesPath, sha256: sha256Hex(of: rulesData)),
            sets: sets)
        try writeJSON(index, to: output.appendingPathComponent("index.json"))
        try writeJSON(
            manifest(results: results, dataset: dataset, status: datasetStatus),
            to: output.appendingPathComponent("manifest.json"))
        let text = summary(
            results: results, families: otherFamilies + ["generic"], sets: sets, batch: batch,
            images: writer.imageCount, datasetStatus: datasetStatus)
        try Data(text.utf8).write(to: output.appendingPathComponent("summary.txt"))

        // A review aid: a sheet that fails is reported and skipped, never the frame sets.
        for family in otherFamilies + ["generic"] {
            do {
                try writer.contactSheet(results[family]?.contactFrames ?? [], path: "contact/\(family).png")
            } catch {
                progress("\(family): contact sheet skipped (\(error))")
            }
        }
        return text
    }

    /// Dataset candidates in id order until `Harness.basesPerFamily` pass, then drawn designs to fill
    /// the rest. The generic family reuses the first base of each other family.
    private func chooseBases(
        family: String, into result: inout FamilyResult, dataset: Dataset?, earlier: [String: FamilyResult],
        otherFamilies: [String], renderer: Renderer
    ) throws {
        func consider(id: String, source: String, label: String?, sha256: String?, cutout: () throws -> Cutout) throws {
            do {
                let image = try cutout()
                let frames = try renderer.flatVariants(of: image, family: family)
                result.bases.append(
                    Base(id: id, source: source, label: label, sha256: sha256, cutout: image, frames: frames))
            } catch let rejection as Rejection {
                result.rejected.append(Manifest.Rejected(id: id, reason: rejection.reason))
            }
        }
        let wanted = Harness.basesPerFamily
        if family == "generic" {
            for other in otherFamilies where result.bases.count < wanted {
                guard let first = earlier[other]?.bases.first else { continue }
                try consider(id: "\(other)/\(first.id)", source: first.source, label: first.label, sha256: first.sha256) {
                    first.cutout
                }
            }
            return
        }
        if let dataset {
            let candidates = dataset.candidates(family: family).prefix(Harness.maxCandidatesPerFamily)
            if !candidates.isEmpty {
                progress("\(family): trying up to \(candidates.count) dataset images")
            }
            for candidate in candidates where result.bases.count < wanted {
                guard let file = dataset.imageFile(candidate) else {
                    result.rejected.append(Manifest.Rejected(id: candidate.id, reason: "download failed"))
                    continue
                }
                let sha256 = (try? Data(contentsOf: file)).map { sha256Hex(of: $0) }
                try consider(id: candidate.id, source: "dataset", label: candidate.label, sha256: sha256) {
                    try datasetCutout(file, rules: renderer.rules)
                }
            }
        }
        var design = 0
        while result.bases.count < wanted, design < wanted * 3 {
            let current = design
            try consider(id: "synthetic-\(family)-\(current + 1)", source: "synthetic", label: nil, sha256: nil) {
                try Shapes.cutout(family: family, design: current)
            }
            design += 1
        }
    }

    /// A dataset photo becomes a base only when it holds no person, exactly one foreground instance
    /// that touches no edge band, and enough of the photo to cut out cleanly.
    private func datasetCutout(_ file: URL, rules: CaptureRules) throws -> Cutout {
        guard let decoded = Imaging.loadImage(at: file, maxSide: Layout.sourceMaxSidePx) else {
            throw Rejection("not a decodable image")
        }
        let photo = try Imaging.raster(of: decoded, width: decoded.width, height: decoded.height)
        let image = try Imaging.image(of: photo)
        if try VisionMasks.containsPerson(image) {
            throw Rejection("Vision found a face, body or hand")
        }
        let instances = try VisionMasks.instances(in: image)
        guard instances.count == 1, let stats = instances[0].stats(edgeBandShare: rules.edgeBandShare) else {
            throw Rejection("\(instances.count) foreground instances, needs exactly 1")
        }
        let touched = Edge.allCases.filter { stats.edgeContact[$0] > 0 }
        guard touched.isEmpty else {
            throw Rejection("touches the \(touched.map(\.rawValue).joined(separator: " and ")) edge band")
        }
        guard stats.maskAreaShare >= Layout.sourceMinItemShare else {
            throw Rejection("the item covers only \(round4(stats.maskAreaShare)) of the photo")
        }
        return try Cutout.make(from: photo, mask: instances[0], box: stats.box)
    }

    /// C20: up to `Harness.batchItems` different items, each judged under the generic family (batch
    /// skips the category picker), with 1 s of empty background between them.
    private func batchSet(
        goodFrames: [String: [GoodFrame]], otherFamilies: [String], renderer: Renderer, writer: FrameWriter,
        empty: WrittenFrame, emptyMeasure: FrameMeasure
    ) throws -> SetEntry? {
        // Generic's bases are the first base of each other family, so the rest start at the second.
        var picks = goodFrames["generic"] ?? []
        for index in 1..<Harness.basesPerFamily {
            for family in otherFamilies {
                if let goods = goodFrames[family], goods.count > index { picks.append(goods[index]) }
            }
        }
        let emptyExpected = try writer.writeExpectation(
            try renderer.emptyExpectation(family: "generic", measure: emptyMeasure),
            path: "batch/expected-gap.json")
        var segments: [SegmentEntry] = []
        var baseImages: [String] = []
        var sources: Set<String> = []
        let id = "batch"
        for pick in picks where baseImages.count < Harness.batchItems {
            let judged: RenderedFrame
            do {
                judged = try renderer.rejudged(pick.frame, family: "generic")
            } catch is Rejection {
                continue
            }
            guard judged.expectation.shutter == "unlocked" else { continue }
            let expected = try writer.writeExpectation(
                judged.expectation, path: "batch/expected-\(String(format: "%02d", baseImages.count + 1)).json")
            segments.append(pick.written.segment(frames: Harness.segmentFrames, jitter: 0, setId: id, expected: expected))
            segments.append(empty.segment(frames: Harness.gapFrames, jitter: 0, setId: id, expected: emptyExpected))
            baseImages.append(pick.base.id)
            sources.insert(pick.base.source)
        }
        guard !baseImages.isEmpty else { return nil }
        return SetEntry(
            id: "batch-\(baseImages.count)", family: "generic", mode: "flat", variant: "batch", kind: "batch",
            source: sources.count == 1 ? sources.first ?? "mixed" : "mixed", baseImages: baseImages, segments: segments)
    }

    private func manifest(results: [String: FamilyResult], dataset: Dataset?, status: String) -> Manifest {
        let families = results.mapValues { result in
            Manifest.FamilyInfo(
                bases: result.bases.map { Manifest.BaseInfo(id: $0.id, source: $0.source, label: $0.label, sha256: $0.sha256) },
                rejected: result.rejected, wornGarment: result.wornGarment)
        }
        return Manifest(
            dataset: Manifest.DatasetInfo(
                name: "clothing-dataset", url: Dataset.homepage, branch: dataset?.branch,
                licence: dataset == nil ? "not used" : "CC0-1.0", licenceVerified: dataset != nil,
                licenceEvidence: dataset?.licenceEvidence, status: status),
            synthetic:
                "Bases with source 'synthetic' and every worn frame are drawn by tools/capture-frames (Sources/Shapes.swift): no photo, no real person.",
            families: families)
    }

    private func summary(
        results: [String: FamilyResult], families: [String], sets: [SetEntry], batch: SetEntry?, images: Int,
        datasetStatus: String
    ) -> String {
        func cell(_ text: String, _ width: Int) -> String {
            text.padding(toLength: max(width, text.count + 1), withPad: " ", startingAt: 0)
        }
        var lines = [
            "capture-frames: \(sets.count) frame sets, \(images) frame images",
            "dataset: \(datasetStatus)",
            "",
            "flat sets per family (bases: dataset+synthetic)",
            cell("family", 14) + cell("bases", 7) + Generator.flatColumns.map { cell($0, $0.count + 1) }.joined(),
        ]
        for family in families {
            let result = results[family] ?? FamilyResult()
            let dataset = result.bases.filter { $0.source == "dataset" }.count
            let row =
                cell(family, 14) + cell("\(dataset)+\(result.bases.count - dataset)", 7)
                + Generator.flatColumns.map { cell("\(result.flatCounts[$0] ?? 0)", $0.count + 1) }.joined()
            lines.append(row)
        }
        lines.append("")
        lines.append("worn sets per family")
        lines.append(cell("family", 14) + Renderer.wornVariantNames.map { cell($0, $0.count + 1) }.joined())
        for family in families where !(results[family]?.wornCounts.isEmpty ?? true) {
            let counts = results[family]?.wornCounts ?? [:]
            lines.append(
                cell(family, 14) + Renderer.wornVariantNames.map { cell("\(counts[$0] ?? 0)", $0.count + 1) }.joined())
        }
        lines.append("")
        lines.append("batch: \(batch.map { "\($0.id) (\($0.baseImages.count) items)" } ?? "none")")
        lines.append("")
        lines.append("rejected candidates and variants (manifest.json lists each reason)")
        for family in families {
            let rejected = results[family]?.rejected ?? []
            guard !rejected.isEmpty else { continue }
            var byReason: [String: Int] = [:]
            for item in rejected {
                byReason[String(item.reason.prefix(48)), default: 0] += 1
            }
            // Ties sorted by reason: dictionary order differs between runs.
            let reasons = byReason.sorted { ($1.value, $0.key) < ($0.value, $1.key) }.map { "\($0.value)× \($0.key)" }
            lines.append("  \(family): \(rejected.count) — " + reasons.joined(separator: "; "))
        }
        return lines.joined(separator: "\n") + "\n"
    }
}
