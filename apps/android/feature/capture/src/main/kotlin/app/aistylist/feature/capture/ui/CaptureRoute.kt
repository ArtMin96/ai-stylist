package app.aistylist.feature.capture.ui

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.view.accessibility.AccessibilityManager
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.platform.LocalView
import androidx.core.net.toUri
import androidx.core.view.WindowCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.feature.capture.CaptureUiState
import app.aistylist.feature.capture.CaptureViewModel
import app.aistylist.feature.capture.camera.CameraPermission
import app.aistylist.feature.capture.camera.CameraPermissionGate
import app.aistylist.feature.capture.camera.CaptureCameraView
import app.aistylist.feature.capture.camera.CapturePhotoStore
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CaptureEffect
import app.aistylist.feature.capture.domain.CaptureScreen
import app.aistylist.feature.capture.domain.DEFAULT_CAPTURE_MODE
import app.aistylist.feature.capture.domain.HapticKind
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.UnderwearPick
import kotlinx.coroutines.flow.Flow

/** The camera parts the route needs besides the view model; built by the composition root. */
class CaptureRouteDependencies(
    val camera: CaptureCameraView,
    val photos: CapturePhotoStore,
    val permission: CameraPermissionGate,
)

/** Spoken lines kept for the debug spoken log (`cap-debug-spoken-log`, brief §11): the last three. */
private const val SPOKEN_LOG_SIZE = 3

/**
 * The capture flow's stateful entry point: renders the screen the flow is on, and connects the
 * platform around it (lifecycle, TalkBack, camera permission, the system photo picker, haptics,
 * speech). [onClosed] runs once the flow closes; every photo is dropped first. [forcedScreenReader]
 * is the debug flag (`captureScreenReader=1`); [overlay] the debug panel, given the state and the
 * spoken log.
 */
@Composable
fun CaptureRoute(
    viewModel: CaptureViewModel,
    dependencies: CaptureRouteDependencies,
    onClosed: () -> Unit,
    modifier: Modifier = Modifier,
    forcedScreenReader: Boolean = false,
    overlay: (@Composable (CaptureUiState, List<String>) -> Unit)? = null,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val spokenLog = remember { mutableStateListOf<String>() }
    val currentOnClosed by rememberUpdatedState(onClosed)
    val screen = state.flow.screen

    ForegroundEffect(onBackgrounded = viewModel::onBackgrounded, onForegrounded = viewModel::onForegrounded)
    ScreenReaderEffect(forcedScreenReader, onChanged = viewModel::onScreenReaderChanged)
    EffectsCollector(
        effects = viewModel.effects,
        currentState = { viewModel.uiState.value },
        onSpoken = { line ->
            spokenLog += line
            while (spokenLog.size > SPOKEN_LOG_SIZE) spokenLog.removeAt(0)
        },
    )
    PermissionRequest(screen, dependencies.permission)
    SystemBarsEffect(isOnCameraGround = screen is CaptureScreen.Camera)
    ImportPicker(screen, onPicked = viewModel::onImportPicked, onCancelled = viewModel::onImportCancelled)
    LaunchedEffect(screen) {
        if (screen == CaptureScreen.Closed) {
            dependencies.photos.clear()
            currentOnClosed()
        }
    }

    Box(modifier = modifier.fillMaxSize().background(role(AppColorRole.BACKGROUND))) {
        // The screens get callbacks bound to the view model, never the view model itself.
        CaptureScreenContent(
            screen = screen,
            state = state,
            handlers = remember(viewModel, dependencies) { viewModel.flowHandlers(dependencies.camera) },
            dependencies = dependencies,
        )
        overlay?.invoke(state, spokenLog)
    }
}

@Composable
private fun CaptureScreenContent(
    screen: CaptureScreen,
    state: CaptureUiState,
    handlers: FlowHandlers,
    dependencies: CaptureRouteDependencies,
) {
    val context = LocalContext.current
    val loader: PhotoLoader = remember(dependencies) { { ref: PhotoRef -> dependencies.photos.load(ref) } }
    when (screen) {
        CaptureScreen.Picker, CaptureScreen.WornOptInSheet, CaptureScreen.UnderwearPicker -> {
            PickerScreen(screen, handlers.picker)
        }

        is CaptureScreen.Camera -> {
            CameraRoute(screen, state, handlers.camera, dependencies.camera)
        }

        CaptureScreen.Review -> {
            ReviewScreen(
                review = state.flow.review,
                question = state.flow.secondQuestion,
                loader = loader,
                actions = handlers.review,
            )
        }

        is CaptureScreen.ImportPicking -> {
            CaptureScreenContent(screen.returnTo, state, handlers, dependencies)
        }

        is CaptureScreen.ImportTips -> {
            ImportTipsScreen(
                photo = screen.photo,
                tips = screen.tips,
                context = CameraContext(CaptureShapeFamily.GENERIC, DEFAULT_CAPTURE_MODE),
                loader = loader,
                onKeepAnyway = handlers.onKeepImportAnyway,
                onChooseAnother = handlers.onChooseAnotherImport,
                onClose = handlers.onClose,
            )
        }

        CaptureScreen.BatchSummary -> {
            BatchSummaryScreen(photos = state.flow.batchPhotos, loader = loader, onDone = handlers.onClose)
        }

        CaptureScreen.PermissionDenied -> {
            PermissionScreen(
                onOpenSettings = {
                    context.startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "package:${context.packageName}".toUri())
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                },
                onImport = handlers.onImportRequested,
                onClose = handlers.onClose,
            )
        }

        CaptureScreen.NoCamera -> {
            NoCameraScreen(onImport = handlers.onImportRequested, onClose = handlers.onClose)
        }

        // The flow closed: nothing to draw while the host leaves.
        CaptureScreen.Closed -> {}
    }
}

