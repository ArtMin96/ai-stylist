package app.aistylist.feature.capture

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.aistylist.contracts.kernel.CaptureMode
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.contracts.kernel.CaptureShapeFamily
import app.aistylist.feature.capture.domain.CameraContext
import app.aistylist.feature.capture.domain.CameraFeedEvent
import app.aistylist.feature.capture.domain.CaptureCameraSession
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureEffect
import app.aistylist.feature.capture.domain.CaptureFlowState
import app.aistylist.feature.capture.domain.CaptureObservationSource
import app.aistylist.feature.capture.domain.CaptureScreen
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.PhotoResult
import app.aistylist.feature.capture.domain.UnderwearPick
import app.aistylist.feature.capture.domain.WornOptIn
import app.aistylist.feature.capture.domain.WornOptInStore
import app.aistylist.feature.capture.domain.evaluateImportChecks
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Capture flow state holder: wires the pure `domain` (flow, camera session) to a [StateFlow] and
 * runs the camera step while its screen is shown and the app is in the foreground. Spoken hints and
 * haptics leave through [effects]. All dependencies come from the composition root through [factory].
 */
class CaptureViewModel(
    private val source: CaptureObservationSource,
    private val optInStore: WornOptInStore,
    private val clock: CaptureClock,
) : ViewModel() {
    private val state = MutableStateFlow(CaptureUiState())
    val uiState: StateFlow<CaptureUiState> = state.asStateFlow()

    private val effectChannel = Channel<CaptureEffect>(Channel.BUFFERED)

    /** [CaptureEffect.Speak] and [CaptureEffect.Haptic], once each; capture requests stay inside. */
    val effects: Flow<CaptureEffect> = effectChannel.receiveAsFlow()

    private val poseDetection = MutableStateFlow(false)
    private var session: CaptureCameraSession? = null
    private var cameraJob: Job? = null
    private var isForeground = true

    /** The host opens the flow: a fresh picker, whatever an earlier flow left (it closed, photos dropped). */
    fun onOpened() = updateFlow { CaptureFlowState() }

    fun onFamilyPicked(family: CaptureShapeFamily) = updateFlow { it.pickFamily(family) }

    fun onNotSurePicked() = updateFlow { it.pickNotSure() }

    /** The underwear tile: reads the stored opt-in first (the sheet shows only when never answered). */
    fun onUnderwearPicked() {
        viewModelScope.launch {
            val optIn = optInStore.load()
            updateFlow { it.pickUnderwear(optIn) }
        }
    }

    fun onWornOptInAnswered(allowWorn: Boolean) {
        updateFlow { it.answerWornOptIn(allowWorn) }
        saveOptIn()
    }

    fun onUnderwearItemPicked(pick: UnderwearPick) = updateFlow { it.pickUnderwearItem(pick) }

    fun onUnderwearDismissed() = updateFlow { it.dismissUnderwear() }

    fun onBatchPicked() = updateFlow { it.startBatch() }

    fun onModeSelected(mode: CaptureMode) = updateFlow { it.changeMode(mode) }

    fun onUnderwearWornToggled(allowed: Boolean) {
        updateFlow { it.setUnderwearWornAllowed(allowed) }
        saveOptIn()
    }

    fun onShutterTapped() = withSession { it.shutterTapped() }

    /** A volume key. Returns true when it acted as the shutter (consume the key), false to leave it to the system. */
    fun onHardwareShutter(): Boolean {
        if (state.value.camera?.isHardwareShutterEnabled != true) return false
        withSession { it.hardwareShutter() }
        return true
    }

    fun onAnywayTapped() = withSession { it.anywayTapped() }

    fun onNextItemTapped() = withSession { it.nextItemTapped() }

    fun onBatchDone() = updateFlow { it.finishBatch() }

    fun onSecondPhotoAnswered(wantsSecond: Boolean) = updateFlow { it.answerSecondQuestion(wantsSecond) }

    fun onTakeSecondPhoto() = updateFlow { it.takeSecondPhoto() }

    fun onSkipSecondPhoto() = updateFlow { it.skipSecondPhoto() }

    fun onRetake() = updateFlow { it.retake() }

    fun onImportRequested() = updateFlow { it.openImport() }

    fun onImportCancelled() = updateFlow { it.cancelImport() }

    /** A photo from the system picker: checked once, then review or the tips screen. Never refused. */
    fun onImportPicked(photo: PhotoRef) {
        viewModelScope.launch {
            val observation = source.analyzeStill(photo)
            val tips = observation?.let { evaluateImportChecks(it, state.value.flow.importFamily) }.orEmpty()
            updateFlow { it.importPicked(photo, tips) }
        }
    }

    fun onKeepImportAnyway() = updateFlow { it.keepImportAnyway() }

    fun onChooseAnotherImport() = updateFlow { it.chooseAnotherImport() }

    /** Review "Done", the batch summary "Done", or a close button. */
    fun onClose() = updateFlow { it.close() }

    fun onScreenReaderChanged(isOn: Boolean) {
        state.update { it.copy(isScreenReaderOn = isOn) }
        withSession { it.screenReaderChanged(isOn) }
    }

    fun onSpeechToggled(isOn: Boolean) {
        state.update { it.copy(isSpeechOn = isOn) }
        withSession { it.speechToggled(isOn) }
    }

    /** The app went to the background: camera and analysis stop. */
    fun onBackgrounded() {
        isForeground = false
        cameraJob?.cancel()
        cameraJob = null
        session?.backgrounded()
        publishCamera()
    }

    /** Back in the foreground: a camera step restarts in warming-up with a fresh anyway timer. */
    fun onForegrounded() {
        isForeground = true
        val current = session ?: return
        dispatch(current.foregrounded())
        startFeed(current)
    }

    private fun updateFlow(transform: (CaptureFlowState) -> CaptureFlowState) {
        val before = state.value.flow
        val after = transform(before)
        state.update { it.copy(flow = after) }
        syncCamera(before.screen, after.screen)
    }

    /** Starts a camera step for a new camera screen, forwards a mode change, or stops the camera. */
    private fun syncCamera(
        before: CaptureScreen,
        after: CaptureScreen,
    ) {
        val camera = after as? CaptureScreen.Camera
        val previous = before as? CaptureScreen.Camera
        when {
            camera == null -> {
                stopCamera()
            }

            previous == null || !camera.context.isSameStepAs(previous.context) -> {
                startCamera(camera)
            }

            camera.context.mode != previous.context.mode -> {
                poseDetection.value = camera.context.mode == CaptureMode.WORN
                withSession { it.modeChanged(camera.context.mode) }
            }
        }
    }

    private fun startCamera(camera: CaptureScreen.Camera) {
        stopCamera()
        val current = state.value
        val newSession =
            CaptureCameraSession(
                context = camera.context,
                clock = clock,
                isScreenReaderOn = current.isScreenReaderOn,
                isSpeechOn = current.isSpeechOn,
            )
        session = newSession
        poseDetection.value = camera.context.mode == CaptureMode.WORN
        publishCamera()
        if (isForeground) startFeed(newSession)
    }

    private fun stopCamera() {
        cameraJob?.cancel()
        cameraJob = null
        session = null
        publishCamera()
    }

    /** Collects the source's frames and ticks the session at the evaluation interval. */
    private fun startFeed(target: CaptureCameraSession) {
        cameraJob?.cancel()
        cameraJob =
            viewModelScope.launch {
                launch {
                    while (isActive) {
                        delay(CaptureRules.Evaluation.INTERVAL_MS.toLong())
                        dispatch(target.tick())
                    }
                }
                source.feed(poseDetection).collect { event -> onFeedEvent(target, event) }
            }
    }

    private fun onFeedEvent(
        target: CaptureCameraSession,
        event: CameraFeedEvent,
    ) {
        when (event) {
            CameraFeedEvent.Ready -> dispatch(target.cameraReady())
            is CameraFeedEvent.Frame -> dispatch(target.submit(event.observation))
            is CameraFeedEvent.Unavailable -> updateFlow { it.cameraUnavailable(event.reason) }
        }
    }

    private inline fun withSession(input: (CaptureCameraSession) -> List<CaptureEffect>) {
        val current = session ?: return
        dispatch(input(current))
    }

    private fun dispatch(effects: List<CaptureEffect>) {
        publishCamera()
        effects.forEach { effect ->
            when (effect) {
                is CaptureEffect.RequestCapture -> session?.let(::capture)
                is CaptureEffect.Haptic, is CaptureEffect.Speak -> effectChannel.trySend(effect)
            }
        }
    }

    /** Runs in the ViewModel scope, not the feed, so leaving the camera for review never cancels it. */
    private fun capture(target: CaptureCameraSession) {
        viewModelScope.launch {
            when (val result = source.takePhoto()) {
                is PhotoResult.Taken -> {
                    dispatch(target.captureFinished())
                    updateFlow { it.photoCaptured(result.photo) }
                }

                PhotoResult.Failed -> {
                    dispatch(target.captureFailed())
                }
            }
        }
    }

    private fun publishCamera() {
        state.update { it.copy(camera = session?.snapshot) }
    }

    private fun saveOptIn() {
        val optIn = state.value.flow.wornOptIn
        if (optIn == WornOptIn.NOT_ASKED) return
        viewModelScope.launch { optInStore.save(optIn) }
    }

    companion object {
        /** Used by the composition root; keeps construction explicit (no DI framework). */
        fun factory(
            source: CaptureObservationSource,
            optInStore: WornOptInStore,
            clock: CaptureClock,
        ): ViewModelProvider.Factory =
            viewModelFactory {
                initializer { CaptureViewModel(source, optInStore, clock) }
            }
    }
}

/** The same camera step: a mode change keeps the step (and its anyway timer). */
private fun CameraContext.isSameStepAs(other: CameraContext): Boolean =
    family == other.family && side == other.side && kind == other.kind
