// Scaffold only (AI-186): the generated token code will land in generated/. Until then this marker is
// the target's only source, so the target compiles and its smoke test has a symbol to link against.
// Delete it when the generated code arrives.

/// Names the DesignTokens module, which holds no tokens yet.
public enum DesignTokensModule {
  /// The module name; the smoke test reads it to prove the target builds and links.
  public static let name = "DesignTokens"
}
