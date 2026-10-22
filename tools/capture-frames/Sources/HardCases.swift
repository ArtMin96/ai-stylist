import CoreGraphics
import Foundation

// The hard capture cases (README "Hard cases"): low-contrast and patterned surfaces (C8–C10), an
// object lying on the item (C32) and glare. Everything is drawn here: procedural textures and plain
// shapes, never a photo of a person or a real hand.

/// A surface the item lies on (brief §12 C8–C10), and the tone its garment is given.
enum Surface: String, CaseIterable {
    /// C8: a dark garment on dark fabric.
    case darkOnDark = "dark-on-dark"
    /// C9: a white garment on white bedding.
    case whiteOnWhite = "white-on-white"
    /// C10: the garment in its own colours on a floral sheet with stripes.
    case patterned

    /// The garment's mean luma after toning; nil keeps its colours.
    var garmentLuma: Double? {
        switch self {
        case .darkOnDark: Layout.darkGarmentLuma
        case .whiteOnWhite: Layout.whiteGarmentLuma
        case .patterned: nil
        }
    }

    /// The surface as an opaque raster, the same for every run (seeded).
    func raster(width: Int, height: Int) -> Raster {
        var noise = GaussianNoise(seed: UInt64(stableSeed("surface-\(rawValue)")))
        var pixels = [UInt8](repeating: 255, count: width * height * 4)
        func put(_ x: Int, _ y: Int, _ rgb: (Double, Double, Double)) {
            let offset = (y * width + x) * 4
            pixels[offset] = UInt8(min(255, max(0, rgb.0.rounded())))
            pixels[offset + 1] = UInt8(min(255, max(0, rgb.1.rounded())))
            pixels[offset + 2] = UInt8(min(255, max(0, rgb.2.rounded())))
        }
        switch self {
        case .darkOnDark:
            // Twill weave: diagonal ribs 2 px wide, a slow fold, sensor noise.
            for y in 0..<height {
                for x in 0..<width {
                    let rib = ((x + y) / 2) % 4 < 2 ? 6.0 : -6.0
                    let fold = 5 * sin(Double(x + 2 * y) / 70)
                    let luma = Layout.darkSurfaceLuma + rib + fold + 3 * noise.next()
                    put(x, y, (luma * 0.96, luma * 0.98, luma * 1.08))
                }
            }
        case .whiteOnWhite:
            // Bedding: broad soft folds and a fine cotton grain, kept clear of clipping.
            for y in 0..<height {
                for x in 0..<width {
                    let fold = 9 * sin(Double(3 * x + 5 * y) / 160) + 4 * sin(Double(x - 2 * y) / 45)
                    let luma = min(Layout.whiteSurfaceMaxLuma, Layout.whiteSurfaceLuma + fold + 2 * noise.next())
                    put(x, y, (luma * 1.01, luma, luma * 0.97))
                }
            }
        case .patterned:
            // Stripes, with flowers (five petals and a centre) on a jittered grid.
            for y in 0..<height {
                for x in 0..<width {
                    let stripe = (x / Layout.stripeWidthPx) % 2 == 0
                    put(x, y, stripe ? (226, 214, 192) : (128, 146, 182))
                }
            }
            var random = SplitMix64(seed: UInt64(stableSeed("surface-flowers")))
            let step = Layout.flowerSpacingPx
            for gridY in stride(from: step / 2, to: height + step, by: step) {
                for gridX in stride(from: step / 2, to: width + step, by: step) {
                    let centreX = Double(gridX) + (random.nextUnit() - 0.5) * Double(step) * 0.5
                    let centreY = Double(gridY) + (random.nextUnit() - 0.5) * Double(step) * 0.5
                    let radius = Double(step) * (0.16 + 0.08 * random.nextUnit())
                    let colour: (Double, Double, Double) = random.nextUnit() < 0.5 ? (196, 62, 74) : (236, 170, 60)
                    let turn = random.nextUnit() * 2 * Double.pi
                    let reach = Int(radius * 2.2)
                    for dy in -reach...reach {
                        for dx in -reach...reach {
                            let x = Int(centreX) + dx
                            let y = Int(centreY) + dy
                            guard x >= 0, x < width, y >= 0, y < height else { continue }
                            let distance = (Double(dx * dx + dy * dy)).squareRoot()
                            let angle = atan2(Double(dy), Double(dx)) + turn
                            let petal = radius * (1.2 + 0.8 * cos(5 * angle))
                            if distance <= radius * 0.45 {
                                put(x, y, (246, 218, 96))
                            } else if distance <= petal {
                                put(x, y, colour)
                            }
                        }
                    }
                }
            }
        }
        return Raster(width: width, height: height, pixels: pixels)
    }
}

