// The drawn shape of the C03 components (AppChipFace, AppTag, AppBadge, AppReasonRow): a fill, a pressed
// overlay over it, and a ring inside the shape, solid or dashed, all on one corner radius (components
// README "Entry properties": borderColor, borderWidth, borderDash, overlayColor). One copy for the four.
import DesignTokens
import SwiftUI

/// Draws a look's fill, overlay and inner ring behind and over the content, as colour roles of `\.appTheme`.
struct AppShapeStyle: ViewModifier {
  let cornerRadius: Double
  let fill: AppColorRole?
  let overlay: AppColorRole?
  let border: AppColorRole?
  let borderWidth: Double?
  /// Dashes and gaps of this length (G13); nil draws the ring solid.
  let borderDash: Double?

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
  }
}

extension View {
  /// Draws a look's shape (fill, pressed overlay, inner ring) with `AppShapeStyle`; a nil role or width
  /// leaves that layer out.
  func appShape(
    cornerRadius: Double,
    fill: AppColorRole?,
    overlay: AppColorRole? = nil,
    border: AppColorRole?,
    borderWidth: Double?,
    borderDash: Double? = nil
  ) -> some View {
    modifier(
      AppShapeStyle(
        cornerRadius: cornerRadius,
        fill: fill,
        overlay: overlay,
        border: border,
        borderWidth: borderWidth,
        borderDash: borderDash
      )
    )
  }
}
