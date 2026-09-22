package app.aistylist.app

import android.app.Application

/** Holds the single [AppContainer] for the process, built on first use from BuildConfig. */
class AiStylistApp : Application() {
    val container: AppContainer by lazy {
        AppContainer.create(apiBaseUrl = BuildConfig.API_BASE_URL, appVersion = BuildConfig.VERSION_NAME)
    }
}
