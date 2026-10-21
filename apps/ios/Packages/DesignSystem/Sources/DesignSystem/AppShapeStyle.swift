// The drawn shape of the base components (AppButtonFace C01; AppChipFace, AppTag, AppBadge and AppReasonRow
// C03): a fill, a pressed overlay over it, a ring inside the shape, solid or dashed, and the focus ring outside
// it, all on one corner radius (components README "Entry properties": borderColor, borderWidth, borderDash,
// overlayColor, focusRing). One copy for the five.
import DesignTokens
import SwiftUI

/// Draws a look's fill, overlay and inner ring behind and over the content, as colour roles of `\.appTheme`, and
/// its focus ring outside it.
struct AppShapeStyle: ViewModifier {
  let cornerRadius: Double
  let fill: AppColorRole?
  let overlay: AppColorRole?
  let border: AppColorRole?
  let borderWidth: Double?
  /// Dashes and gaps of this length (G13); nil draws the ring solid.
  let borderDash: Double?
  let focusRing: FocusRingTokens?

  @Environment(\.appTheme) private var theme

  func body(content: Content) -> some View {
    let shape = RoundedRectangle(cornerRadius: cornerRadius)
    content
      .background {
        shape.fill(fill.map(theme.color) ?? .clear)
        if let overlay {
          shape.fill(theme.color(overlay))
        }
      }
      .overlay {
        if let border, let borderWidth {
          shape.strokeBorder(
            theme.color(border),
            style: StrokeStyle(lineWidth: borderWidth, dash: borderDash.map { [$0, $0] } ?? [])
          )
        }
      }
      .overlay {
        if let focusRing {
          AppFocusRing(ring: focusRing, cornerRadius: cornerRadius)
        }
      }
  }
}

extension View {
  /// Draws a look's shape (fill, pressed overlay, inner ring, focus ring) with `AppShapeStyle`; a nil role, width
  /// or ring leaves that layer out.
  func appShape(
    cornerRadius: Double,
    fill: AppColorRole?,
    overlay: AppColorRole? = nil,
    border: AppColorRole?,
    borderWidth: Double?,
    borderDash: Double? = nil,
    focusRing: FocusRingTokens? = nil
  ) -> some View {
    modifier(
      AppShapeStyle(
        cornerRadius: cornerRadius,
        fill: fill,
        overlay: overlay,
        border: border,
        borderWidth: borderWidth,
        borderDash: borderDash,
        focusRing: focusRing
      )
    )
  }
}
