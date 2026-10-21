import CoreGraphics
import CoreVideo
import Foundation
import Vision

/// One binary mask at frame size: 0 background, 255 foreground, rows top to bottom.
struct BinaryMask {
    let width: Int
    let height: Int
    var values: [UInt8]

    static func empty(width: Int, height: Int) -> BinaryMask {
        BinaryMask(width: width, height: height, values: [UInt8](repeating: 0, count: width * height))
    }

    func union(_ other: BinaryMask) -> BinaryMask {
        var result = self
        for index in 0..<values.count where other.values[index] > 0 {
            result.values[index] = 255
        }
        return result
    }

    /// Box, area and edge contact as the iOS rules read them (brief §3): the edge band is
    /// `edgeBandShare` of that dimension, and contact is the share of the edge's length whose band
    /// holds at least one mask pixel. Nil for an empty mask.
    func stats(edgeBandShare: Double) -> MaskStats? {
        var minX = width
        var minY = height
        var maxX = -1
        var maxY = -1
        var count = 0
        for y in 0..<height {
            for x in 0..<width where values[y * width + x] > 0 {
                minX = min(minX, x)
                maxX = max(maxX, x)
                minY = min(minY, y)
                maxY = max(maxY, y)
                count += 1
            }
        }
        guard count > 0 else { return nil }
        let bandX = max(1, Int((edgeBandShare * Double(width)).rounded()))
        let bandY = max(1, Int((edgeBandShare * Double(height)).rounded()))
        var top = 0
        var bottom = 0
        for x in 0..<width {
            if (0..<bandY).contains(where: { values[$0 * width + x] > 0 }) { top += 1 }
            if (0..<bandY).contains(where: { values[(height - 1 - $0) * width + x] > 0 }) { bottom += 1 }
        }
        var left = 0
        var right = 0
        for y in 0..<height {
            if (0..<bandX).contains(where: { values[y * width + $0] > 0 }) { left += 1 }
            if (0..<bandX).contains(where: { values[y * width + width - 1 - $0] > 0 }) { right += 1 }
        }
        let box = NormRect(
            x: Double(minX) / Double(width), y: Double(minY) / Double(height),
            width: Double(maxX - minX + 1) / Double(width), height: Double(maxY - minY + 1) / Double(height))
        return MaskStats(
            box: box, maskAreaShare: Double(count) / Double(width * height),
            edgeContact: EdgeShares(
                top: Double(top) / Double(width), bottom: Double(bottom) / Double(width),
                left: Double(left) / Double(height), right: Double(right) / Double(height)))
    }
}

struct MaskStats {
    let box: NormRect
    let maskAreaShare: Double
    let edgeContact: EdgeShares
}

enum VisionMasks {
    /// The macOS Vision foreground instance mask (the request the iOS app runs), one binary mask per
    /// instance at the image's size.
    static func instances(in image: CGImage) throws -> [BinaryMask] {
        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([request])
        guard let observation = request.results?.first else { return [] }
        var masks: [BinaryMask] = []
        for instance in observation.allInstances {
            let buffer = try observation.generateScaledMaskForImage(
                forInstances: IndexSet(integer: instance), from: handler)
            masks.append(try binaryMask(of: buffer, width: image.width, height: image.height))
        }
        return masks
    }

    /// True when Vision finds a face, a human body or a hand. Candidates where it does are never
    /// used: the frames hold product shots and drawn figures only, no real person.
    static func containsPerson(_ image: CGImage) throws -> Bool {
        let faces = VNDetectFaceRectanglesRequest()
        let humans = VNDetectHumanRectanglesRequest()
        humans.upperBodyOnly = false
        let hands = VNDetectHumanHandPoseRequest()
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([faces, humans, hands])
        let found = (faces.results?.count ?? 0) + (humans.results?.count ?? 0) + (hands.results?.count ?? 0)
        return found > 0
    }

    private static func binaryMask(of buffer: CVPixelBuffer, width: Int, height: Int) throws -> BinaryMask {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(buffer) else {
            throw GeneratorError("Vision mask buffer has no pixel data")
        }
        let format = CVPixelBufferGetPixelFormatType(buffer)
        let isFloat = format == kCVPixelFormatType_OneComponent32Float
        guard isFloat || format == kCVPixelFormatType_OneComponent8 else {
            throw GeneratorError("unexpected Vision mask pixel format \(format)")
        }
        let bufferWidth = CVPixelBufferGetWidth(buffer)
        let bufferHeight = CVPixelBufferGetHeight(buffer)
        let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
        var mask = BinaryMask.empty(width: width, height: height)
        for y in 0..<height {
            let row = base + min(bufferHeight - 1, y * bufferHeight / height) * rowBytes
            for x in 0..<width {
                let column = min(bufferWidth - 1, x * bufferWidth / width)
                let value =
                    isFloat
                    ? row.load(fromByteOffset: column * 4, as: Float.self)
                    : Float(row.load(fromByteOffset: column, as: UInt8.self)) / 255
                if value >= 0.5 { mask.values[y * width + x] = 255 }
            }
        }
        return mask
    }
}
