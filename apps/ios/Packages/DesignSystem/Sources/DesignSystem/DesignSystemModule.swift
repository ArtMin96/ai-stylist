// Scaffold only (AI-186): the SwiftUI base components come later. Until then this marker is the
// target's only source, so the target compiles and its smoke test has a symbol to link against.
// Delete it when the first component arrives.

/// Names the DesignSystem module, which holds no components yet.
public enum DesignSystemModule {
  /// The module name; the smoke test reads it to prove the target builds and links.
  public static let name = "DesignSystem"
}
