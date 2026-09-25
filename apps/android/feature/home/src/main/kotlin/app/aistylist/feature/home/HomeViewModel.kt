package app.aistylist.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.Analytics
import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsPropertyValue
import app.aistylist.core.data.config.AppConfig
import app.aistylist.core.data.model.VersionResult
import app.aistylist.core.data.version.VersionRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Home screen state holder: loads the API version (retryable) and owns the analytics-consent
 * toggle. All dependencies come from the composition root through [factory].
 */
class HomeViewModel(
    private val versionRepository: VersionRepository,
    private val analytics: Analytics,
    config: AppConfig,
) : ViewModel() {
    private val state =
        MutableStateFlow(
            HomeUiState(
                apiBaseUrl = config.apiBaseUrl,
                version = VersionUiState.Loading,
                analyticsConsent = analytics.hasConsent(),
            ),
        )
    val uiState: StateFlow<HomeUiState> = state.asStateFlow()

    private var versionJob: Job? = null

    init {
        // consentRequired in the taxonomy: the gate drops it unless the user already opted in.
        analytics.track(
            AnalyticsEvent(
                name = AnalyticsTaxonomy.AppOpened.NAME,
                properties =
                    mapOf(
                        AnalyticsTaxonomy.AppOpened.PLATFORM to AnalyticsPropertyValue.Text(PLATFORM),
                        AnalyticsTaxonomy.AppOpened.APP_VERSION to AnalyticsPropertyValue.Text(config.appVersion),
                        AnalyticsTaxonomy.AppOpened.COLD_START to AnalyticsPropertyValue.Flag(true),
                    ),
            ),
        )
        loadVersion()
    }

    /** Re-requests the API version (the Retry button). */
    fun retry() {
        loadVersion()
    }

    fun onAnalyticsConsentChange(granted: Boolean) {
        analytics.setConsent(granted)
        state.update { it.copy(analyticsConsent = analytics.hasConsent()) }
    }

    private fun loadVersion() {
        versionJob?.cancel()
        state.update { it.copy(version = VersionUiState.Loading) }
        versionJob =
            viewModelScope.launch {
                val version =
                    when (val result = versionRepository.fetchVersion()) {
                        is VersionResult.Success -> {
                            VersionUiState.Loaded(result.version.version, result.version.shortCommit)
                        }

                        is VersionResult.Failure -> {
                            VersionUiState.Failed(result.reason)
                        }
                    }
                state.update { it.copy(version = version) }
            }
    }

    companion object {
        private const val PLATFORM = "android"

        /** Used by the composition root; keeps construction explicit (no DI framework). */
        fun factory(
            versionRepository: VersionRepository,
            analytics: Analytics,
            config: AppConfig,
        ): ViewModelProvider.Factory =
            viewModelFactory {
                initializer { HomeViewModel(versionRepository, analytics, config) }
            }
    }
}
