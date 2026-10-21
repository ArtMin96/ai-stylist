package app.aistylist.feature.capture.camera

import android.content.Context
import android.os.SystemClock
import androidx.core.content.edit
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.WornOptIn
import app.aistylist.feature.capture.domain.WornOptInStore
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The underwear worn opt-in in app-private SharedPreferences: on this phone only, never sent, never
 * in analytics (capture brief §7). The app's backup rules exclude it like every other file.
 */
class SharedPreferencesWornOptInStore(
    context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) : WornOptInStore {
    private val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    override suspend fun load(): WornOptIn =
        withContext(ioDispatcher) {
            preferences.getString(KEY, null)?.let { stored -> WornOptIn.entries.firstOrNull { it.name == stored } }
                ?: WornOptIn.NOT_ASKED
        }

    override suspend fun save(optIn: WornOptIn) {
        withContext(ioDispatcher) { preferences.edit { putString(KEY, optIn.name) } }
    }

    private companion object {
        const val FILE = "capture_camera"
        const val KEY = "underwear_worn_opt_in"
    }
}

/** Monotonic time for the capture camera: frames, evaluations and timers share it. */
object SystemCaptureClock : CaptureClock {
    override fun nowMs(): Long = SystemClock.elapsedRealtime()
}
