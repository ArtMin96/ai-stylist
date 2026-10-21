import CoreGraphics
import Foundation

/// An item without its background, cropped to its box: transparent outside the item.
struct Cutout {
    let image: CGImage
    /// Share of the cut-out's box that the item covers (alpha at least one half).
    let coverage: Double

    /// Pixel width ÷ pixel height of the box.
    var aspect: Double { Double(image.width) / Double(image.height) }

    /// Cuts the masked item out of an opaque photo and crops it to the mask's box.
    static func make(from photo: Raster, mask: BinaryMask, box: NormRect) throws -> Cutout {
        let minX = Int((box.x * Double(photo.width)).rounded())
        let minY = Int((box.y * Double(photo.height)).rounded())
        let width = max(1, min(photo.width - minX, Int((box.width * Double(photo.width)).rounded())))
        let height = max(1, min(photo.height - minY, Int((box.height * Double(photo.height)).rounded())))
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        for y in 0..<height {
            for x in 0..<width {
                let source = (minY + y) * photo.width + minX + x
                guard mask.values[source] > 0 else { continue }
                for channel in 0..<4 {
                    pixels[(y * width + x) * 4 + channel] = photo.pixels[source * 4 + channel]
                }
            }
        }
        let raster = Raster(width: width, height: height, pixels: pixels)
        return Cutout(image: try Imaging.image(of: raster), coverage: raster.opaqueShare)
    }

    /// Crops a drawing on a transparent canvas to the box of its opaque pixels.
    static func cropped(_ drawing: Raster) throws -> Cutout {
        var minX = drawing.width
        var minY = drawing.height
        var maxX = -1
        var maxY = -1
        for y in 0..<drawing.height {
            for x in 0..<drawing.width where drawing.pixels[(y * drawing.width + x) * 4 + 3] >= 128 {
                minX = min(minX, x)
                maxX = max(maxX, x)
                minY = min(minY, y)
                maxY = max(maxY, y)
            }
        }
        guard maxX >= minX, maxY >= minY else {
            throw GeneratorError("a synthetic drawing came out empty")
        }
        let width = maxX - minX + 1
        let height = maxY - minY + 1
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        for y in 0..<height {
            for x in 0..<(width * 4) {
                pixels[y * width * 4 + x] = drawing.pixels[((minY + y) * drawing.width + minX) * 4 + x]
            }
        }
        let raster = Raster(width: width, height: height, pixels: pixels)
        return Cutout(image: try Imaging.image(of: raster), coverage: raster.opaqueShare)
    }
}

/// A drawn item in unit coordinates (0–1 of its own box, y down).
struct Outline {
    var aspect: Double
    var polygons: [[CGPoint]] = []
    var ellipses: [CGRect] = []
    var roundedRects: [CGRect] = []
    var cornerShare = 0.08
    /// Straps and handles: stroked in the item's colour, so they are part of the item.
    var handles: [[CGPoint]] = []
    var handleWidthShare = 0.05
    /// Zips, flaps, pockets: stroked darker on top of the item.
    var details: [[CGPoint]] = []
    var evenOdd = false
}

/// Drawn silhouettes for the families the dataset lacks (bag, and small-item when it has too few
/// hats) and for every family when the dataset cannot be fetched. Flat colours with a check
/// texture: the texture gives the steady check's sharpness measure something to read, the way
/// fabric does in a photo.
enum Shapes {
    private static let palette: [(Double, Double, Double)] = [
        (0.16, 0.22, 0.42), (0.70, 0.16, 0.18), (0.40, 0.45, 0.20), (0.85, 0.65, 0.15),
        (0.10, 0.50, 0.50), (0.45, 0.20, 0.40), (0.92, 0.92, 0.90), (0.12, 0.12, 0.13),
    ]
    private static let canvasLongSidePx = 480.0
    private static let canvasPaddingShare = 0.08
    private static let checkCellShare = 0.03

