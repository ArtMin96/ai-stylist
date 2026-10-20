import DesignTokens
import Testing

@Test("light and dark schemes are distinct and resolve the background role differently")
func lightAndDarkSchemesDiffer() {
  #expect(AppColors.light != AppColors.dark)
  #expect(AppColors.light[.background] != AppColors.dark[.background])
}

@Test("high-contrast schemes differ from the standard schemes they replace")
func highContrastSchemesDiffer() {
  #expect(AppColors.hcLight != AppColors.light)
  #expect(AppColors.hcDark != AppColors.dark)
}

@Test("banner-dark text stays distinct from its background in each dark-family scheme")
func bannerDarkTextContrastsInDarkFamily() {
  #expect(AppColors.dark[BannerDarkTokens.dark.textColor] != AppColors.dark[BannerDarkTokens.dark.backgroundColor])
  #expect(AppColors.brand[BannerDarkTokens.brand.textColor] != AppColors.brand[BannerDarkTokens.brand.backgroundColor])
  #expect(
    AppColors.hcDark[BannerDarkTokens.hcDark.textColor] != AppColors.hcDark[BannerDarkTokens.hcDark.backgroundColor]
  )
}
