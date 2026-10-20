// A wrapping row layout for the gallery (AI-201). Unlike `LazyVGrid` it is not lazy, so every cell's
// accessibility id is in the tree at once (DesignSystemGalleryScreen), and unlike `Grid` it wraps as the
// cells grow with Dynamic Type.
import SwiftUI

/// Places subviews left to right at their ideal size and starts a new row when the next one would pass
/// the proposed width; `spacing` apart on both axes.
///
/// `nonisolated`: `Layout` refines `Sendable` and its requirements are not main-actor isolated, so this
/// package's default main-actor isolation could not satisfy them. It holds only a `CGFloat`.
nonisolated struct GalleryFlowLayout: Layout {
  let spacing: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    arrangement(of: subviews, maxWidth: proposal.width ?? .infinity).size
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    let origins = arrangement(of: subviews, maxWidth: bounds.width).origins
    for (subview, origin) in zip(subviews, origins) {
      subview.place(
        at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
        anchor: .topLeading,
        proposal: .unspecified
      )
    }
  }

  /// Each subview's top-leading origin relative to the layout, and the size the rows take.
  private func arrangement(of subviews: Subviews, maxWidth: CGFloat) -> (origins: [CGPoint], size: CGSize) {
    var origins: [CGPoint] = []
    var x: CGFloat = 0
    var y: CGFloat = 0
    var rowHeight: CGFloat = 0
    var width: CGFloat = 0
    for subview in subviews {
      let size = subview.sizeThatFits(.unspecified)
      if x > 0, x + size.width > maxWidth {
        x = 0
        y += rowHeight + spacing
        rowHeight = 0
      }
      origins.append(CGPoint(x: x, y: y))
      width = max(width, x + size.width)
      rowHeight = max(rowHeight, size.height)
      x += size.width + spacing
    }
    return (origins, CGSize(width: width, height: y + rowHeight))
  }
}
