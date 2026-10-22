import CoreGraphics
import Foundation

struct FrameSize {
    let width: Int
    let height: Int

    /// Width ÷ height.
    var ratio: Double { Double(width) / Double(height) }
}

/// One ground-truth body keypoint, normalised to the frame (origin top-left; brief §11).
struct Keypoint: Encodable {
    let x: Double
    let y: Double
    let present: Bool
}

/// One finished variant, ready to write.
struct RenderedFrame {
    let variant: String
    /// Nil when the variant plays another frame: jitter plays the good (or whole-body) frame.
    let image: CGImage?
    let measure: FrameMeasure
    let intent: Intent
    let keypoints: [String: Keypoint]?
    let expectation: Expectation
    let jitter: Double
}

struct Placement {
    let cutout: Cutout
    let rect: NormRect
}

enum Sizing {
    /// Box width and height shares for an item of pixel aspect `aspect` whose box covers `areaShare`.
    static func box(aspect: Double, areaShare: Double, size: FrameSize) -> (width: Double, height: Double) {
        let height = (areaShare * size.ratio / aspect).squareRoot()
        return (aspect * height / size.ratio, height)
    }

    /// The largest box share that fits inside the frame less `margin` on every side.
    static func largestArea(aspect: Double, margin: Double, size: FrameSize) -> Double {
        let span = 1 - 2 * margin
        return min(aspect * span * span / size.ratio, span * span * size.ratio / aspect)
    }

    static func centred(_ box: (width: Double, height: Double)) -> NormRect {
        NormRect(x: (1 - box.width) / 2, y: (1 - box.height) / 2, width: box.width, height: box.height)
    }

    /// The same box moved so `Harness.cutPastEdgeShare` of it lies past `edge`.
    static func cut(_ rect: NormRect, past edge: Edge) -> NormRect {
        let past = Harness.cutPastEdgeShare
        var moved = rect
        switch edge {
        case .top: moved.y = -past * rect.height
        case .bottom: moved.y = 1 - (1 - past) * rect.height
        case .left: moved.x = -past * rect.width
        case .right: moved.x = 1 - (1 - past) * rect.width
        }
        return moved
    }
}

/// Draws every variant of brief §11 and judges it. Throws `Rejection` when a finished frame does
/// not show what its variant means; any other error is fatal.
struct Renderer {
    static let flatVariantNames = [
        "good", "cut-top", "cut-bottom", "cut-left", "cut-right", "too-small", "too-dark", "motion-blur", "jitter",
    ]
    static let wornVariantNames = [
        "whole", "shoulders-cut", "hips-cut", "knees-cut", "ankles-cut", "too-small", "jitter",
    ]

    let rules: CaptureRules
    let size: FrameSize

    init(rules: CaptureRules) {
        self.rules = rules
        size = FrameSize(width: rules.frameWidthPx, height: rules.frameHeightPx)
    }

