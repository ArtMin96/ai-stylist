package app.aistylist.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aistylist.core.data.model.FailureReason

/** Test tags; exposed as Android resource ids for Maestro (`testTagsAsResourceId` in :app). */
object HomeTestTags {
    const val API_VERSION: String = "api-version"
    const val API_ERROR: String = "api-error"
}

/** Stateful entry point: collects [HomeViewModel] state lifecycle-aware. */
@Composable
fun HomeRoute(
    viewModel: HomeViewModel,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    HomeScreen(
        state = state,
        onRetry = viewModel::retry,
        onAnalyticsConsentChange = viewModel::onAnalyticsConsentChange,
        modifier = modifier,
    )
}

/** Stateless home screen: title, API version card, analytics-consent toggle. */
@Composable
fun HomeScreen(
    state: HomeUiState,
    onRetry: () -> Unit,
    onAnalyticsConsentChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
    ) {
        Text(
            text = stringResource(R.string.home_title),
            style = MaterialTheme.typography.headlineLarge,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = stringResource(R.string.home_api_caption, state.apiBaseUrl),
            style = MaterialTheme.typography.bodySmall,
        )
        VersionCard(version = state.version, onRetry = onRetry)
        ConsentRow(checked = state.analyticsConsent, onCheckedChange = onAnalyticsConsentChange)
        Text(
            text = stringResource(R.string.home_consent_caption),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun VersionCard(
    version: VersionUiState,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedCard(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when (version) {
                VersionUiState.Loading -> {
                    Text(stringResource(R.string.home_version_loading))
                }

                is VersionUiState.Loaded -> {
                    Text(
                        text = stringResource(R.string.home_version_loaded, version.version, version.shortCommit),
                        modifier = Modifier.testTag(HomeTestTags.API_VERSION),
                    )
                }

                is VersionUiState.Failed -> {
                    Text(
                        text = stringResource(R.string.home_version_error, failureMessage(version.reason)),
                        modifier = Modifier.testTag(HomeTestTags.API_ERROR),
                    )
                    TextButton(onClick = onRetry) { Text(stringResource(R.string.home_retry)) }
                }
            }
        }
    }
}

/** One accessible control: the whole row toggles, and its label is the switch's name. */
@Composable
private fun ConsentRow(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(stringResource(R.string.home_consent_label))
        Switch(checked = checked, onCheckedChange = null)
    }
}

@Composable
private fun failureMessage(reason: FailureReason): String =
    when (reason) {
        FailureReason.Unreachable -> stringResource(R.string.home_error_unreachable)
        is FailureReason.Problem -> reason.title
        is FailureReason.HttpStatus -> stringResource(R.string.home_error_status, reason.status)
        FailureReason.InvalidResponse -> stringResource(R.string.home_error_invalid_response)
    }

@Preview(showBackground = true)
@Composable
private fun HomeScreenLoadedPreview() {
    MaterialTheme {
        HomeScreen(
            state =
                HomeUiState(
                    apiBaseUrl = "http://10.0.2.2:3000",
                    version = VersionUiState.Loaded(version = "0.1.0", shortCommit = "abcdef0"),
                    analyticsConsent = false,
                ),
            onRetry = {},
            onAnalyticsConsentChange = {},
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun HomeScreenErrorPreview() {
    MaterialTheme {
        HomeScreen(
            state =
                HomeUiState(
                    apiBaseUrl = "http://10.0.2.2:3000",
                    version = VersionUiState.Failed(FailureReason.Unreachable),
                    analyticsConsent = false,
                ),
            onRetry = {},
            onAnalyticsConsentChange = {},
        )
    }
}
