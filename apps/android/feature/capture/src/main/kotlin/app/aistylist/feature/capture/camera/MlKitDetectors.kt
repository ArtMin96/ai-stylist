package app.aistylist.feature.capture.camera

import app.aistylist.contracts.kernel.CaptureBodyPart
import app.aistylist.feature.capture.analysis.uprightBox
import app.aistylist.feature.capture.domain.NormalizedPoint
import app.aistylist.feature.capture.domain.NormalizedRect
import app.aistylist.feature.capture.domain.PoseLandmark
import app.aistylist.feature.capture.domain.PoseSample
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.ObjectDetector
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseDetector
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import java.io.Closeable
import java.util.concurrent.ExecutionException
import com.google.mlkit.vision.pose.PoseLandmark as MlKitPoseLandmark

/**
 * ML Kit object detection with the bundled model (capture brief §3). [streamMode] for the live camera
 * (tracking across frames); single-image mode for stills and test frames. Up to five objects, so the
 * covered rule (brief §4, C32) sees an object lying on the item; the rules judge the largest box.
 * Calls block their thread: run them on the analysis executor or an IO dispatcher.
 */
class MlKitItemDetector(
    streamMode: Boolean,
) : Closeable {
    private val detector: ObjectDetector =
        ObjectDetection.getClient(
            ObjectDetectorOptions
                .Builder()
                .setDetectorMode(
                    if (streamMode) ObjectDetectorOptions.STREAM_MODE else ObjectDetectorOptions.SINGLE_IMAGE_MODE,
                ).enableMultipleObjects()
                .build(),
        )

    /**
     * The item boxes in [image], upright and normalised; null when the detector failed (the caller
     * treats that frame as "no item"). ML Kit reports boxes in the upright image, so they are
     * normalised by the upright size.
     */
    fun detect(image: InputImage): List<NormalizedRect>? {
        val objects = detector.process(image).awaitOrNull() ?: return null
        val (width, height) = image.uprightSize()
        return objects.map { found ->
            val box = found.boundingBox
            uprightBox(
                box.left.toFloat(),
                box.top.toFloat(),
                box.right.toFloat(),
                box.bottom.toFloat(),
                width,
                height,
                rotationDegrees = 0,
            )
        }
    }

    override fun close() = detector.close()
}

/** ML Kit pose detection, bundled base model, stream mode (worn mode only, capture brief §3). */
class MlKitPoseDetector : Closeable {
    private val detector: PoseDetector =
        PoseDetection.getClient(
            PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.STREAM_MODE).build(),
        )

    /** The landmarks the body check reads; null when the model failed (the doc-10 fallback). */
    fun detect(image: InputImage): PoseSample? {
        val pose = detector.process(image).awaitOrNull() ?: return null
        val (width, height) = image.uprightSize()
        val landmarks =
            BODY_PARTS
                .mapNotNull { (part, type) ->
                    pose.getPoseLandmark(type)?.let { landmark ->
                        part to
                            PoseLandmark(
                                position =
                                    NormalizedPoint(
                                        x = (landmark.position.x / width).toDouble(),
                                        y = (landmark.position.y / height).toDouble(),
                                    ),
                                inFrameLikelihood = landmark.inFrameLikelihood.toDouble(),
                            )
                    }
                }.toMap()
        return PoseSample(landmarks)
    }

    override fun close() = detector.close()

    private companion object {
        val BODY_PARTS: List<Pair<CaptureBodyPart, Int>> =
            listOf(
                CaptureBodyPart.LEFT_SHOULDER to MlKitPoseLandmark.LEFT_SHOULDER,
                CaptureBodyPart.RIGHT_SHOULDER to MlKitPoseLandmark.RIGHT_SHOULDER,
                CaptureBodyPart.LEFT_HIP to MlKitPoseLandmark.LEFT_HIP,
                CaptureBodyPart.RIGHT_HIP to MlKitPoseLandmark.RIGHT_HIP,
                CaptureBodyPart.LEFT_KNEE to MlKitPoseLandmark.LEFT_KNEE,
                CaptureBodyPart.RIGHT_KNEE to MlKitPoseLandmark.RIGHT_KNEE,
                CaptureBodyPart.LEFT_ANKLE to MlKitPoseLandmark.LEFT_ANKLE,
                CaptureBodyPart.RIGHT_ANKLE to MlKitPoseLandmark.RIGHT_ANKLE,
            )
    }
}

private const val QUARTER_TURN = 90
private const val THREE_QUARTER_TURN = 270

/** The image's size once turned upright: ML Kit's result coordinate space. */
private fun InputImage.uprightSize(): Pair<Int, Int> =
    if (rotationDegrees == QUARTER_TURN || rotationDegrees == THREE_QUARTER_TURN) height to width else width to height

/** Blocks until the task ends; null when it failed or the thread was interrupted. */
private fun <T> Task<T>.awaitOrNull(): T? =
    try {
        Tasks.await(this)
    } catch (ignored: ExecutionException) {
        // A model error is not fatal: the frame counts as "no item", or the pose fallback applies.
        null
    } catch (ignored: InterruptedException) {
        Thread.currentThread().interrupt()
        null
    }
