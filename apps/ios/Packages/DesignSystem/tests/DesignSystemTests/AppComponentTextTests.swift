// AppComponentText without rendering: a type style's text transform changes the drawn string only, and
// VoiceOver keeps the caller's string (DESIGN.md "Typography": the overline draws in caps).
import DesignSystem
import DesignTokens
import Foundation
import Testing

@Test("the overline draws its text in caps but speaks it as written; a style without a transform draws it as is")
func textTransformDrawnNotSpoken() {
  let locale = Locale(identifier: "en_US")
  #expect(AppTypography.overline.textTransform == .uppercase)
  let overline = AppComponentText.strings(ComponentGallery.tagLabel, in: AppTypography.overline, locale: locale)
  #expect(overline.drawn == ComponentGallery.tagLabel.uppercased(with: locale))
  #expect(overline.drawn != ComponentGallery.tagLabel)
  #expect(overline.spoken == ComponentGallery.tagLabel)
  #expect(AppTypography.body.textTransform == .none)
  let body = AppComponentText.strings(ComponentGallery.tagLabel, in: AppTypography.body, locale: locale)
  #expect(body.drawn == ComponentGallery.tagLabel)
  #expect(body.spoken == ComponentGallery.tagLabel)
}

@Test("the uppercase transform follows the locale's case rules")
func textTransformFollowsLocale() {
  let turkish = AppComponentText.strings("i", in: AppTypography.overline, locale: Locale(identifier: "tr_TR"))
  #expect(turkish.drawn == "\u{0130}")
  #expect(turkish.spoken == "i")
}