/// A plain object that can lie on an item (C32): a grey or skin-neutral rounded shape, or a solid
/// object. Never a hand.
enum Occluder: String, CaseIterable {
    case greyShape = "grey-shape"
    case skinShape = "skin-shape"
    case phone
    case book
    case mug

    /// Height ÷ width.
    var aspect: Double {
        switch self {
        case .greyShape, .skinShape: 0.8
        case .phone: 1.8
        case .book: 1.3
        case .mug: 1.0
        }
    }

    /// Draws the object into `rect` (Core Graphics pixels).
    func draw(in context: CGContext, rect: CGRect) {
        context.saveGState()
        defer { context.restoreGState() }
        switch self {
        case .greyShape:
            context.setFillColor(CGColor(srgbRed: 0.62, green: 0.62, blue: 0.60, alpha: 1))
            context.addPath(
                CGPath(roundedRect: rect, cornerWidth: rect.width * 0.3, cornerHeight: rect.height * 0.3, transform: nil))
            context.fillPath()
        case .skinShape:
            context.setFillColor(CGColor(srgbRed: 0.76, green: 0.60, blue: 0.47, alpha: 1))
            context.addEllipse(in: rect)
            context.fillPath()
        case .phone:
            context.setFillColor(CGColor(srgbRed: 0.08, green: 0.08, blue: 0.10, alpha: 1))
            context.addPath(
                CGPath(roundedRect: rect, cornerWidth: rect.width * 0.15, cornerHeight: rect.width * 0.15, transform: nil))
            context.fillPath()
            let screen = rect.insetBy(dx: rect.width * 0.07, dy: rect.width * 0.07)
            context.setFillColor(CGColor(srgbRed: 0.20, green: 0.24, blue: 0.32, alpha: 1))
            context.addPath(
                CGPath(roundedRect: screen, cornerWidth: rect.width * 0.1, cornerHeight: rect.width * 0.1, transform: nil))
            context.fillPath()
        case .book:
            context.setFillColor(CGColor(srgbRed: 0.15, green: 0.35, blue: 0.60, alpha: 1))
            context.fill(rect)
            context.setFillColor(CGColor(srgbRed: 0.95, green: 0.93, blue: 0.85, alpha: 1))
            context.fill(CGRect(x: rect.maxX - rect.width * 0.08, y: rect.minY, width: rect.width * 0.08, height: rect.height))
            context.setFillColor(CGColor(srgbRed: 0.90, green: 0.80, blue: 0.30, alpha: 1))
            context.fill(
                CGRect(x: rect.minX + rect.width * 0.15, y: rect.midY, width: rect.width * 0.6, height: rect.height * 0.08))
        case .mug:
            let body = CGRect(x: rect.minX, y: rect.minY, width: rect.width * 0.8, height: rect.height)
            let colours =
                [
                    CGColor(srgbRed: 0.85, green: 0.30, blue: 0.20, alpha: 1),
                    CGColor(srgbRed: 0.55, green: 0.15, blue: 0.10, alpha: 1),
                ] as CFArray
            context.addPath(
                CGPath(roundedRect: body, cornerWidth: body.width * 0.08, cornerHeight: body.width * 0.08, transform: nil))
            context.clip()
            if let gradient = CGGradient(colorsSpace: Imaging.colorSpace(), colors: colours, locations: [0, 1]) {
                context.drawLinearGradient(
                    gradient, start: CGPoint(x: body.minX, y: body.midY), end: CGPoint(x: body.maxX, y: body.midY),
                    options: [])
            }
            context.resetClip()
            context.setStrokeColor(CGColor(srgbRed: 0.55, green: 0.15, blue: 0.10, alpha: 1))
            context.setLineWidth(rect.width * 0.08)
            context.addEllipse(
                in: CGRect(
                    x: body.maxX - rect.width * 0.06, y: rect.midY - rect.height * 0.18, width: rect.width * 0.24,
                    height: rect.height * 0.36))
            context.strokePath()
        }
    }
}

