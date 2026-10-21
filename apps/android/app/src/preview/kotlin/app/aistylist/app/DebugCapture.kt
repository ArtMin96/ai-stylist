package app.aistylist.app

import android.content.Context
import android.content.Intent
import app.aistylist.app.capture.CaptureDebugHooks

/**
 * No capture camera entry and no test-frame harness outside the `debug` build (capture brief Q-F,
 * §11): `:feature:capture-debug` is a `debugImplementation` dependency, so this build cannot reach it.
 */
internal object DebugCapture {
    /** Home's "Add item" is `debug` only until a Closet tab exists. */
    const val HAS_HOME_ENTRY: Boolean = false

    /** Same signature as the debug build's harness factory; there is no harness here. */
    fun hooks(
        context: Context,
        intent: Intent,
    ): CaptureDebugHooks? = null
}
