import CoreGraphics
import CoreImage
import Foundation
import ImageIO

/// An RGBA8 image in memory: premultiplied alpha, sRGB, rows top to bottom.
struct Raster {
    let width: Int
    let height: Int
    var pixels: [UInt8]

    /// Rec. 601 luma (0–255) of one pixel. Frames are opaque, so premultiplied equals straight RGB.
    func luma(x: Int, y: Int) -> Double {
        let offset = (y * width + x) * 4
        return 0.299 * Double(pixels[offset]) + 0.587 * Double(pixels[offset + 1])
            + 0.114 * Double(pixels[offset + 2])
    }

    var meanLuma: Double {
        var sum = 0.0
        for y in 0..<height {
            for x in 0..<width {
                sum += luma(x: x, y: y)
            }
        }
        return sum / Double(width * height)
    }

    /// Share of pixels whose luma is at least `minLuma` (the too-bright clipped share, brief §3).
    func clippedShare(minLuma: Double) -> Double {
        var count = 0
        for y in 0..<height {
            for x in 0..<width where luma(x: x, y: y) >= minLuma {
                count += 1
            }
        }
        return Double(count) / Double(width * height)
    }

    /// A dim-room frame as a phone camera delivers it: the overall level drops to `meanLuma`, but
    /// local tone mapping keeps fine detail (the difference from a `detailRadiusPx` box mean) at full
    /// contrast, and the raised sensor gain adds Gaussian luma noise of `noiseSigma`. Scaling the
    /// whole frame instead would cut the sharpness measure by the scale squared, which no real
    /// camera does (README "Too dark"). Alpha is unchanged; the noise is seeded, so output repeats.
    func darkened(toMeanLuma target: Double, detailRadiusPx: Int, noiseSigma: Double, seed: UInt64) -> Raster {
        let local = boxMean(radius: detailRadiusPx)
        var noise = GaussianNoise(seed: seed)
        let offsets = (0..<(width * height)).map { _ in noise.next() * noiseSigma }
        func render(level: Double) -> Raster {
            toneMapped(local: local) { value, mean, index in level * mean + (value - mean) + offsets[index] }
        }
        // Clipping at 0 lifts the mean above the linear target, so correct the level a few times.
        var level = target / max(1, meanLuma)
        var result = render(level: level)
        for _ in 0..<4 {
            level *= target / max(1, result.meanLuma)
            result = render(level: level)
        }
        return result
    }

    /// Every colour channel mapped by `tone(value, local mean, pixel index)`, where `local` is a
    /// `boxMean`, then rounded and clamped to 0…255; alpha is unchanged.
    func toneMapped(local: [Double], _ tone: (_ value: Double, _ mean: Double, _ index: Int) -> Double) -> Raster {
        var result = self
        for index in 0..<(width * height) {
            for channel in 0..<3 {
                let offset = index * 4 + channel
                let mapped = tone(Double(pixels[offset]), local[offset], index)
                result.pixels[offset] = UInt8(min(255, max(0, mapped.rounded())))
            }
        }
        return result
    }

    /// Per colour channel, the mean over the (2r+1)² box around each pixel (clamped at the borders),
    /// indexed like `pixels`; alpha entries are 0.
    func boxMean(radius: Int) -> [Double] {
        var means = [Double](repeating: 0, count: pixels.count)
        let stride = width + 1
        for channel in 0..<3 {
            // Summed-area table with a zero first row and column.
            var table = [Double](repeating: 0, count: stride * (height + 1))
            for y in 0..<height {
                var row = 0.0
                for x in 0..<width {
                    row += Double(pixels[(y * width + x) * 4 + channel])
                    table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + row
                }
            }
            for y in 0..<height {
                let top = max(0, y - radius)
                let bottom = min(height, y + radius + 1)
                for x in 0..<width {
                    let left = max(0, x - radius)
                    let right = min(width, x + radius + 1)
                    let sum =
                        table[bottom * stride + right] - table[top * stride + right]
                        - table[bottom * stride + left] + table[top * stride + left]
                    means[(y * width + x) * 4 + channel] = sum / Double((bottom - top) * (right - left))
                }
            }
        }
        return means
    }

    /// Fraction of pixels with alpha of at least one half.
    var opaqueShare: Double {
        var count = 0
        for index in 0..<(width * height) where pixels[index * 4 + 3] >= 128 {
            count += 1
        }
        return Double(count) / Double(width * height)
    }
}

/// Standard normal samples from a seeded SplitMix64 stream (Box–Muller), so a run repeats exactly.
struct GaussianNoise {
    private var uniform: SplitMix64

    init(seed: UInt64) {
        uniform = SplitMix64(seed: seed)
    }

    mutating func next() -> Double {
        let first = max(Double.leastNonzeroMagnitude, uniform.nextUnit())
        let second = uniform.nextUnit()
        return (-2 * log(first)).squareRoot() * cos(2 * Double.pi * second)
    }
}

enum Imaging {
    static func colorSpace() -> CGColorSpace {
        CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    }

