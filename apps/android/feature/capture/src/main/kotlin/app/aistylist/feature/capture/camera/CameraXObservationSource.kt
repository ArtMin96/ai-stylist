package app.aistylist.feature.capture.camera

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.PowerManager
import android.util.Log
import android.util.Size
import androidx.camera.compose.CameraXViewfinder
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.SurfaceRequest
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.lifecycle.awaitInstance
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.analysis.LumaPlane
import app.aistylist.feature.capture.analysis.measureObservation
import app.aistylist.feature.capture.domain.CameraFeedEvent
import app.aistylist.feature.capture.domain.CameraUnavailableReason
import app.aistylist.feature.capture.domain.CaptureClock
import app.aistylist.feature.capture.domain.CaptureObservation
import app.aistylist.feature.capture.domain.CaptureObservationSource
import app.aistylist.feature.capture.domain.MaskAnalysis
import app.aistylist.feature.capture.domain.MaskObservation
import app.aistylist.feature.capture.domain.PhotoRef
import app.aistylist.feature.capture.domain.PhotoResult
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.coroutines.resume

/**
 * The real camera (capture brief §3): CameraX preview, a 640 × 480 KEEP_ONLY_LATEST analysis stream
 * measured on its Y plane, the on-device garment segmenter every mask interval (ML Kit object
 * detection when it cannot load; ML Kit pose detection in worn mode, on the same frame), phone motion
 * from the accelerometer, and ImageCapture for the photo. The camera
 * opens when [feed] is collected and closes when it is cancelled; it has its own lifecycle, so the
 * view model alone decides when the camera runs (background, leaving the camera step).
 */