@Composable
private fun CameraRoute(
    screen: CaptureScreen.Camera,
    state: CaptureUiState,
    actions: CameraActions,
    camera: CaptureCameraView,
) {
    val hasTorch by camera.hasTorch.collectAsStateWithLifecycle()
    val isTorchOn by camera.isTorchOn.collectAsStateWithLifecycle()
    val flow = state.flow
    CameraScreen(
        model =
            CameraScreenModel(
                context = state.camera?.context ?: screen.context,
                snapshot = state.camera,
                offeredModes = flow.offeredModes,
                isUnderwear = flow.selection.isUnderwear,
                isWornAllowed = flow.wornOptIn.allowsWorn,
                batchCount = flow.batchPhotos.size,
                isSpeechOn = state.isSpeechOn || state.isScreenReaderOn,
                hasTorch = hasTorch,
                isTorchOn = isTorchOn,
            ),
        actions = actions,
        preview = { previewModifier -> camera.Preview(previewModifier) },
    )
}

/** Background and foreground (brief §4): the camera stops on stop and restarts warming up on start. */
@Composable
private fun ForegroundEffect(
    onBackgrounded: () -> Unit,
    onForegrounded: () -> Unit,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentOnBackgrounded by rememberUpdatedState(onBackgrounded)
    val currentOnForegrounded by rememberUpdatedState(onForegrounded)
    DisposableEffect(lifecycleOwner) {
        var wasStopped = false
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_STOP) {
                    wasStopped = true
                    currentOnBackgrounded()
                }
                if (event == Lifecycle.Event.ON_START && wasStopped) {
                    wasStopped = false
                    currentOnForegrounded()
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
}

/** TalkBack (touch exploration) or the debug flag: anyway at once, hints spoken (brief §8). */
@Composable
private fun ScreenReaderEffect(
    forced: Boolean,
    onChanged: (Boolean) -> Unit,
) {
    val context = LocalContext.current
    val currentOnChanged by rememberUpdatedState(onChanged)
    var isTalkBackOn by remember { mutableStateOf(false) }
    DisposableEffect(context) {
        val manager = context.getSystemService(AccessibilityManager::class.java)
        isTalkBackOn = manager?.isTouchExplorationEnabled == true
        val listener = AccessibilityManager.TouchExplorationStateChangeListener { isTalkBackOn = it }
        manager?.addTouchExplorationStateChangeListener(listener)
        onDispose { manager?.removeTouchExplorationStateChangeListener(listener) }
    }
    LaunchedEffect(isTalkBackOn, forced) { currentOnChanged(isTalkBackOn || forced) }
}

/** Haptics and speech from the camera step; every spoken line also goes to [onSpoken] (the debug log). */
@Composable
private fun EffectsCollector(
    effects: Flow<CaptureEffect>,
    currentState: () -> CaptureUiState,
    onSpoken: (String) -> Unit,
) {
    val view = LocalView.current
    val resources = LocalResources.current
    val context = LocalContext.current
    val speaker = remember(context) { CaptureSpeaker(context) }
    val currentOnSpoken by rememberUpdatedState(onSpoken)
    val readState by rememberUpdatedState(currentState)
    DisposableEffect(speaker) { onDispose { speaker.shutdown() } }
    LaunchedEffect(effects, view, speaker, resources) {
        // Capture requests never leave the view model; haptics and speech do.
        effects.collect { effect ->
            if (effect is CaptureEffect.Haptic) view.performHapticFeedback(effect.kind.feedbackConstant())
            if (effect is CaptureEffect.Speak) {
                val state = readState()
                val step = state.camera?.context ?: return@collect
                val text = resources.getString(effect.hint.spokenText(step))
                currentOnSpoken(text)
                // With a screen reader the hint label's live region speaks; TTS is the speaker button's.
                if (state.isSpeechOn && !state.isScreenReaderOn) speaker.speak(text)
            }
        }
    }
}

/** Unlock: CONFIRM (API 30+) or a click; capture: a heavy click (brief §6). Off when the system's haptics are off. */
private fun HapticKind.feedbackConstant(): Int =
    when (this) {
        HapticKind.UNLOCK -> {
            if (Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.R
            ) {
                HapticFeedbackConstants.CONFIRM
            } else {
                HapticFeedbackConstants.VIRTUAL_KEY
            }
        }

        HapticKind.CAPTURE -> {
            HapticFeedbackConstants.LONG_PRESS
        }
    }

/**
 * Light status and navigation bar icons over the camera ground (the same dark ground in every
 * scheme); elsewhere the scheme's own. Restored when the flow leaves.
 */
@Composable
private fun SystemBarsEffect(isOnCameraGround: Boolean) {
    val window = LocalActivity.current?.window ?: return
    val view = LocalView.current
    val isDark = isDarkScheme()
    DisposableEffect(window, view, isOnCameraGround, isDark) {
        val controller = WindowCompat.getInsetsController(window, view)
        val lightBars = !isOnCameraGround && !isDark
        controller.isAppearanceLightStatusBars = lightBars
        controller.isAppearanceLightNavigationBars = lightBars
        onDispose {
            controller.isAppearanceLightStatusBars = !isDark
            controller.isAppearanceLightNavigationBars = !isDark
        }
    }
}

/** Asks for the camera the first time a camera step opens without the grant (C23). */
@Composable
private fun PermissionRequest(
    screen: CaptureScreen,
    gate: CameraPermissionGate,
) {
    val permission by gate.permission.collectAsStateWithLifecycle()
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission(), gate::onResult)
    val needsAnswer = screen is CaptureScreen.Camera && permission == CameraPermission.NOT_ASKED
    LaunchedEffect(needsAnswer) {
        if (needsAnswer) launcher.launch(Manifest.permission.CAMERA)
    }
}

