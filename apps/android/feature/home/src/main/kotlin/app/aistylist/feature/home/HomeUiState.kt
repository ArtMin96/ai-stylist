package app.aistylist.feature.home

import app.aistylist.core.data.model.FailureReason

/** Everything the home screen renders. Immutable; produced only by [HomeViewModel]. */
data class HomeUiState(
    /** Host-only API base URL, shown as a caption so testers see which backend they hit. */
    val apiBaseUrl: String,
    val version: VersionUiState,
    /** Analytics consent (opt-in, default off). */
    val analyticsConsent: Boolean,
)

sealed interface VersionUiState {
    data object Loading : VersionUiState

    data class Loaded(
        val version: String,
        val shortCommit: String,
    ) : VersionUiState

    data class Failed(
        val reason: FailureReason,
    ) : VersionUiState
}