class CameraXObservationSource(
    private val context: Context,
    private val photos: CapturePhotoStore,
    private val permission: CameraPermissionGate,
    private val clock: CaptureClock,
    private val mainDispatcher: CoroutineDispatcher = Dispatchers.Main,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
) : CaptureObservationSource,
    CaptureCameraView {
    private val surfaceRequest = MutableStateFlow<SurfaceRequest?>(null)
    private val torchAvailable = MutableStateFlow(false)
    private val torchOn = MutableStateFlow(false)
    private val motion = DeviceMotionSensor(context)
    private val stillDetector by lazy { MlKitItemDetector(streamMode = false) }
    private val stillSegmenter by lazy { LiteRtGarmentSegmenter.load(context) }
    private val stillLock = Mutex()

    @Volatile
    private var imageCapture: ImageCapture? = null

    @Volatile
    private var camera: Camera? = null

    @Volatile
    private var boundOwner: CameraLifecycleOwner? = null

    /** Where ImageCapture delivers the photo; one thread for the app's lifetime. */
    private val captureExecutor: ExecutorService by lazy { Executors.newSingleThreadExecutor() }

    override val hasTorch: StateFlow<Boolean> = torchAvailable.asStateFlow()
    override val isTorchOn: StateFlow<Boolean> = torchOn.asStateFlow()

    override fun setTorch(isOn: Boolean) {
        val current = camera ?: return
        current.cameraControl.enableTorch(isOn)
        torchOn.value = isOn
    }

    @Composable
    override fun Preview(modifier: Modifier) {
        val request by surfaceRequest.collectAsStateWithLifecycle()
        request?.let { CameraXViewfinder(surfaceRequest = it, modifier = modifier, contentScale = ContentScale.Crop) }
    }

    override fun feed(poseDetection: StateFlow<Boolean>): Flow<CameraFeedEvent> =
        cameraFeed(openCamera(poseDetection), ::unbind)

    private fun openCamera(poseDetection: StateFlow<Boolean>): Flow<CameraFeedEvent> =
        callbackFlow {
            val unavailable = unavailableReason()
            if (unavailable != null) {
                send(CameraFeedEvent.Unavailable(unavailable))
                awaitClose()
                return@callbackFlow
            }
            val provider = ProcessCameraProvider.awaitInstance(context)
            if (!provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)) {
                send(CameraFeedEvent.Unavailable(CameraUnavailableReason.NO_CAMERA))
                awaitClose()
                return@callbackFlow
            }
            val executor = Executors.newSingleThreadExecutor()
            val analyzer = FrameAnalyzer(poseDetection) { event -> trySend(event) }
            val owner = CameraLifecycleOwner()
            val bindFailure =
                withContext(mainDispatcher) { bindOrUnavailable { bind(provider, owner, analyzer, executor) } }
            if (bindFailure != null) {
                // The feed's `finally` unbinds the half-started camera; only the analysis parts are ours.
                send(CameraFeedEvent.Unavailable(bindFailure))
                awaitClose {
                    analyzer.close()
                    executor.shutdown()
                }
                return@callbackFlow
            }
            motion.start()
            awaitClose {
                motion.stop()
                analyzer.close()
                executor.shutdown()
            }
        }

    override suspend fun takePhoto(): PhotoResult {
        val capture = imageCapture ?: return PhotoResult.Failed
        val bitmap =
            suspendCancellableCoroutine<Bitmap?> { continuation ->
                capture.takePicture(
                    captureExecutor,
                    object : ImageCapture.OnImageCapturedCallback() {
                        override fun onCaptureSuccess(image: ImageProxy) {
                            val upright = image.use { it.toBitmap().rotated(it.imageInfo.rotationDegrees) }
                            continuation.resume(upright)
                        }

                        override fun onError(exception: ImageCaptureException) {
                            // The session relocks on the last hint; the user can try again.
                            continuation.resume(null)
                        }
                    },
                )
            } ?: return PhotoResult.Failed
        return PhotoResult.Taken(photos.put(bitmap))
    }

    override suspend fun analyzeStill(photo: PhotoRef): CaptureObservation? {
        val bitmap = photos.load(photo) ?: return null
        return withContext(ioDispatcher) {
            stillLock.withLock {
                val segmenter = stillSegmenter
                if (segmenter != null) {
                    analyzeBitmap(bitmap, segmenter, clock.nowMs())
                } else {
                    analyzeBitmap(bitmap, stillDetector, clock.nowMs())
                }
            }
        }
    }

    private suspend fun unavailableReason(): CameraUnavailableReason? =
        when {
            !context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) -> {
                CameraUnavailableReason.NO_CAMERA
            }

            !permission.awaitAnswer() -> {
                CameraUnavailableReason.PERMISSION_DENIED
            }

            else -> {
                null
            }
        }

    private fun bind(
        provider: ProcessCameraProvider,
        owner: CameraLifecycleOwner,
        analyzer: FrameAnalyzer,
        executor: ExecutorService,
    ) {
        val preview =
            androidx.camera.core.Preview
                .Builder()
                .setResolutionSelector(ratio4by3())
                .build()
                .also { it.setSurfaceProvider { request -> surfaceRequest.value = request } }
        val analysis =
            ImageAnalysis
                .Builder()
                .setResolutionSelector(analysisResolution())
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { it.setAnalyzer(executor, analyzer) }
        val capture =
            ImageCapture
                .Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .setResolutionSelector(ratio4by3())
                .build()
        provider.unbindAll()
        owner.start()
        boundOwner = owner
        val bound = provider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis, capture)
        camera = bound
        imageCapture = capture
        torchAvailable.value = bound.cameraInfo.hasFlashUnit()
    }

    /** Closes the camera: on the main thread, even when the collector was cancelled. */
    private suspend fun unbind() {
        withContext(NonCancellable + mainDispatcher) {
            boundOwner?.destroy()
            boundOwner = null
            camera = null
            imageCapture = null
            surfaceRequest.value = null
            torchAvailable.value = false
            torchOn.value = false
        }
    }

    /**
     * Measures each analysis frame (one in flight, KEEP_ONLY_LATEST) and attaches the newest garment
     * mask. The segmenter loads and runs on its own thread at the mask cadence, so luma, sharpness
     * and motion keep the frame rate while a mask is computed. If it cannot load, ML Kit object
     * detection gives boxes on every frame instead (doc-10 fallback). Pose stays ML Kit (worn mode).
     */
    private inner class FrameAnalyzer(
        private val poseDetection: StateFlow<Boolean>,
        private val emit: (CameraFeedEvent) -> Unit,
    ) : ImageAnalysis.Analyzer {
        private var items: MlKitItemDetector? = null
        private val poses by lazy { MlKitPoseDetector() }
        private val segmenterThread: ExecutorService = Executors.newSingleThreadExecutor()
        private val cadence = MaskCadence()
        private val power = context.getSystemService(PowerManager::class.java)

        @Volatile
        private var segmenter: SegmenterState = SegmenterState.Loading

        @Volatile
        private var latestMask: MaskObservation? = null
        private var isReady = false

        init {
            segmenterThread.execute {
                segmenter = LiteRtGarmentSegmenter.load(context)?.let(SegmenterState::Ready) ?: SegmenterState.Failed
            }
        }

        @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
        override fun analyze(image: ImageProxy) {
            image.use { proxy ->
                val media = proxy.image ?: return
                val nowMs = clock.nowMs()
                val rotation = proxy.imageInfo.rotationDegrees
                val input = InputImage.fromMediaImage(media, rotation)
                val state = segmenter
                val boxes = if (state == SegmenterState.Failed) itemDetector().detect(input).orEmpty() else emptyList()
                if (state is SegmenterState.Ready && cadence.tryStart(nowMs, isHot())) {
                    val upright = proxy.toBitmap().rotated(rotation)
                    segmenterThread.execute { runSegmenter(state.segmenter, upright, nowMs) }
                }
                val mask = if (state is SegmenterState.Ready) latestMask else null
                val hasItem = mask?.foundItem != null || boxes.isNotEmpty()
                val pose = if (poseDetection.value && hasItem) poses.detect(input) else null
                val yPlane = proxy.planes[0]
                val bytes = ByteArray(yPlane.buffer.remaining()).also { yPlane.buffer.get(it) }
                val plane = LumaPlane.fromYPlane(proxy.width, proxy.height, bytes, yPlane.rowStride, yPlane.pixelStride)
                val observation = measureObservation(nowMs, plane, rotation, boxes, motion.latest, pose, mask)
                if (!isReady) {
                    isReady = true
                    emit(CameraFeedEvent.Ready)
                }
                emit(CameraFeedEvent.Frame(observation))
            }
        }

        private fun runSegmenter(
            model: LiteRtGarmentSegmenter,
            upright: Bitmap,
            frameAtMs: Long,
        ) {
            try {
                latestMask = MaskAnalysis(model.segment(upright).labels).at(frameAtMs)
            } catch (error: IllegalStateException) {
                fallBack(error)
            } catch (error: IllegalArgumentException) {
                fallBack(error)
            } finally {
                cadence.finish()
            }
        }

        /** The segmenter failed at run time (LiteRT reports native errors this way): ML Kit boxes from now on. */
        private fun fallBack(error: RuntimeException) {
            Log.w(SEGMENTER_TAG, "garment segmenter failed, using object boxes", error)
            segmenter = SegmenterState.Failed
            latestMask = null
        }

        private fun itemDetector(): MlKitItemDetector =
            items ?: MlKitItemDetector(streamMode = true).also { items = it }

        private fun isHot(): Boolean = power.currentThermalStatus >= PowerManager.THERMAL_STATUS_MODERATE

        fun close() {
            // Queued after any run in flight, so the interpreter closes once it is idle.
            segmenterThread.execute { (segmenter as? SegmenterState.Ready)?.segmenter?.close() }
            segmenterThread.shutdown()
            items?.close()
            poses.close()
        }
    }

    private sealed interface SegmenterState {
        data object Loading : SegmenterState

        data class Ready(
            val segmenter: LiteRtGarmentSegmenter,
        ) : SegmenterState

        data object Failed : SegmenterState
    }

    private companion object {
        const val SEGMENTER_TAG = "CaptureSegmenter"

        fun ratio4by3(): ResolutionSelector =
            ResolutionSelector
                .Builder()
                .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
                .build()

        fun analysisResolution(): ResolutionSelector =
            ResolutionSelector
                .Builder()
                .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
                .setResolutionStrategy(
                    ResolutionStrategy(
                        Size(CaptureRules.AnalysisFrame.WIDTH_PX, CaptureRules.AnalysisFrame.HEIGHT_PX),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                    ),
                ).build()
    }
}