    /// Good, the four cut-offs, too small, too dark, motion-blurred and jittered, in that order.
    func flatVariants(of base: Cutout, family: String) throws -> [RenderedFrame] {
        let judge = Judge(rules: rules, family: family, mode: try rules.mode("flat"))
        let minimum = try rules.family(family).minAreaShare
        let fit = Sizing.largestArea(aspect: base.aspect, margin: Layout.jitterSafeMargin, size: size)
        let goodArea = min(Layout.goodSizeTimesMinimum * minimum, fit)
        guard goodArea >= Layout.minGoodSizeTimesMinimum * minimum else {
            throw Rejection("aspect \(round4(base.aspect)) fits only \(round4(fit)) of the frame")
        }
        let goodRect = Sizing.centred(Sizing.box(aspect: base.aspect, areaShare: goodArea, size: size))
        let goodImage = try compose([Placement(cutout: base, rect: goodRect)])
        let goodIntent = Intent(iosMaskShare: goodArea * base.coverage, boxAreaShare: goodArea)
        var frames: [RenderedFrame] = []
        frames.append(try judged("good", image: goodImage, intent: goodIntent, judge: judge))

        for edge in Edge.allCases {
            let rect = Sizing.cut(goodRect, past: edge)
            let visible = rect.clippedToFrame.area
            let intent = Intent(iosMaskShare: visible * base.coverage, touchedEdges: [edge], boxAreaShare: visible)
            let image = try compose([Placement(cutout: base, rect: rect)])
            frames.append(try judged("cut-\(edge.rawValue)", image: image, intent: intent, judge: judge))
        }

        let smallArea = Harness.tooSmallShareOfMinimum * minimum
        let smallRect = Sizing.centred(Sizing.box(aspect: base.aspect, areaShare: smallArea, size: size))
        let smallIntent = Intent(iosMaskShare: smallArea * base.coverage, boxAreaShare: smallArea)
        let smallImage = try compose([Placement(cutout: base, rect: smallRect)])
        frames.append(try judged("too-small", image: smallImage, intent: smallIntent, judge: judge))

        let goodRaster = try Imaging.raster(of: goodImage, width: size.width, height: size.height)
        let longSideScale = Double(max(size.width, size.height)) / Harness.motionBlurReferenceLongSidePx
        let darkRaster = goodRaster.darkened(
            toMeanLuma: Harness.tooDarkMeanLuma,
            detailRadiusPx: max(1, Int((Double(Layout.darkDetailRadiusPx) * longSideScale).rounded())),
            noiseSigma: Layout.darkNoiseSigma, seed: UInt64(stableSeed("\(family)-too-dark")))
        var darkIntent = goodIntent
        darkIntent.dark = true
        let darkImage = try Imaging.image(of: darkRaster)
        frames.append(try judged("too-dark", image: darkImage, intent: darkIntent, judge: judge))

        var blurIntent = goodIntent
        blurIntent.sharp = false
        let blurPx = Harness.motionBlurPx * longSideScale
        frames.append(try motionBlurred(goodImage, intent: blurIntent, judge: judge, radiusPx: blurPx))

        var jitterIntent = goodIntent
        jitterIntent.jittered = true
        frames.append(
            try judged(
                "jitter", image: nil, intent: jitterIntent, judge: judge, measure: frames[0].measure,
                jitter: Harness.jitterShare))
        return frames
    }

    /// The good frame blurred along the first of `Layout.motionBlurAngles` that leaves the item
    /// clearly unsharp; the last angle's rejection when none does.
    private func motionBlurred(_ good: CGImage, intent: Intent, judge: Judge, radiusPx: Double) throws -> RenderedFrame {
        var last = Rejection("motion-blur: no blur angle to try")
        for angle in Layout.motionBlurAngles {
            let blurred = try Imaging.motionBlurred(good, radiusPx: radiusPx, angle: angle)
            do {
                return try judged("motion-blur", image: blurred, intent: intent, judge: judge)
            } catch let rejection as Rejection {
                last = rejection
            }
        }
        throw last
    }

    /// Two items side by side: the family's item at 1.5× (else 1.25×) its minimum, a second item of
    /// the same size or half its width and height, in a row or a column: the first layout that fits
    /// and in which Vision finds both items as separate instances.
    func twoItems(main: Cutout, second: Cutout, family: String) throws -> RenderedFrame {
        let judge = Judge(rules: rules, family: family, mode: try rules.mode("flat"))
        let minimum = try rules.family(family).minAreaShare
        let span = 1 - 2 * Layout.twoItemMargin
        let gap = Layout.twoItemGap
        var last = Rejection("two-items: the two items do not fit side by side")
        for mainFactor in [1.5, 1.25] {
            for secondScale in [1.0, 0.5] {
                for inRow in [true, false] {
                    let area = mainFactor * minimum
                    let first = Sizing.box(aspect: main.aspect, areaShare: area, size: size)
                    let other = Sizing.box(aspect: second.aspect, areaShare: area * secondScale * secondScale, size: size)
                    let rects: [NormRect]
                    if inRow {
                        let total = first.width + gap + other.width
                        guard total <= span, first.height <= span, other.height <= span else { continue }
                        let left = (1 - total) / 2
                        rects = [
                            NormRect(x: left, y: (1 - first.height) / 2, width: first.width, height: first.height),
                            NormRect(
                                x: left + first.width + gap, y: (1 - other.height) / 2, width: other.width,
                                height: other.height),
                        ]
                    } else {
                        let total = first.height + gap + other.height
                        guard total <= span, first.width <= span, other.width <= span else { continue }
                        let top = (1 - total) / 2
                        rects = [
                            NormRect(x: (1 - first.width) / 2, y: top, width: first.width, height: first.height),
                            NormRect(
                                x: (1 - other.width) / 2, y: top + first.height + gap, width: other.width,
                                height: other.height),
                        ]
                    }
                    let image = try compose([
                        Placement(cutout: main, rect: rects[0]), Placement(cutout: second, rect: rects[1]),
                    ])
                    let intent = Intent(iosMaskShare: area * main.coverage, boxAreaShare: area)
                    do {
                        let frame = try judged("two-items", image: image, intent: intent, judge: judge)
                        let items = frame.measure.instances.filter {
                            $0.maskAreaShare >= rules.ios.minInstanceAreaShare
                        }
                        guard items.count >= 2 else {
                            throw Rejection("two-items: Vision finds \(items.count) item instance(s), not 2")
                        }
                        return frame
                    } catch let rejection as Rejection {
                        last = rejection
                    }
                }
            }
        }
        throw last
    }