    static func cutout(family: String, design: Int) throws -> Cutout {
        guard let outline = outline(family: family, design: design) else {
            throw GeneratorError("no synthetic outline for family '\(family)'")
        }
        let colour = palette[(design + family.count) % palette.count]
        let itemWidth = outline.aspect >= 1 ? canvasLongSidePx : canvasLongSidePx * outline.aspect
        let itemHeight = outline.aspect >= 1 ? canvasLongSidePx / outline.aspect : canvasLongSidePx
        let padding = canvasLongSidePx * canvasPaddingShare
        let canvasWidth = Int((itemWidth + 2 * padding).rounded())
        let canvasHeight = Int((itemHeight + 2 * padding).rounded())
        let context = try Imaging.makeContext(width: canvasWidth, height: canvasHeight)
        let frame = CGRect(x: padding, y: padding, width: itemWidth, height: itemHeight)
        let toCanvas = { (point: CGPoint) -> CGPoint in
            CGPoint(x: frame.minX + point.x * frame.width, y: frame.maxY - point.y * frame.height)
        }
        let path = CGMutablePath()
        for polygon in outline.polygons {
            path.addLines(between: polygon.map(toCanvas))
            path.closeSubpath()
        }
        for unit in outline.ellipses {
            path.addEllipse(in: canvasRect(unit, in: frame))
        }
        for unit in outline.roundedRects {
            let corner = outline.cornerShare * min(frame.width, frame.height)
            path.addRoundedRect(in: canvasRect(unit, in: frame), cornerWidth: corner, cornerHeight: corner)
        }
        let fillRule: CGPathFillRule = outline.evenOdd ? .evenOdd : .winding
        context.setFillColor(red: colour.0, green: colour.1, blue: colour.2, alpha: 1)
        context.addPath(path)
        context.fillPath(using: fillRule)

        context.setLineCap(.round)
        context.setLineJoin(.round)
        context.setStrokeColor(red: colour.0, green: colour.1, blue: colour.2, alpha: 1)
        context.setLineWidth(outline.handleWidthShare * frame.width)
        for handle in outline.handles {
            context.addLines(between: handle.map(toCanvas))
            context.strokePath()
        }

        // Check texture, clipped to the body of the item.
        context.saveGState()
        context.addPath(path)
        context.clip(using: fillRule)
        context.setFillColor(red: 0, green: 0, blue: 0, alpha: 0.2)
        let cell = checkCellShare * canvasLongSidePx
        for row in 0...Int(Double(canvasHeight) / cell) {
            for column in 0...Int(Double(canvasWidth) / cell) where (row + column) % 2 == 0 {
                context.fill(CGRect(x: Double(column) * cell, y: Double(row) * cell, width: cell, height: cell))
            }
        }
        context.restoreGState()

        context.setStrokeColor(red: colour.0 * 0.5, green: colour.1 * 0.5, blue: colour.2 * 0.5, alpha: 1)
        context.setLineWidth(0.012 * canvasLongSidePx)
        context.addPath(path)
        context.strokePath()
        for detail in outline.details {
            context.addLines(between: detail.map(toCanvas))
            context.strokePath()
        }
        return try Cutout.cropped(try Imaging.raster(of: context))
    }

    private static func canvasRect(_ unit: CGRect, in frame: CGRect) -> CGRect {
        CGRect(
            x: frame.minX + unit.minX * frame.width, y: frame.maxY - unit.maxY * frame.height,
            width: unit.width * frame.width, height: unit.height * frame.height)
    }

    private static func points(_ pairs: [(Double, Double)]) -> [CGPoint] {
        pairs.map { CGPoint(x: $0.0, y: $0.1) }
    }

    /// Small shape changes per design number, so five drawn items are five different items.
    private static func outline(family: String, design: Int) -> Outline? {
        let stretch = [0.92, 1.0, 1.08][design % 3]
        switch family {
        case "top":
            if design % 2 == 0 {
                return Outline(
                    aspect: 1.0 * stretch,
                    polygons: [
                        points([
                            (0.35, 0.0), (0.65, 0.0), (1.0, 0.18), (0.88, 0.38), (0.76, 0.30), (0.76, 1.0),
                            (0.24, 1.0), (0.24, 0.30), (0.12, 0.38), (0.0, 0.18),
                        ])
                    ])
            }
            return Outline(
                aspect: 1.05 * stretch,
                polygons: [
                    points([
                        (0.36, 0.0), (0.64, 0.0), (0.86, 0.06), (1.0, 0.85), (0.88, 0.88), (0.76, 0.36),
                        (0.76, 1.0), (0.24, 1.0), (0.24, 0.36), (0.12, 0.88), (0.0, 0.85), (0.14, 0.06),
                    ])
                ])
        case "long-bottom":
            return Outline(
                aspect: 0.45 * stretch,
                polygons: [points([(0.1, 0.0), (0.9, 0.0), (1.0, 1.0), (0.58, 1.0), (0.5, 0.25), (0.42, 1.0), (0.0, 1.0)])],
                details: [points([(0.1, 0.06), (0.9, 0.06)])])
        case "short-bottom":
            if design % 2 == 0 {
                return Outline(
                    aspect: 1.1 * stretch,
                    polygons: [
                        points([(0.08, 0.0), (0.92, 0.0), (1.0, 1.0), (0.56, 1.0), (0.5, 0.45), (0.44, 1.0), (0.0, 1.0)])
                    ],
                    details: [points([(0.08, 0.1), (0.92, 0.1)])])
            }
            return Outline(
                aspect: 0.9 * stretch,
                polygons: [points([(0.22, 0.0), (0.78, 0.0), (1.0, 1.0), (0.0, 1.0)])],
                details: [points([(0.2, 0.1), (0.8, 0.1)])])
        case "one-piece":
            return Outline(
                aspect: 0.6 * stretch,
                polygons: [
                    points([
                        (0.32, 0.0), (0.68, 0.0), (0.74, 0.12), (0.66, 0.36), (1.0, 1.0), (0.0, 1.0), (0.34, 0.36),
                        (0.26, 0.12),
                    ])
                ])
        case "outerwear":
            return Outline(
                aspect: 1.0 * stretch,
                polygons: [
                    points([
                        (0.36, 0.0), (0.64, 0.0), (0.86, 0.06), (1.0, 0.9), (0.86, 0.93), (0.78, 0.40), (0.78, 1.0),
                        (0.22, 1.0), (0.22, 0.40), (0.14, 0.93), (0.0, 0.9), (0.14, 0.06),
                    ])
                ],
                details: [points([(0.5, 0.04), (0.5, 0.98)])])
        case "shoes":
            if design % 2 == 0 {
                return Outline(
                    aspect: 2.2 * stretch,
                    polygons: [
                        points([
                            (0.0, 0.55), (0.05, 0.35), (0.35, 0.30), (0.45, 0.0), (0.62, 0.0), (0.66, 0.35),
                            (0.98, 0.62), (1.0, 1.0), (0.0, 1.0),
                        ])
                    ],
                    details: [points([(0.02, 0.86), (0.99, 0.86)])])
            }
            return Outline(
                aspect: 1.6 * stretch,
                polygons: [
                    points([
                        (0.0, 0.6), (0.05, 0.45), (0.30, 0.40), (0.32, 0.0), (0.62, 0.0), (0.62, 0.45), (0.98, 0.65),
                        (1.0, 1.0), (0.0, 1.0),
                    ])
                ],
                details: [points([(0.02, 0.88), (0.99, 0.88)])])
        case "bag":
            return bag(design: design, stretch: stretch)
        case "small-item":
            return smallItem(design: design, stretch: stretch)
        default:
            return nil
        }
    }

