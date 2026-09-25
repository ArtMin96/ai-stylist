package app.aistylist.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import app.aistylist.app.ui.theme.AiStylistTheme
import app.aistylist.feature.home.HomeRoute
import app.aistylist.feature.home.HomeViewModel

class MainActivity : ComponentActivity() {
    private val homeViewModel: HomeViewModel by viewModels {
        val container = (application as AiStylistApp).container
        HomeViewModel.factory(container.versionRepository, container.analytics, container.config)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            AiStylistTheme {
                // testTagsAsResourceId: Maestro and UiAutomator see test tags ("api-version",
                // "api-error") as resource ids.
                Surface(modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }) {
                    HomeRoute(viewModel = homeViewModel, modifier = Modifier.safeDrawingPadding())
                }
            }
        }
    }
}
