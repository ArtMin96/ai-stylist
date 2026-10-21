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

@Test("each theme exposes the C03 chip, tag, badge and reason-row looks of its own context")
func themesHoldTheirC03Looks() {
  #expect(AppTheme.light.chips == .light && AppTheme.light.tags == .light)
  #expect(AppTheme.light.badges == .light && AppTheme.light.reasonRows == .light)
  #expect(AppTheme.dark.chips == .dark && AppTheme.dark.tags == .dark)
  #expect(AppTheme.dark.badges == .dark && AppTheme.dark.reasonRows == .dark)
  #expect(AppTheme.highContrastLight.chips == .hcLight && AppTheme.highContrastLight.tags == .hcLight)
  #expect(AppTheme.highContrastLight.badges == .hcLight && AppTheme.highContrastLight.reasonRows == .hcLight)
  #expect(AppTheme.highContrastDark.chips == .hcDark && AppTheme.highContrastDark.tags == .hcDark)
  #expect(AppTheme.highContrastDark.badges == .hcDark && AppTheme.highContrastDark.reasonRows == .hcDark)
}