    private static func bag(design: Int, stretch: Double) -> Outline {
        switch design % 4 {
        case 0:
            return Outline(
                aspect: 1.2 * stretch, roundedRects: [CGRect(x: 0, y: 0.34, width: 1, height: 0.66)],
                handles: [points([(0.28, 0.36), (0.30, 0.10), (0.5, 0.05), (0.70, 0.10), (0.72, 0.36)])],
                details: [points([(0.0, 0.52), (1.0, 0.52)])])
        case 1:
            return Outline(
                aspect: 0.9 * stretch, roundedRects: [CGRect(x: 0.04, y: 0.26, width: 0.92, height: 0.74)],
                cornerShare: 0.04,
                handles: [points([(0.3, 0.28), (0.35, 0.05), (0.65, 0.05), (0.7, 0.28)])])
        case 2:
            return Outline(
                aspect: 1.8 * stretch, roundedRects: [CGRect(x: 0, y: 0, width: 1, height: 1)], cornerShare: 0.1,
                details: [points([(0.0, 0.35), (0.5, 0.62), (1.0, 0.35)])])
        default:
            return Outline(
                aspect: 0.8 * stretch, roundedRects: [CGRect(x: 0, y: 0.14, width: 1, height: 0.86)],
                cornerShare: 0.18,
                handles: [points([(0.4, 0.16), (0.42, 0.04), (0.58, 0.04), (0.6, 0.16)])],
                details: [points([(0.2, 0.62), (0.8, 0.62), (0.8, 0.9), (0.2, 0.9), (0.2, 0.62)])])
        }
    }

    private static func smallItem(design: Int, stretch: Double) -> Outline {
        switch design % 5 {
        case 0:
            return Outline(
                aspect: 1.0, ellipses: [CGRect(x: 0, y: 0, width: 1, height: 1), CGRect(x: 0.24, y: 0.24, width: 0.52, height: 0.52)],
                evenOdd: true)
        case 1:
            return Outline(
                aspect: 0.55 * stretch,
                polygons: [
                    points([(0.3, 0.0), (0.7, 0.0), (0.7, 0.3), (0.3, 0.3)]),
                    points([(0.3, 0.7), (0.7, 0.7), (0.7, 1.0), (0.3, 1.0)]),
                ],
                ellipses: [CGRect(x: 0.04, y: 0.25, width: 0.92, height: 0.5)])
        case 2:
            return Outline(
                aspect: 2.6 * stretch,
                polygons: [points([(0.4, 0.3), (0.6, 0.3), (0.6, 0.46), (0.4, 0.46)])],
                ellipses: [CGRect(x: 0, y: 0.1, width: 0.44, height: 0.8), CGRect(x: 0.56, y: 0.1, width: 0.44, height: 0.8)])
        case 3:
            return Outline(
                aspect: 1.6 * stretch,
                polygons: [points([(0.42, 0.62), (1.0, 0.70), (0.98, 0.9), (0.42, 0.94)])],
                ellipses: [CGRect(x: 0.0, y: 0.0, width: 0.72, height: 1.0)])
        default:
            return Outline(
                aspect: 1.4 * stretch, roundedRects: [CGRect(x: 0, y: 0, width: 1, height: 1)], cornerShare: 0.12,
                details: [points([(0.0, 0.4), (1.0, 0.4)])])
        }
    }
}

