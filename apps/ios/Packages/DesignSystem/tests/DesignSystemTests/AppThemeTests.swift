import DesignSystem
import DesignTokens
import SwiftUI
import Testing

@Test("the system appearance picks light, dark, or S7 high contrast under Increase Contrast")
func themeFollowsTheSystemAppearance() {
  #expect(AppTheme.resolved(colorScheme: .light, contrast: .standard) == .light)
  #expect(AppTheme.resolved(colorScheme: .dark, contrast: .standard) == .dark)
  #expect(AppTheme.resolved(colorScheme: .light, contrast: .increased) == .highContrastLight)
  #expect(AppTheme.resolved(colorScheme: .dark, contrast: .increased) == .highContrastDark)
}

@Test("each theme exposes the generated tokens of its own context")
func themesHoldTheirContextTokens() {
  #expect(AppTheme.light.colors == .light && AppTheme.light.buttons == .light)
  #expect(AppTheme.dark.colors == .dark && AppTheme.dark.buttons == .dark)
  #expect(AppTheme.highContrastLight.colors == .hcLight && AppTheme.highContrastLight.buttons == .hcLight)
  #expect(AppTheme.highContrastDark.colors == .hcDark && AppTheme.highContrastDark.buttons == .hcDark)
}
