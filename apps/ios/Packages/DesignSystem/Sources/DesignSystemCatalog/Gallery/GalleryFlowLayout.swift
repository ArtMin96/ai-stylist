// A wrapping row layout for the gallery (AI-201). Unlike `LazyVGrid` it is not lazy, so every cell's
// accessibility id is in the tree at once (DesignSystemGalleryScreen), and unlike `Grid` it wraps as the
// cells grow with Dynamic Type.
import SwiftUI

/// Places subviews left to right at their ideal size and starts a new row when the next one would pass
/// the proposed width; `spacing` apart on both axes. A subview whose ideal width alone passes the
/// proposed width (a long caption at the largest text sizes) gets a row of its own at that width, so its
/// text wraps instead of running off-screen.
///
/// `nonisolated`: `Layout` refines `Sendable` and its requirements are not main-actor isolated, so this
/// package's default main-actor isolation could not satisfy them. It holds only a `CGFloat`.
nonisolated struct GalleryFlowLayout: Layout {
  let spacing: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    arrangement(of: subviews, maxWidth: proposal.width ?? .infinity).size
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    let arrangement = arrangement(of: subviews, maxWidth: bounds.width)
    for (subview, (origin, cellProposal)) in zip(subviews, zip(arrangement.origins, arrangement.proposals)) {
      subview.place(
        at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
        anchor: .topLeading,
        proposal: cellProposal
      )
    }
  }

  /// Each subview's top-leading origin relative to the layout and the proposal it is measured and placed
  /// with, and the size the rows take.
  private func arrangement(
    of subviews: Subviews,
    maxWidth: CGFloat
  ) -> (origins: [CGPoint], proposals: [ProposedViewSize], size: CGSize) {
    var origins: [CGPoint] = []
    var proposals: [ProposedViewSize] = []
    var x: CGFloat = 0
    var y: CGFloat = 0
    var rowHeight: CGFloat = 0
    var width: CGFloat = 0
    for subview in subviews {
      let proposal = Self.proposal(for: subview, maxWidth: maxWidth)
      let size = subview.sizeThatFits(proposal)
      if x > 0, x + size.width > maxWidth {
        x = 0
        y += rowHeight + spacing
        rowHeight = 0
      }
      origins.append(CGPoint(x: x, y: y))
      proposals.append(proposal)
      width = max(width, x + size.width)
      rowHeight = max(rowHeight, size.height)
      x += size.width + spacing
    }
    return (origins, proposals, CGSize(width: width, height: y + rowHeight))
  }

  /// The ideal size, or the full width (height free) when the ideal width would not fit in one row.
  private static func proposal(for subview: LayoutSubview, maxWidth: CGFloat) -> ProposedViewSize {
    subview.sizeThatFits(.unspecified).width > maxWidth ? ProposedViewSize(width: maxWidth, height: nil) : .unspecified
  }
}
