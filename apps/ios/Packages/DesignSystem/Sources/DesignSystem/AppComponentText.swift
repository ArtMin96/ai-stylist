// One run of text in a C03 component (a chip's label and parts, a tag or badge label, a reason row line):
// the bundled type style with its tracking, a colour role, and wrapping that never truncates.
import DesignTokens
import SwiftUI

/// `text` in `style` and `color` of `\.appTheme`. It wraps at any Dynamic Type size and never truncates, so
/// the host's height is a minimum.
struct AppComponentText: View {
  let text: String
  let style: AppTextStyle
  let color: AppColorRole

  @Environment(\.appTheme) private var theme

  var body: some View {
    Text(text)
      .font(theme.font(style))
      .tracking(style.letterSpacing)
      .foregroundStyle(theme.color(color))
      .lineLimit(nil)
      .fixedSize(horizontal: false, vertical: true)
  }
}