/// The synthetic person for worn frames (brief §11): simple shapes, no real body. Coordinates are
/// figure units: x from the body's centre line, y from the top of the head, figure height 1. The
/// subject faces the camera, so the subject's left (Vision and ML Kit name joints by the subject's
/// side) is the image's right, +x.
enum Figure {
    static let keypoints: [String: CGPoint] = [
        "leftShoulder": CGPoint(x: 0.12, y: 0.19), "rightShoulder": CGPoint(x: -0.12, y: 0.19),
        "leftHip": CGPoint(x: 0.08, y: 0.50), "rightHip": CGPoint(x: -0.08, y: 0.50),
        "leftKnee": CGPoint(x: 0.075, y: 0.71), "rightKnee": CGPoint(x: -0.075, y: 0.71),
        "leftAnkle": CGPoint(x: 0.07, y: 0.93), "rightAnkle": CGPoint(x: -0.07, y: 0.93),
    ]
    /// The drawn figure's box in figure units (wrists plus half the arm's stroke; head top to feet).
    static let extent = CGRect(x: -0.2225, y: 0.015, width: 0.445, height: 0.96)
    private static let armWidth = 0.055
    private static let legWidth = 0.075
    private static let bodyColour = (0.30, 0.27, 0.25)

    /// Where the garment sits on the body, in figure units.
    static func garmentRect(family: String) -> CGRect {
        switch family {
        case "outerwear": CGRect(x: -0.17, y: 0.16, width: 0.34, height: 0.44)
        case "long-bottom": CGRect(x: -0.13, y: 0.47, width: 0.26, height: 0.47)
        case "short-bottom": CGRect(x: -0.125, y: 0.47, width: 0.25, height: 0.23)
        case "one-piece": CGRect(x: -0.16, y: 0.165, width: 0.32, height: 0.615)
        default: CGRect(x: -0.16, y: 0.165, width: 0.32, height: 0.365)
        }
    }

    /// Draws the figure with its head top at `top` px and its centre line at `centreX` px, `height` px
    /// tall, wearing `garment` over `garmentArea` (figure units).
    static func draw(
        in context: CGContext, frameHeight: Int, centreX: Double, top: Double, height: Double,
        garment: Cutout, garmentArea: CGRect
    ) {
        let toFrame = { (x: Double, y: Double) -> CGPoint in
            CGPoint(x: centreX + x * height, y: Double(frameHeight) - (top + y * height))
        }
        let rectInFrame = { (unit: CGRect) -> CGRect in
            let topLeft = toFrame(unit.minX, unit.minY)
            return CGRect(
                x: topLeft.x, y: topLeft.y - unit.height * height, width: unit.width * height,
                height: unit.height * height)
        }
        context.setFillColor(red: bodyColour.0, green: bodyColour.1, blue: bodyColour.2, alpha: 1)
        context.setStrokeColor(red: bodyColour.0, green: bodyColour.1, blue: bodyColour.2, alpha: 1)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        context.fillEllipse(in: rectInFrame(CGRect(x: -0.06, y: 0.015, width: 0.12, height: 0.12)))
        context.fill(rectInFrame(CGRect(x: -0.025, y: 0.12, width: 0.05, height: 0.06)))
        context.addLines(between: [toFrame(-0.13, 0.17), toFrame(0.13, 0.17), toFrame(0.11, 0.53), toFrame(-0.11, 0.53)])
        context.closePath()
        context.fillPath()
        context.setLineWidth(armWidth * height)
        for side in [1.0, -1.0] {
            context.addLines(between: [toFrame(0.12 * side, 0.19), toFrame(0.17 * side, 0.35), toFrame(0.19 * side, 0.50)])
            context.strokePath()
        }
        context.setLineWidth(legWidth * height)
        for side in [1.0, -1.0] {
            context.addLines(between: [toFrame(0.07 * side, 0.50), toFrame(0.075 * side, 0.71), toFrame(0.07 * side, 0.93)])
            context.strokePath()
            let footX = side > 0 ? 0.04 : -0.13
            context.fillEllipse(in: rectInFrame(CGRect(x: footX, y: 0.937, width: 0.09, height: 0.038)))
        }
        context.draw(garment.image, in: rectInFrame(garmentArea))
    }
}
