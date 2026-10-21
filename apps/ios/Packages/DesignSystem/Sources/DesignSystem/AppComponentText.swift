// One run of text in a type style: a base component's label and parts (AppButtonFace, AppChipFace, AppTag,
// AppBadge, AppReasonRow) and every text the dev-only catalog draws. The bundled type style with its tracking
// and its text transform, a colour role, and wrapping that never truncates. `package` access: the catalog draws
// its text through it too, so every drawn type style applies its `textTransform` (DESIGN.md "Typography").
package import DesignTokens
package import Foundation
package import SwiftUI

/// `text` in `style` and `color` of `\.appTheme`. It wraps at any Dynamic Type size and never truncates, so the
/// host's height is a minimum. The style's text transform changes only the drawn string: VoiceOver reads `text`
/// as written.
package struct AppComponentText: View {
  let text: String
  let style: AppTextStyle
  let color: AppColorRole
  let alignment: TextAlignment

  @Environment(\.appTheme) private var theme
  @Environment(\.locale) private var locale

  /// - Parameter alignment: how wrapped lines line up; centred in a button or a trial pill.
  package init(text: String, style: AppTextStyle, color: AppColorRole, alignment: TextAlignment = .leading) {
    self.text = text
    self.style = style
    self.color = color
    self.alignment = alignment
  }

  package var body: some View {
    let strings = Self.strings(text, in: style, locale: locale)
    Text(strings.drawn)
      .font(theme.font(style))
      .tracking(style.letterSpacing)
      .foregroundStyle(theme.color(color))
      .multilineTextAlignment(alignment)
      .lineLimit(nil)
      .fixedSize(horizontal: false, vertical: true)
      .accessibilityLabel(strings.spoken)
  }

  /// What a run of `text` in `style` draws and what VoiceOver reads: the drawn string takes the style's
  /// `textTransform` in `locale` (the overline draws in caps); the spoken string stays the caller's.
  nonisolated package static func strings(
    _ text: String,
    in style: AppTextStyle,
    locale: Locale
  ) -> (drawn: String, spoken: String) {
    switch style.textTransform {
    case .none: (text, text)
    case .uppercase: (text.uppercased(with: locale), text)
    }
  }
}
