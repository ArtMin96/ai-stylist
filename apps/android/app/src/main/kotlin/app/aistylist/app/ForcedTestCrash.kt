package app.aistylist.app

/** The deliberate crash from the debug tools; a distinct name makes it easy to find in PostHog. */
internal class ForcedTestCrash : IllegalStateException("Forced test crash from the debug tools")

/**
 * The debug tools' crash action (planning/14 §5): throws [ForcedTestCrash] on the calling (main)
 * thread, where nothing catches it, so a forced crash proves error tracking and R8 deobfuscation
 * end to end. [AppContainer] hands it to Home only when the build has debug tools (`debug`,
 * `preview`); `release` never gets it.
 */
internal fun throwForcedTestCrash(): Nothing = throw ForcedTestCrash()