    /// C11 "coat too big" (brief §12): the item scaled up until `Harness.cutPastEdgeShare` of its box
    /// lies past the two edges it reaches first, split evenly (left and right for an item wider than
    /// the frame's ratio, else top and bottom), so it touches two or more edges:
    /// `cap-hint-cut-off-multiple`. With that share past each edge instead, the item fills the frame
    /// and Vision finds no foreground at all (2026-10-22), which a phone would read as no item.
    func tooBig(of base: Cutout, family: String) throws -> RenderedFrame {
        let judge = Judge(rules: rules, family: family, mode: try rules.mode("flat"))
        let span = 1 / (1 - Harness.cutPastEdgeShare)
        let box =
            base.aspect >= size.ratio
            ? (width: span, height: span * size.ratio / base.aspect)
            : (width: span * base.aspect / size.ratio, height: span)
        let rect = Sizing.centred(box)
        let touched = Edge.allCases.filter { edge in
            switch edge {
            case .top: rect.y < 0
            case .bottom: rect.maxY > 1
            case .left: rect.x < 0
            case .right: rect.maxX > 1
            }
        }
        let visible = rect.clippedToFrame.area
        let intent = Intent(iosMaskShare: visible * base.coverage, touchedEdges: touched, boxAreaShare: visible)
        let image = try compose([Placement(cutout: base, rect: rect)])
        return try judged("too-big", image: image, intent: intent, judge: judge)
    }

