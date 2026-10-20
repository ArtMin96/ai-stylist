package app.aistylist.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.feature.home.HomeRoute
import app.aistylist.feature.home.HomeViewModel

class MainActivity : ComponentActivity() {
    private val homeViewModel: HomeViewModel by viewModels {
        val container = (application as AiStylistApp).container
        HomeViewModel.factory(
            versionRepository = container.versionRepository,
            analytics = container.analytics,
            config = container.config,
            testCrash = container.forceTestCrash,
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme {
                // testTagsAsResourceId: Maestro and UiAutomator see test tags ("api-version",
                // "api-error") as resource ids.
                Surface(modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }) {
                    // The design-system gallery (`debug` only) replaces Home in this same window, so
                    // its test tags stay resource ids; "Close" or Back returns to Home.
                    val gallery = DebugCatalog.gallery
                    var showsGallery by rememberSaveable { mutableStateOf(false) }
                    if (showsGallery && gallery != null) {
                        BackHandler { showsGallery = false }
                        Box(modifier = Modifier.safeDrawingPadding()) {
                            gallery { showsGallery = false }
                        }
                    } else {
                        HomeRoute(
                            viewModel = homeViewModel,
                            modifier = Modifier.safeDrawingPadding(),
                            onOpenDesignSystemGallery = if (gallery != null) ({ showsGallery = true }) else null,
                        )
                    }
                }
            }
        }
    }
}
