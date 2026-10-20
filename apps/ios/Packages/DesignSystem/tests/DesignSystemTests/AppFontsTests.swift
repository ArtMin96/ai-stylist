import CoreText
import DesignSystem
import DesignTokens
import Foundation
import SwiftUI
import Testing

/// The `wght` variation axis tag ("wght" as a four-character code).
private let weightAxis = NSNumber(value: 0x7767_6874)

private func resolve(_ style: AppTextStyle) -> CTFont {
  AppFonts.registerOnce()
  return AppTheme.light.font(style).resolve(in: EnvironmentValues().fontResolutionContext).ctFont
}

@Test("both bundled font files register")
func bundledFontsRegister() {
  AppFonts.registerOnce()
  #expect(AppFonts.failedFiles.isEmpty)
}

@Test("the families Figtree and Young Serif resolve from the bundled files")
func bundledFamiliesResolve() {
  #expect(CTFontCopyFamilyName(resolve(AppTypography.button)) as String == "Figtree")
  #expect(CTFontCopyFamilyName(resolve(AppTypography.title1)) as String == "Young Serif")
}

@Test("each Figtree style renders at its own weight, not the variable font's default Light 300")
func figtreeStylesSetTheirWeight() {
  for style in [AppTypography.body, AppTypography.caption, AppTypography.button, AppTypography.labelAction] {
    let variation = CTFontCopyVariation(resolve(style)) as? [NSNumber: NSNumber]
    #expect(variation?[weightAxis]?.intValue == style.fontWeight, "style weight \(style.fontWeight)")
  }
}
