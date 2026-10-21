// The focus ring of the tappable base components (AppButtonFace C01, AppChipFace C03), drawn by AppShapeStyle:
// one copy, so the two rings never drift apart.
import DesignTokens
import SwiftUI

/// A `FocusRingTokens` ring outside a shape by the ring's offset, following its corners. Use it as an overlay of
/// the shape it rings.
struct AppFocusRing: View {
  let ring: FocusRingTokens
  /// The corner radius of the shape it rings.
  let cornerRadius: Double

  var body: some View {
    AppOutsideRing(
      shape: RoundedRectangle(cornerRadius: cornerRadius),
      color: ring.color,
      width: ring.width,
      gap: ring.offset
    )
  }
}
