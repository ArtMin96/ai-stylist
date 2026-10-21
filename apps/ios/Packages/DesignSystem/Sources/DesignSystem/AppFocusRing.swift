// The focus ring of the tappable base components (AppButtonFace C01, AppChipFace C03): one copy, so the two
// rings never drift apart.
import DesignTokens
import SwiftUI

/// A `FocusRingTokens` ring outside a shape by the ring's offset, following its corners. Use it as an
/// overlay of the shape it rings.
struct AppFocusRing: View {
  let ring: FocusRingTokens
  /// The corner radius of the shape it rings.
  let cornerRadius: Double

  @Environment(\.appTheme) private var theme

  var body: some View {
    let outset = ring.offset + ring.width
    RoundedRectangle(cornerRadius: cornerRadius + outset)
      .strokeBorder(theme.color(ring.color), lineWidth: ring.width)
      .padding(-outset)
  }
}