    /// Too bright (brief §3, §6 row 7): the good item on a white surface in direct light. Everything
    /// but the item is clipped white, far over `light.tooBrightAboveClippedShare`, while the item keeps
    /// its contrast, so it is still found and sharp: a hint, never a lock (Q15).
    func tooBright(of base: Cutout, family: String) throws -> RenderedFrame {
        let judge = Judge(rules: rules, family: family, mode: try rules.mode("flat"))
        let minimum = try rules.family(family).minAreaShare
        let fit = Sizing.largestArea(aspect: base.aspect, margin: Layout.jitterSafeMargin, size: size)
        let area = min(Layout.goodSizeTimesMinimum * minimum, fit)
        let rect = Sizing.centred(Sizing.box(aspect: base.aspect, areaShare: area, size: size))
        let context = try Imaging.makeContext(width: size.width, height: size.height)
        context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: size.width, height: size.height))
        context.draw(base.image, in: Imaging.cgRect(rect, width: size.width, height: size.height))
        guard let image = context.makeImage() else {
            throw GeneratorError("cannot finish a too-bright frame")
        }
        var intent = Intent(iosMaskShare: area * base.coverage, boxAreaShare: area)
        intent.bright = true
        return try judged("too-bright", image: image, intent: intent, judge: judge)
    }

    /// The plain background with no item; fatal when Vision finds an item in it.
    func emptyFrame() throws -> (image: CGImage, measure: FrameMeasure) {
        let image = try compose([])
        let measure = try FrameMeasure.of(image, rules: rules)
        guard (measure.main?.maskAreaShare ?? 0) < rules.ios.minInstanceAreaShare else {
            throw GeneratorError("Vision finds an item in the plain background; change Renderer.backgroundContext")
        }
        return (image, measure)
    }

    func emptyExpectation(family: String, measure: FrameMeasure) throws -> Expectation {
        let judge = Judge(rules: rules, family: family, mode: try rules.mode("flat"))
        let intent = Intent(itemPresent: false, iosMaskShare: 0, boxAreaShare: 0)
        if let problem = try judge.problem(intent, measure: measure) {
            throw GeneratorError("empty frame: \(problem)")
        }
        return try judge.expectation(intent, measure: measure)
    }

    /// Re-judges a frame under another family's rules (the batch set uses the generic family).
    func rejudged(_ frame: RenderedFrame, family: String) throws -> RenderedFrame {
        let judge = Judge(rules: rules, family: family, mode: try rules.mode("flat"))
        return try judged(
            frame.variant, image: frame.image, intent: frame.intent, judge: judge, measure: frame.measure,
            jitter: frame.jitter)
    }

    /// The synthetic person wearing `garment`: whole body, each required part past an edge, too
    /// small, jittered. A variant whose frame does not hold up is returned as a rejection, the
    /// others still ship.
    /// `garmentFamily` places the garment on the body: the family itself, or for `generic` the family
    /// the base came from.
    func wornVariants(garment: Cutout, family: String, garmentFamily: String) throws -> (
        frames: [RenderedFrame], rejections: [Rejection]
    ) {
        let judge = Judge(rules: rules, family: family, mode: try rules.mode("worn"))
        let frameHeight = Double(size.height)
        let shoulderY = try figureY("leftShoulder")
        let torso = try figureY("leftHip") - shoulderY
        let past = Harness.wornPastEdgeShareOfTorso * torso
        let wholeHeight = Layout.wornWholeHeightShare * frameHeight
        let anchor = Layout.wornShoulderAnchorShare * frameHeight
        // Camera too close: the shoulders stay near the top and `partY` ends past the bottom edge.
        func zoomed(_ partY: Double) -> (top: Double, height: Double) {
            let height = (frameHeight - anchor) / (partY - shoulderY - past)
            return (anchor - shoulderY * height, height)
        }
        let extentArea = Double(Figure.extent.width * Figure.extent.height)
        let smallHeight =
            (Harness.tooSmallShareOfMinimum * rules.worn.minAreaShare * Double(size.width) * frameHeight / extentArea)
            .squareRoot()
        let hipY = try figureY("leftHip")
        let kneeY = try figureY("leftKnee")
        let ankleY = try figureY("leftAnkle")
        // Camera too close, aimed low: the ankles stay near the bottom and `partY` ends past the top.
        func zoomedFromBelow(_ partY: Double) -> (top: Double, height: Double) {
            let height = (frameHeight - anchor) / (ankleY - partY - past)
            return (frameHeight - anchor - ankleY * height, height)
        }
        // A part above the garment's middle leaves through the top edge, so the garment stays in
        // view (hips for trousers and shorts); otherwise it leaves through the bottom edge.
        let garmentArea = Figure.garmentRect(family: garmentFamily)
        let garmentMidY = Double(garmentArea.midY)
        func cut(_ partY: Double) -> (top: Double, height: Double) {
            partY < garmentMidY ? zoomedFromBelow(partY) : zoomed(partY)
        }
        let shoulders = (top: -(shoulderY + past) * wholeHeight, height: wholeHeight)
        let hips = cut(hipY)
        let knees = cut(kneeY)
        let poses: [(variant: String, top: Double, height: Double)] = [
            ("whole", Layout.wornWholeTopShare * frameHeight, wholeHeight),
            ("shoulders-cut", shoulders.top, shoulders.height),
            ("hips-cut", hips.top, hips.height),
            ("knees-cut", knees.top, knees.height),
            ("ankles-cut", frameHeight + (past - ankleY) * wholeHeight, wholeHeight),
            (
                "too-small",
                (frameHeight - Double(Figure.extent.height) * smallHeight) / 2 - Double(Figure.extent.minY) * smallHeight,
                smallHeight
            ),
        ]
        var frames: [RenderedFrame] = []
        var rejections: [Rejection] = []
        for pose in poses {
            let drawn = try figureFrame(
                garment: garment, garmentArea: garmentArea, family: family, top: pose.top, height: pose.height)
            do {
                frames.append(
                    try judged(pose.variant, image: drawn.image, intent: drawn.intent, judge: judge, keypoints: drawn.keypoints))
            } catch let rejection as Rejection {
                rejections.append(rejection)
            }
        }
        if let whole = frames.first(where: { $0.variant == "whole" }) {
            var intent = whole.intent
            intent.jittered = true
            frames.append(
                try judged(
                    "jitter", image: nil, intent: intent, judge: judge, measure: whole.measure, jitter: Harness.jitterShare,
                    keypoints: whole.keypoints))
        } else {
            rejections.append(Rejection("jitter: needs the whole-body frame"))
        }
        return (frames, rejections)
    }

    private func figureY(_ part: String) throws -> Double {
        guard let point = Figure.keypoints[part] else {
            throw GeneratorError("the drawn figure has no keypoint '\(part)'")
        }
        return Double(point.y)
    }

    private func figureFrame(garment: Cutout, garmentArea: CGRect, family: String, top: Double, height: Double)
        throws -> (
        image: CGImage, intent: Intent, keypoints: [String: Keypoint]
    ) {
        let width = Double(size.width)
        let frameHeight = Double(size.height)
        let centreX = width / 2
        // The figure goes on a transparent layer first, so its exact mask area is known.
        let layer = try Imaging.makeContext(width: size.width, height: size.height)
        Figure.draw(
            in: layer, frameHeight: size.height, centreX: centreX, top: top, height: height, garment: garment,
            garmentArea: garmentArea)
        guard let figure = layer.makeImage() else {
            throw GeneratorError("cannot finish the figure layer")
        }
        let maskShare = try Imaging.raster(of: layer).opaqueShare
        let context = try backgroundContext()
        context.draw(figure, in: CGRect(x: 0, y: 0, width: size.width, height: size.height))
        guard let image = context.makeImage() else {
            throw GeneratorError("cannot finish a worn frame")
        }

        let inside = rules.worn.keypointMinCoordinate...rules.worn.keypointMaxCoordinate
        var keypoints: [String: Keypoint] = [:]
        for part in rules.bodyParts {
            guard let point = Figure.keypoints[part] else {
                throw GeneratorError("the drawn figure has no keypoint '\(part)'")
            }
            let x = (centreX + Double(point.x) * height) / width
            let y = (top + Double(point.y) * height) / frameHeight
            keypoints[part] = Keypoint(x: round4(x), y: round4(y), present: inside.contains(x) && inside.contains(y))
        }
        let missing = try rules.family(family).wornRequiredParts.filter { keypoints[$0]?.present != true }
        let extent = Figure.extent
        let box = NormRect(
            x: (centreX + Double(extent.minX) * height) / width, y: (top + Double(extent.minY) * height) / frameHeight,
            width: Double(extent.width) * height / width, height: Double(extent.height) * height / frameHeight)
        let intent = Intent(iosMaskShare: maskShare, missingParts: missing, boxAreaShare: box.clippedToFrame.area)
        return (image, intent, keypoints)
    }

    private func judged(
        _ variant: String, image: CGImage?, intent: Intent, judge: Judge, measure known: FrameMeasure? = nil,
        jitter: Double = 0, keypoints: [String: Keypoint]? = nil
    ) throws -> RenderedFrame {
        let measure: FrameMeasure
        if let known {
            measure = known
        } else if let image {
            measure = try FrameMeasure.of(image, rules: rules)
        } else {
            throw GeneratorError("variant \(variant) has neither an image nor a measure")
        }
        if let problem = try judge.problem(intent, measure: measure) {
            throw Rejection("\(variant): \(problem)")
        }
        return RenderedFrame(
            variant: variant, image: image, measure: measure, intent: intent, keypoints: keypoints,
            expectation: try judge.expectation(intent, measure: measure), jitter: jitter)
    }

    func compose(_ placements: [Placement]) throws -> CGImage {
        let context = try backgroundContext()
        for placement in placements {
            context.draw(
                placement.cutout.image, in: Imaging.cgRect(placement.rect, width: size.width, height: size.height))
        }
        guard let image = context.makeImage() else {
            throw GeneratorError("cannot finish a frame")
        }
        return image
    }

    /// A plain mid-grey surface, lighter at the top like a lit table: mean luma well inside the
    /// light thresholds and nothing Vision reads as an item.
    private func backgroundContext() throws -> CGContext {
        let context = try Imaging.makeContext(width: size.width, height: size.height)
        let colours =
            [
                CGColor(srgbRed: 0.53, green: 0.52, blue: 0.50, alpha: 1),
                CGColor(srgbRed: 0.45, green: 0.44, blue: 0.42, alpha: 1),
            ] as CFArray
        guard let gradient = CGGradient(colorsSpace: Imaging.colorSpace(), colors: colours, locations: [0, 1]) else {
            throw GeneratorError("cannot build the background gradient")
        }
        context.drawLinearGradient(
            gradient, start: CGPoint(x: 0, y: size.height), end: CGPoint(x: 0, y: 0), options: [])
        return context
    }
}