extension Cutout {
    /// The garment re-toned to `meanLuma` (over its opaque pixels) the way `Raster.darkened` dims a
    /// frame: the local mean (a `detailRadiusPx` box) moves towards black, or towards white for a
    /// target above mid-grey, while the detail around it keeps full contrast, so the garment stays as
    /// sharp as the photo. Its colour keeps `Layout.hardGarmentSaturation` of its saturation, so a dark
    /// garment reads as black on dark fabric, and its outline is eroded by `Layout.hardGarmentErodePx`,
    /// so no light fringe of the photo's own background is left to give it away.
    func toned(toMeanLuma target: Double, detailRadiusPx: Int) throws -> Cutout {
        let source = try Imaging.raster(of: image, width: image.width, height: image.height)
        let count = source.width * source.height
        // Straight colour, with transparent pixels filled by the garment's mean so the edges keep it.
        var opaque = 0
        var sums = [0.0, 0.0, 0.0]
        for index in 0..<count where source.pixels[index * 4 + 3] >= 128 {
            opaque += 1
            for channel in 0..<3 {
                sums[channel] += Double(source.pixels[index * 4 + channel]) * 255 / Double(source.pixels[index * 4 + 3])
            }
        }
        guard opaque > 0 else { throw GeneratorError("an empty cut-out cannot be toned") }
        let fill = sums.map { $0 / Double(opaque) }
        var straight = source
        for index in 0..<count {
            let alpha = Double(source.pixels[index * 4 + 3])
            for channel in 0..<3 {
                let value =
                    alpha >= 128 ? Double(source.pixels[index * 4 + channel]) * 255 / alpha : fill[channel]
                straight.pixels[index * 4 + channel] = UInt8(min(255, max(0, value.rounded())))
            }
            straight.pixels[index * 4 + 3] = 255
        }
        let local = straight.boxMean(radius: detailRadiusPx)
        let towardWhite = target > 128
        func render(level: Double) -> (Raster, Double) {
            var result = source
            var lumaSum = 0.0
            for index in 0..<count {
                let alpha = Double(source.pixels[index * 4 + 3])
                var rgb = [0.0, 0.0, 0.0]
                for channel in 0..<3 {
                    let offset = index * 4 + channel
                    let value = Double(straight.pixels[offset])
                    let mean = local[offset]
                    let toned = towardWhite ? 255 - level * (255 - mean) + (value - mean) : level * mean + (value - mean)
                    rgb[channel] = min(255, max(0, toned))
                }
                let grey = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
                for channel in 0..<3 {
                    rgb[channel] = grey + (rgb[channel] - grey) * Layout.hardGarmentSaturation
                    result.pixels[index * 4 + channel] = UInt8((rgb[channel] * alpha / 255).rounded())
                }
                if alpha >= 128 { lumaSum += 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] }
            }
            return (result, lumaSum / Double(opaque))
        }
        let sourceLuma = 0.299 * fill[0] + 0.587 * fill[1] + 0.114 * fill[2]
        var level = towardWhite ? (255 - target) / max(1, 255 - sourceLuma) : target / max(1, sourceLuma)
        var (result, luma) = render(level: level)
        for _ in 0..<5 {
            level *= towardWhite ? (255 - target) / max(1, 255 - luma) : target / max(1, luma)
            (result, luma) = render(level: level)
        }
        let eroded = result.erodedAlpha(radius: Layout.hardGarmentErodePx)
        return Cutout(image: try Imaging.image(of: eroded), coverage: eroded.opaqueShare)
    }
}

extension Raster {
    /// Clears every pixel within `radius` (Chebyshev) of a pixel whose alpha is under one half.
    func erodedAlpha(radius: Int) -> Raster {
        var result = self
        for y in 0..<height {
            for x in 0..<width where pixels[(y * width + x) * 4 + 3] >= 128 {
                var nearEdge = false
                for dy in -radius...radius where !nearEdge {
                    for dx in -radius...radius {
                        let nx = x + dx
                        let ny = y + dy
                        if nx < 0 || ny < 0 || nx >= width || ny >= height || pixels[(ny * width + nx) * 4 + 3] < 128 {
                            nearEdge = true
                            break
                        }
                    }
                }
                if nearEdge {
                    for channel in 0..<4 { result.pixels[(y * width + x) * 4 + channel] = 0 }
                }
            }
        }
        return result
    }