/** The system photo picker (PickVisualMedia, one image) while the flow is picking (Q17). */
@Composable
private fun ImportPicker(
    screen: CaptureScreen,
    onPicked: (PhotoRef) -> Unit,
    onCancelled: () -> Unit,
) {
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            if (uri == null) onCancelled() else onPicked(PhotoRef(uri.toString()))
        }
    val isPicking = screen is CaptureScreen.ImportPicking
    LaunchedEffect(isPicking) {
        if (isPicking) launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }
}

/** The screens' callbacks bound to this view model. */
private fun CaptureViewModel.flowHandlers(camera: CaptureCameraView): FlowHandlers = FlowHandlers(this, camera)

/** The screens' callbacks, bound once to the view model (screens never receive the view model). */
private class FlowHandlers(
    viewModel: CaptureViewModel,
    camera: CaptureCameraView,
) {
    val onClose: () -> Unit = viewModel::onClose
    val onImportRequested: () -> Unit = viewModel::onImportRequested
    val onKeepImportAnyway: () -> Unit = viewModel::onKeepImportAnyway
    val onChooseAnotherImport: () -> Unit = viewModel::onChooseAnotherImport

    val picker: PickerActions =
        object : PickerActions {
            override fun onFamily(family: CaptureShapeFamily) = viewModel.onFamilyPicked(family)

            override fun onUnderwear() = viewModel.onUnderwearPicked()

            override fun onNotSure() = viewModel.onNotSurePicked()

            override fun onBatch() = viewModel.onBatchPicked()

            override fun onImport() = viewModel.onImportRequested()

            override fun onClose() = viewModel.onClose()

            override fun onOptIn(allowWorn: Boolean) = viewModel.onWornOptInAnswered(allowWorn)

            override fun onUnderwearPick(pick: UnderwearPick) = viewModel.onUnderwearItemPicked(pick)

            override fun onDismissSheet() = viewModel.onUnderwearDismissed()
        }

    val review: ReviewActions =
        ReviewActions(
            onClose = viewModel::onClose,
            onAnswer = viewModel::onSecondPhotoAnswered,
            onTakeSecond = viewModel::onTakeSecondPhoto,
            onDone = viewModel::onClose,
            onRetake = viewModel::onRetake,
        )

    val camera: CameraActions =
        object : CameraActions {
            override fun onClose() = viewModel.onClose()

            override fun onSpeechToggled(isOn: Boolean) = viewModel.onSpeechToggled(isOn)

            override fun onTorchToggled(isOn: Boolean) = camera.setTorch(isOn)

            override fun onWornAllowed(isAllowed: Boolean) = viewModel.onUnderwearWornToggled(isAllowed)

            override fun onModeSelected(mode: CaptureMode) = viewModel.onModeSelected(mode)

            override fun onImport() = viewModel.onImportRequested()

            override fun onShutter() = viewModel.onShutterTapped()

            override fun onAnyway() = viewModel.onAnywayTapped()

            override fun onNextItem() = viewModel.onNextItemTapped()

            override fun onSkip() = viewModel.onSkipSecondPhoto()

            override fun onBatchDone() = viewModel.onBatchDone()
        }
}
