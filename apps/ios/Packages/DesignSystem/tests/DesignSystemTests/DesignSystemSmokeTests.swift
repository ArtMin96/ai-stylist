import DesignSystem
import Testing

@Test("the DesignSystem target builds and links")
func designSystemLinks() {
  #expect(DesignSystemModule.name == "DesignSystem")
}