    /// Direct light (glare): each spot brightens towards white, fully clipped inside `core` of its
    /// radius and fading out at its edge (smoothstep). Alpha is unchanged.
    func withLight(_ spots: [LightSpot]) -> Raster {
        var result = self
        for y in 0..<height {
            for x in 0..<width {
                var gain = 0.0
                for spot in spots {
                    let dx = (Double(x) - spot.centreX * Double(width)) / (spot.radiusX * Double(width))
                    let dy = (Double(y) - spot.centreY * Double(height)) / (spot.radiusY * Double(height))
                    let distance = (dx * dx + dy * dy).squareRoot()
                    let t = min(1, max(0, (1 - distance) / (1 - spot.core)))
                    gain = max(gain, t * t * (3 - 2 * t))
                }
                guard gain > 0 else { continue }
                for channel in 0..<3 {
                    let offset = (y * width + x) * 4 + channel
                    let value = Double(pixels[offset])
                    result.pixels[offset] = UInt8(min(255, (value + (255 - value) * gain).rounded()))
                }
            }
        }
        return result
    }

    /// Overexposure as a phone delivers it: the local mean (a `detailRadiusPx` box) lifts towards white
    /// until the frame's mean luma is `target`, while the detail around it keeps full contrast (the
    /// mirror of `darkened`), so the item stays sharp and found.
    func brightened(toMeanLuma target: Double, detailRadiusPx: Int) -> Raster {
        let local = boxMean(radius: detailRadiusPx)
        func render(level: Double) -> Raster {
            var result = self
            for index in 0..<(width * height) {
                for channel in 0..<3 {
                    let offset = index * 4 + channel
                    let value = Double(pixels[offset])
                    let mean = local[offset]
                    let bright = 255 - level * (255 - mean) + (value - mean)
                    result.pixels[offset] = UInt8(min(255, max(0, bright.rounded())))
                }
            }
            return result
        }
        var level = (255 - target) / max(1, 255 - meanLuma)
        var result = render(level: level)
        for _ in 0..<4 {
            level *= (255 - target) / max(1, 255 - result.meanLuma)
            result = render(level: level)
        }
        return result
    }
}

/// One patch of direct light, in shares of the frame (origin top-left).
struct LightSpot {
    let centreX: Double
    let centreY: Double
    let radiusX: Double
    let radiusY: Double
    /// The share of the radius that is fully clipped.
    let core: Double
}

extension BinaryMask {
    /// The pixels of the opaque part (alpha at least one half) of a drawing at frame size.
    static func opaque(in raster: Raster) -> BinaryMask {
        var mask = BinaryMask.empty(width: raster.width, height: raster.height)
        for index in 0..<(raster.width * raster.height) where raster.pixels[index * 4 + 3] >= 128 {
            mask.values[index] = 255
        }
        return mask
    }

    func subtracting(_ other: BinaryMask) -> BinaryMask {
        var result = self
        for index in 0..<values.count where other.values[index] > 0 {
            result.values[index] = 0
        }
        return result
    }

    func intersectionOverUnion(with other: BinaryMask) -> Double {
        var intersection = 0
        var union = 0
        for index in 0..<values.count {
            let inSelf = values[index] > 0
            let inOther = other.values[index] > 0
            if inSelf && inOther { intersection += 1 }
            if inSelf || inOther { union += 1 }
        }
        return union > 0 ? Double(intersection) / Double(union) : 0
    }

    var share: Double {
        Double(values.reduce(0) { $0 + ($1 > 0 ? 1 : 0) }) / Double(width * height)
    }
}

extension VisionMasks {
    /// What the Mac's Vision makes of a frame whose item mask is `item` (and whose occluder mask, for a
    /// covered frame, is `occluder`).
    static func check(_ image: CGImage, item: BinaryMask, occluder: BinaryMask?, rules: CaptureRules) throws
        -> VisionCheck
    {
        let instances = try instances(in: image).filter { $0.share >= rules.ios.minInstanceAreaShare }
        let itemIoU = instances.map { $0.intersectionOverUnion(with: item) }.max() ?? 0
        let found = itemIoU >= Layout.visionFoundMinIoU
        let separated = occluder.map { occluder in
            found && instances.count >= 2
                && instances.contains { $0.intersectionOverUnion(with: occluder) >= Layout.visionFoundMinIoU }
        }
        return VisionCheck(
            instances: instances.count, foundItem: found, itemIoU: round4(itemIoU), separatedOccluder: separated)
    }
}