    static func makeContext(width: Int, height: Int) throws -> CGContext {
        guard
            let context = CGContext(
                data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                space: colorSpace(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else {
            throw GeneratorError("cannot create a \(width)x\(height) bitmap context")
        }
        context.interpolationQuality = .high
        return context
    }

    static func raster(of context: CGContext) throws -> Raster {
        guard let data = context.data else {
            throw GeneratorError("bitmap context has no pixel data")
        }
        let rowBytes = context.width * 4
        var pixels = [UInt8](repeating: 0, count: rowBytes * context.height)
        pixels.withUnsafeMutableBytes { destination in
            guard let base = destination.baseAddress else { return }
            for row in 0..<context.height {
                memcpy(base + row * rowBytes, data + row * context.bytesPerRow, rowBytes)
            }
        }
        return Raster(width: context.width, height: context.height, pixels: pixels)
    }

    /// Redraws any image as an RGBA8 sRGB raster of the given size.
    static func raster(of image: CGImage, width: Int, height: Int) throws -> Raster {
        let context = try makeContext(width: width, height: height)
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return try raster(of: context)
    }

    static func image(of raster: Raster) throws -> CGImage {
        guard
            let provider = CGDataProvider(data: Data(raster.pixels) as CFData),
            let image = CGImage(
                width: raster.width, height: raster.height, bitsPerComponent: 8, bitsPerPixel: 32,
                bytesPerRow: raster.width * 4, space: colorSpace(),
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
        else {
            throw GeneratorError("cannot build an image from a \(raster.width)x\(raster.height) raster")
        }
        return image
    }

    /// An 8-bit grey image (a mask: 0 background, 255 foreground).
    static func grayImage(_ values: [UInt8], width: Int, height: Int) throws -> CGImage {
        guard
            let provider = CGDataProvider(data: Data(values) as CFData),
            let image = CGImage(
                width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: width,
                space: CGColorSpaceCreateDeviceGray(),
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
                provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
        else {
            throw GeneratorError("cannot build a \(width)x\(height) mask image")
        }
        return image
    }

    /// Decodes an image file, applies its EXIF orientation and fits it inside `maxSide` pixels.
    static func loadImage(at url: URL, maxSide: Int) -> CGImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxSide,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    static func writePNG(_ image: CGImage, to url: URL) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard
            let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)
        else {
            throw GeneratorError("cannot write \(url.path)")
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            throw GeneratorError("cannot finish \(url.path)")
        }
    }

    /// Converts a top-left normalised rectangle to Core Graphics pixels (origin bottom-left).
    static func cgRect(_ rect: NormRect, width: Int, height: Int) -> CGRect {
        CGRect(
            x: rect.x * Double(width), y: (1 - rect.maxY) * Double(height),
            width: rect.width * Double(width), height: rect.height * Double(height))
    }

    /// The steady-check sharpness (brief §3): luma scaled so the long side is `longSidePx`, then the
    /// variance of the 3×3 Laplacian (4-neighbour kernel) over the pixels inside `box`.
    static func sharpness(of image: CGImage, inside box: NormRect, longSidePx: Int) throws -> Double {
        let scale = Double(longSidePx) / Double(max(image.width, image.height))
        let width = max(3, Int((Double(image.width) * scale).rounded()))
        let height = max(3, Int((Double(image.height) * scale).rounded()))
        let small = try raster(of: image, width: width, height: height)
        let clipped = box.clippedToFrame
        let minX = max(1, Int((clipped.x * Double(width)).rounded(.down)))
        let maxX = min(width - 2, Int((clipped.maxX * Double(width)).rounded(.up)) - 1)
        let minY = max(1, Int((clipped.y * Double(height)).rounded(.down)))
        let maxY = min(height - 2, Int((clipped.maxY * Double(height)).rounded(.up)) - 1)
        guard maxX >= minX, maxY >= minY else { return 0 }
        var sum = 0.0
        var sumOfSquares = 0.0
        var count = 0.0
        for y in minY...maxY {
            for x in minX...maxX {
                let laplacian =
                    small.luma(x: x - 1, y: y) + small.luma(x: x + 1, y: y) + small.luma(x: x, y: y - 1)
                    + small.luma(x: x, y: y + 1) - 4 * small.luma(x: x, y: y)
                sum += laplacian
                sumOfSquares += laplacian * laplacian
                count += 1
            }
        }
        let mean = sum / count
        return sumOfSquares / count - mean * mean
    }

    /// Core Image motion blur over the whole frame, edges clamped so no transparent border appears.
    static func motionBlurred(_ image: CGImage, radiusPx: Double, angle: Double) throws -> CGImage {
        let input = CIImage(cgImage: image)
        guard let filter = CIFilter(name: "CIMotionBlur") else {
            throw GeneratorError("Core Image has no CIMotionBlur filter")
        }
        filter.setValue(input.clampedToExtent(), forKey: kCIInputImageKey)
        filter.setValue(radiusPx, forKey: kCIInputRadiusKey)
        filter.setValue(angle, forKey: kCIInputAngleKey)
        let context = CIContext(options: [.workingColorSpace: colorSpace()])
        guard
            let output = filter.outputImage?.cropped(to: input.extent),
            let blurred = context.createCGImage(output, from: input.extent)
        else {
            throw GeneratorError("CIMotionBlur produced no image")
        }
        return blurred
    }
}