/** [upstream], then [unbindCamera] once it ends, however it ends. */
private fun cameraFeed(
    upstream: Flow<CameraFeedEvent>,
    unbindCamera: suspend () -> Unit,
): Flow<CameraFeedEvent> =
    flow {
        try {
            emitAll(upstream)
        } finally {
            unbindCamera()
        }
    }

/** The camera's own lifecycle: started while the feed runs, destroyed when it stops. Main thread only. */
private class CameraLifecycleOwner : LifecycleOwner {
    private val registry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = registry

    fun start() {
        registry.currentState = Lifecycle.State.RESUMED
    }

    fun destroy() {
        registry.currentState = Lifecycle.State.DESTROYED
    }
}

/** Measures a still (an import or a test frame) with [detector]: no motion, no pose. */
fun analyzeBitmap(
    bitmap: Bitmap,
    detector: MlKitItemDetector,
    timestampMs: Long,
): CaptureObservation {
    val boxes = detector.detect(InputImage.fromBitmap(bitmap, 0)).orEmpty()
    return measureObservation(timestampMs, bitmap.lumaPlane(), rotationDegrees = 0, boxes = boxes)
}

/** Measures a still (an import or a test frame) with the garment [segmenter]: no motion, no pose. */
fun analyzeBitmap(
    bitmap: Bitmap,
    segmenter: LiteRtGarmentSegmenter,
    timestampMs: Long,
): CaptureObservation {
    val mask = MaskAnalysis(segmenter.segment(bitmap).labels).at(timestampMs)
    return measureObservation(timestampMs, bitmap.lumaPlane(), rotationDegrees = 0, boxes = emptyList(), mask = mask)
}

/** Rec. 601 luma of [this] bitmap. */
fun Bitmap.lumaPlane(): LumaPlane {
    val pixels = IntArray(width * height)
    getPixels(pixels, 0, width, 0, 0, width, height)
    return LumaPlane.fromArgb(width, height, pixels)
}

private fun Bitmap.rotated(degrees: Int): Bitmap =
    if (degrees ==
        0
    ) {
        this
    } else {
        Bitmap.createBitmap(this, 0, 0, width, height, Matrix().apply { postRotate(degrees.toFloat()) }, true)
    }
