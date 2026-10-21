// The ring drawn outside a base component's shape: the focus ring (AppFocusRing, for AppButtonFace and
// AppChipFace), the badge's outer ring (AppBadge) and the selected swatch's ring (AppChipFace). One copy, so the
// rings never drift apart.
import DesignTokens
import SwiftUI

/// A ring of `width` in `color`, `gap` outside the shape it overlays and following its corners: the shape is
/// outset by `gap + width` (`InsettableShape.inset(by:)` grows a rounded rectangle's corners with it), then
/// stroked inside that outline. Use it as an overlay of the view drawn in `shape`.
struct AppOutsideRing<RingShape: InsettableShape>: View {
  let shape: RingShape
  let color: AppColorRole
  let width: Double
  /// The space between the shape and the ring.
  let gap: Double

  @Environment(\.appTheme) private var theme

  var body: some View {
    shape
      .inset(by: -(gap + width))
      .strokeBorder(theme.color(color), lineWidth: width)
  }
}
