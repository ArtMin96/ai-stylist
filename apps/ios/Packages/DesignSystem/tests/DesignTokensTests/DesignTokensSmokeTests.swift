import DesignTokens
import Testing

@Test("the DesignTokens target builds and links")
func designTokensLinks() {
  #expect(DesignTokensModule.name == "DesignTokens")
}
