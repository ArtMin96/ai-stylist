// A gallery item of the Typography section (AI-195).
import DesignSystem
import DesignTokens
import SwiftUI

/// The style's DESIGN.md name, set in that style with its text transform (the overline in caps).
struct GalleryTypeItem: View {
  let style: AppTextStyle

  var body: some View {
    AppComponentText(text: style.name, style: style, color: .text)
  }
}
