// Debug-only forced crash for proving crash capture and dSYM symbolication (P02 AC-6). Compiled only
// when DEBUG is set, i.e. the Dev configuration (Config/Dev.xcconfig); Preview and Prod never contain it,
// and the composition root hands it to features only in the same builds.
#if DEBUG
  /// Crashes the app deterministically. `@inline(never)` keeps this frame in the stack, so the
  /// symbolicated crash in PostHog names `forceTestCrash()`. Run the app without the debugger: an
  /// attached debugger catches the trap first and PostHog's crash handler is not installed.
  @inline(never)
  func forceTestCrash() -> Never {
    fatalError("Forced test crash from the debug tools on the home screen")
  }
#endif
