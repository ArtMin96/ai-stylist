// The pill faces' shared layout: AppButtonFace (C01), AppChipFace and AppTag (C03) pad their content, keep their
// minimum height and draw their shape the same way, from fields their generated looks name alike. One copy, so
// the three faces never drift apart. AppBadge (optional paddings) and AppReasonRow (no height) draw through
// `appShape` directly.
import DesignTokens
import SwiftUI

/// The fields of a generated look that lay out and draw a pill face (components README "Entry properties"). A
/// look with no pressed overlay, dashed ring or focus ring leaves that layer out.
protocol AppFaceLook {
  var paddingTop: Double { get }
  var paddingEnd: Double { get }
  var paddingBottom: Double { get }
  var paddingStart: Double { get }
  var height: Double { get }
  var rounded: Double { get }
  var backgroundColor: AppColorRole? { get }
  var overlayColor: AppColorRole? { get }
  var borderColor: AppColorRole? { get }
  var borderWidth: Double? { get }
  var borderDash: Double? { get }
  var focusRing: FocusRingTokens? { get }
}

extension AppFaceLook {
  /// Only buttons and chips have a pressed state.
  var overlayColor: AppColorRole? { nil }
  /// Only tags draw a dashed ring (G13).
  var borderDash: Double? { nil }
  /// Only buttons and chips take focus.
  var focusRing: FocusRingTokens? { nil }
}

extension ButtonAppearance: AppFaceLook {}
extension ChipAppearance: AppFaceLook {}
extension TagAppearance: AppFaceLook {}

extension View {
  /// Lays out and draws a pill face in `look`: its padding, at least its height (and `maxWidth` when given), then
  /// its shape with `appShape`.
  func appFace(_ look: some AppFaceLook, maxWidth: CGFloat? = nil) -> some View {
    padding(
      EdgeInsets(
        top: look.paddingTop,
        leading: look.paddingStart,
        bottom: look.paddingBottom,
        trailing: look.paddingEnd
      )
    )
    .frame(maxWidth: maxWidth, minHeight: look.height)
    .appShape(
      cornerRadius: look.rounded,
      fill: look.backgroundColor,
      overlay: look.overlayColor,
      border: look.borderColor,
      borderWidth: look.borderWidth,
      borderDash: look.borderDash,
      focusRing: look.focusRing
    )
  }
}
