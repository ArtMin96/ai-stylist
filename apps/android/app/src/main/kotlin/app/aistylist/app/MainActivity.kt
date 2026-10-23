package app.aistylist.app

import android.os.Bundle
import android.view.KeyEvent
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
import app.aistylist.app.capture.CaptureDebugHooks
import app.aistylist.app.capture.CaptureServices
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.feature.capture.CaptureViewModel
import app.aistylist.feature.capture.ui.CaptureRoute
import app.aistylist.feature.home.HomeRoute
import app.aistylist.feature.home.HomeViewModel

class MainActivity : ComponentActivity() {
    private val container: AppContainer get() = (application as AiStylistApp).container

    private val homeViewModel: HomeViewModel by viewModels {
        HomeViewModel.factory(
            versionRepository = container.versionRepository,
            analytics = container.analytics,
            config = container.config,
            testCrash = container.forceTestCrash,
        )
    }

    /** The `debug` build's capture harness (capture brief §11); null in `preview` and `release`. */
    private val captureHooks: CaptureDebugHooks? by lazy { DebugCapture.hooks(this, intent) }

    private val captureServices: CaptureServices by lazy {
        val services = container.captureServices
        captureHooks?.wrap(services) ?: services
    }

    private val captureViewModel: CaptureViewModel by viewModels {
        CaptureViewModel.factory(captureServices.source, captureServices.optInStore, captureServices.clock)
    }

    /** Which screen fills the window; capture, the gallery and the sweep replace Home in place. */
    private var screen by mutableStateOf(AppScreen.HOME)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        screen = savedInstanceState?.getString(SCREEN_KEY)?.let(AppScreen::valueOf) ?: launchScreen()
        if (savedInstanceState == null && screen == AppScreen.CAPTURE) openCapture()
        setContent {
            AppTheme {
                // testTagsAsResourceId: Maestro and UiAutomator see test tags ("api-version",
                // "api-error", the capture camera's "cap-…") as resource ids.
                Surface(modifier = Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }) {
                    AppContent()
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(SCREEN_KEY, screen.name)
    }

    /** Volume keys are the capture shutter only while the shutter is usable (C26); else the system's. */
    override fun onKeyDown(
        keyCode: Int,
        event: KeyEvent?,
    ): Boolean {
        val isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
        if (isVolumeKey && screen == AppScreen.CAPTURE && captureViewModel.onHardwareShutter()) return true
        return super.onKeyDown(keyCode, event)
    }

    @androidx.compose.runtime.Composable
    private fun AppContent() {
        val gallery = DebugCatalog.gallery
        val hooks = captureHooks
        var isScreenReaderForced by rememberSaveable { mutableStateOf(hooks?.screenReaderAtLaunch == true) }
        when (screen) {
            AppScreen.GALLERY -> {
                // The design-system gallery (`debug` only); "Close" or Back returns to Home.
                BackHandler { screen = AppScreen.HOME }
                Box(modifier = Modifier.safeDrawingPadding()) {
                    gallery?.invoke { screen = AppScreen.HOME }
                }
            }

            AppScreen.CAPTURE -> {
                BackHandler { captureViewModel.onClose() }
                CaptureRoute(
                    viewModel = captureViewModel,
                    dependencies = captureServices.routeDependencies,
                    onClosed = { screen = AppScreen.HOME },
                    forcedScreenReader = isScreenReaderForced,
                    overlay =
                        hooks?.let { harness ->
                            { state, spokenLog ->
                                harness.Panel(state, spokenLog, isScreenReaderForced) { isScreenReaderForced = it }
                            }
                        },
                )
            }

            AppScreen.SWEEP -> {
                Box(modifier = Modifier.safeDrawingPadding()) {
                    hooks?.Sweep(onDone = { screen = AppScreen.HOME })
                }
            }

            AppScreen.HOME -> {
                HomeRoute(
                    viewModel = homeViewModel,
                    modifier = Modifier.safeDrawingPadding(),
                    onOpenDesignSystemGallery = if (gallery != null) ({ screen = AppScreen.GALLERY }) else null,
                    onOpenCapture = if (DebugCapture.HAS_HOME_ENTRY) ({ openCapture() }) else null,
                )
            }
        }
    }

    private fun launchScreen(): AppScreen {
        val hooks = captureHooks ?: return AppScreen.HOME
        return when {
            // A frame-set or screen-reader launch starts on Home, like iOS, so the shared e2e/capture
            // flows walk Home's "Add item" and the picker on both apps.
            hooks.opensSweepAtLaunch -> AppScreen.SWEEP

            else -> AppScreen.HOME
        }
    }

    private fun openCapture() {
        val hooks = captureHooks
        if (hooks != null) hooks.startFlow(captureViewModel) else captureViewModel.onOpened()
        screen = AppScreen.CAPTURE
    }

    private enum class AppScreen { HOME, GALLERY, CAPTURE, SWEEP }

    private companion object {
        const val SCREEN_KEY = "app_screen"
    }
}
